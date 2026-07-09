import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const jobUrl = formData.get("jobUrl") as string;
    const jobDescriptionInput = formData.get("jobDescription") as string | null;
    const file = formData.get("file") as File | null;
    const resumeId = formData.get("resumeId") as string | null;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get resume data — either from uploaded file or existing record
    let resumeText = "";
    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const extractResult = await model.generateContent([
        { text: "Extract the full text content of this resume. Return only the text, no formatting or JSON." },
        { inlineData: { mimeType: file.type || "application/pdf", data: buffer.toString("base64") } },
      ]);
      resumeText = extractResult.response.text();
    } else if (resumeId) {
      const { data: resume } = await supabase
        .from("resumes")
        .select("parsed_data")
        .eq("id", resumeId)
        .eq("user_id", user.id)
        .single();
      if (resume?.parsed_data) {
        const pd = resume.parsed_data;
        resumeText = `Name: ${pd.name}\nSkills: ${pd.skills.join(", ")}\nExperience:\n${pd.experience.map((e: { title: string; company: string; start_date: string; end_date: string; description: string }) => `- ${e.title} at ${e.company} (${e.start_date} - ${e.end_date}): ${e.description}`).join("\n")}\nEducation:\n${pd.education.map((e: { degree: string; school: string; graduation_year: number }) => `- ${e.degree} from ${e.school} (${e.graduation_year})`).join("\n")}`;
      }
    }

    if (!resumeText) {
      return NextResponse.json({ error: "No resume data available. Please upload a resume or select an existing one." }, { status: 400 });
    }

    if (!jobUrl && !jobDescriptionInput) {
      return NextResponse.json({ error: "Job URL or job description is required" }, { status: 400 });
    }

    let jobDescription = "";

    // If user pasted a job description directly, use that
    if (jobDescriptionInput && jobDescriptionInput.length > 50) {
      jobDescription = jobDescriptionInput.slice(0, 15000);
    } else {
      if (!jobUrl) {
        return NextResponse.json({ error: "Job URL is required when no job description is provided" }, { status: 400 });
      }

    // Step 1: Try to fetch the page HTML directly
    let pageContent = "";
    try {
      const pageResponse = await fetch(jobUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        redirect: "follow",
      });
      if (pageResponse.ok) {
        const html = await pageResponse.text();
        // Strip HTML tags but keep text content
        pageContent = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 15000); // Limit to avoid token overflow
      }
    } catch {
      // Direct fetch failed, will rely on Google Search grounding
    }

    // Step 2: Use Gemini with Google Search grounding to find job details
    const searchModel = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      tools: [{ googleSearch: {} }] as never,
    });

    // Extract useful identifiers from the URL to help search
    const urlParts = jobUrl.match(/job\/([^/]+)\//);
    const jobIdFromUrl = urlParts ? urlParts[1] : "";
    const titleFromUrl = jobUrl.split("/").pop()?.replace(/[?#].*/, "").replace(/-/g, " ") || "";

    const jobFetchPrompt = `Summarize the key details of this job posting in your own words. Do NOT copy the posting verbatim — paraphrase and restructure the information.

URL: ${jobUrl}
${jobIdFromUrl ? `Job ID: ${jobIdFromUrl}` : ""}
${titleFromUrl ? `Possible title from URL: ${titleFromUrl}` : ""}

${pageContent ? `Here is the raw page content I was able to fetch (may be incomplete or contain navigation text):\n${pageContent.slice(0, 8000)}\n\n` : ""}

Search for this exact job posting online and SUMMARIZE (in your own words) the following details:
- Job title
- Company name
- Location (city, country)
- Salary range (if available)
- Key responsibilities (summarize in bullet points)
- Required qualifications and skills (list them)
- Nice-to-have / preferred qualifications
- Benefits (if listed)
- Employment type (full-time, contract, etc.)

IMPORTANT: Paraphrase everything. Do not reproduce the original posting word-for-word.`;

    try {
      const jobResult = await searchModel.generateContent(jobFetchPrompt);
      jobDescription = jobResult.response.text();
    } catch (geminiErr: unknown) {
      // Handle RECITATION block — try to get partial text from candidates
      if (geminiErr && typeof geminiErr === "object" && "response" in geminiErr) {
        const errResponse = geminiErr as { response: { candidates?: { content?: { parts?: { text?: string }[] } }[] } };
        const parts = errResponse.response?.candidates?.[0]?.content?.parts;
        if (parts) {
          jobDescription = parts.map((p) => p.text || "").join("\n");
        }
      }
      // If we got page content directly, use that as fallback
      if (!jobDescription && pageContent) {
        jobDescription = pageContent.slice(0, 10000);
      }
    }

    if (!jobDescription || jobDescription.length < 100) {
      return NextResponse.json({ error: "Could not retrieve job posting content from the provided URL. The job site may block automated access. Try pasting the job description directly in the text box below." }, { status: 400 });
    }

    } // end of else block (URL-based fetching)

    // Now score the match
    const matchModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const matchPrompt = `You are an expert career advisor and job matching specialist. Analyze the match between this resume and job posting.

RESUME:
${resumeText}

JOB POSTING:
${jobDescription}

Provide a detailed match analysis. Return ONLY a valid JSON object with this exact structure:
{
  "overall_score": <number 0-100>,
  "skill_score": <number 0-100>,
  "experience_score": <number 0-100>,
  "salary_score": <number 0-100>,
  "culture_score": <number 0-100>,
  "job_title": "<extracted job title>",
  "company": "<extracted company name>",
  "location": "<extracted location>",
  "matching_skills": ["skill1", "skill2"],
  "missing_skills": ["skill1", "skill2"],
  "pros": [
    "Pro point 1 - specific reason why this is a good match",
    "Pro point 2",
    "Pro point 3",
    "Pro point 4",
    "Pro point 5"
  ],
  "cons": [
    "Con point 1 - specific concern or gap",
    "Con point 2",
    "Con point 3",
    "Con point 4",
    "Con point 5"
  ],
  "summary": "A 2-3 sentence overall assessment of the match",
  "recommendations": ["Recommendation 1 to improve chances", "Recommendation 2", "Recommendation 3"]
}

SCORING GUIDELINES:
- skill_score: Percentage of required skills the candidate has (technical + soft skills)
- experience_score: How well the candidate's experience level and industry align
- salary_score: 100 if salary not listed, otherwise based on alignment with candidate's apparent level
- culture_score: Based on work style, values, and company culture fit signals
- overall_score: Weighted average (skills 40%, experience 30%, salary 15%, culture 15%)

Be specific and honest. Provide at least 5 pros and 5 cons. Return ONLY the JSON, no markdown fences or other text.`;

    const matchResult = await matchModel.generateContent(matchPrompt);
    const matchText = matchResult.response.text();

    let matchData;
    try {
      const cleaned = matchText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      matchData = JSON.parse(cleaned);
    } catch {
      const jsonMatch = matchText.match(/\{[\s\S]*\}/);
      matchData = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    }

    if (!matchData) {
      return NextResponse.json({ error: "Failed to analyze match. Please try again." }, { status: 500 });
    }

    // Save analysis to database
    const { data: savedAnalysis } = await supabase.from("match_analyses").insert({
      user_id: user.id,
      job_url: jobUrl,
      job_title: matchData.job_title || null,
      company: matchData.company || null,
      location: matchData.location || null,
      overall_score: matchData.overall_score,
      skill_score: matchData.skill_score,
      experience_score: matchData.experience_score,
      salary_score: matchData.salary_score,
      culture_score: matchData.culture_score,
      matching_skills: matchData.matching_skills || [],
      missing_skills: matchData.missing_skills || [],
      pros: matchData.pros || [],
      cons: matchData.cons || [],
      summary: matchData.summary || null,
      recommendations: matchData.recommendations || [],
      job_description: jobDescription,
    }).select().single();

    return NextResponse.json({ match: matchData, jobDescription, savedId: savedAnalysis?.id });
  } catch (err) {
    console.error("Match analysis error:", err);
    return NextResponse.json({ error: "Failed to analyze match. Please try again." }, { status: 500 });
  }
}
