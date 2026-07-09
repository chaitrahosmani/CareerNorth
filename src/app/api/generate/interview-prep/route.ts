import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: Request) {
  try {
    const { jobId } = await request.json();
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [jobResult, resumeResult] = await Promise.all([
      supabase.from("jobs_matched").select("*").eq("id", jobId).eq("user_id", user.id).single(),
      supabase.from("resumes").select("*").eq("user_id", user.id).order("uploaded_at", { ascending: false }).limit(1).single(),
    ]);

    const job = jobResult.data;
    const resume = resumeResult.data;

    if (!job || !resume?.parsed_data) {
      return NextResponse.json({ error: "Missing job or resume data" }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `You are an expert interview coach. Generate interview preparation materials for this specific role.

JOB TITLE: ${job.title}
COMPANY: ${job.company}
JOB DESCRIPTION: ${job.job_description}
REQUIRED SKILLS: ${job.match_breakdown.required_skills.join(", ")}

CANDIDATE BACKGROUND:
Current Role: ${resume.parsed_data.experience[0]?.title} at ${resume.parsed_data.experience[0]?.company}
Key Skills: ${resume.parsed_data.skills.join(", ")}
Total Experience: ${resume.parsed_data.experience.reduce((sum: number, exp: { years: number }) => sum + (exp.years || 0), 0)} years

Generate a JSON response with this exact structure:
{
  "questions": [
    {
      "question": "The interview question",
      "why_asked": "Why the interviewer asks this - what they're assessing",
      "sample_answer": "A strong sample answer using STAR format (Situation, Task, Action, Result) based on the candidate's background. 3-4 sentences.",
      "pitfalls": ["Common mistake 1", "Common mistake 2"]
    }
  ],
  "talking_points": [
    "Company insight or talking point 1",
    "Company insight or talking point 2"
  ]
}

REQUIREMENTS:
1. Generate exactly 8 questions
2. Mix of behavioral, technical, and situational questions
3. Sample answers should reference the candidate's actual experience
4. Include 5 company talking points (can be general for the industry/role type)
5. Questions should be specific to this role, not generic
6. Return ONLY valid JSON, no markdown formatting or code blocks`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch {
      // Try to extract JSON from the response if it has extra text
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      parsedResponse = jsonMatch ? JSON.parse(jsonMatch[0]) : { questions: [], talking_points: [] };
    }

    // Store interview prep
    await supabase.from("interview_prep").insert({
      user_id: user.id,
      job_id: jobId,
      questions: parsedResponse.questions || [],
      talking_points: parsedResponse.talking_points || [],
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      questions: parsedResponse.questions || [],
      talking_points: parsedResponse.talking_points || [],
    });
  } catch (err) {
    console.error("Interview prep generation error:", err);
    return NextResponse.json({ error: "Failed to generate interview prep" }, { status: 500 });
  }
}
