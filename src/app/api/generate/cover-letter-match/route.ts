import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: Request) {
  try {
    const { jobTitle, company, jobUrl, matchingSkills, recommendations, resumeId } = await request.json();
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user's resume (specific or most recent)
    const resumeQuery = resumeId
      ? supabase.from("resumes").select("*").eq("id", resumeId).eq("user_id", user.id).single()
      : supabase.from("resumes").select("*").eq("user_id", user.id).order("uploaded_at", { ascending: false }).limit(1).single();

    const { data: resume } = await resumeQuery;

    if (!resume?.parsed_data) {
      return NextResponse.json({ error: "No parsed resume found. Please upload a resume first." }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are an expert cover letter writer. Generate a concise, compelling cover letter for this job application.

JOB TITLE: ${jobTitle}
COMPANY: ${company}
MATCHING SKILLS: ${matchingSkills?.join(", ") || "N/A"}
${recommendations?.length ? `RECOMMENDATIONS TO ADDRESS:\n${recommendations.join("\n")}` : ""}

CANDIDATE BACKGROUND:
Name: ${resume.parsed_data.name}
Current Role: ${resume.parsed_data.experience[0]?.title} at ${resume.parsed_data.experience[0]?.company}
Key Skills: ${resume.parsed_data.skills.slice(0, 10).join(", ")}
Years of Experience: ${resume.parsed_data.experience.reduce((sum: number, exp: { years: number }) => sum + (exp.years || 0), 0)} years

INSTRUCTIONS:
1. Write exactly 2-3 short paragraphs, 200 words maximum total
2. Opening: Express enthusiasm for the specific role at the company
3. Middle: Connect 2-3 specific matching skills/experiences to the role requirements
4. Closing: Brief sign-off with availability
5. Tone: Professional but personable, confident
6. Start with "Dear Hiring Manager," and end with "Sincerely, ${resume.parsed_data.name}"
7. Do NOT use generic filler phrases. Be specific and concise.

Output only the cover letter text, nothing else.`;

    const result = await model.generateContent(prompt);
    const content = result.response.text();

    // Store cover letter
    await supabase.from("cover_letters").insert({
      user_id: user.id,
      job_id: null,
      original_resume_id: resume.id,
      company_name: company || "Unknown",
      generated_content: content,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ content });
  } catch (err) {
    console.error("Cover letter generation error:", err);
    return NextResponse.json({ error: "Failed to generate cover letter" }, { status: 500 });
  }
}
