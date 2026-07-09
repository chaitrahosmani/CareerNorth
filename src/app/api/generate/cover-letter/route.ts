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
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are an expert cover letter writer. Generate a compelling, personalized cover letter for this job application.

JOB TITLE: ${job.title}
COMPANY: ${job.company}
JOB DESCRIPTION: ${job.job_description}

CANDIDATE BACKGROUND:
Name: ${resume.parsed_data.name}
Current Role: ${resume.parsed_data.experience[0]?.title} at ${resume.parsed_data.experience[0]?.company}
Key Skills: ${resume.parsed_data.skills.slice(0, 8).join(", ")}
Years of Experience: ${resume.parsed_data.experience.reduce((sum: number, exp: { years: number }) => sum + (exp.years || 0), 0)} years

INSTRUCTIONS:
1. Write exactly 3 paragraphs, 250 words maximum
2. Opening paragraph: Express enthusiasm, mention specific role and company
3. Middle paragraph: Connect 2-3 specific experiences/achievements to the job requirements
4. Closing paragraph: Reiterate interest, mention availability, professional sign-off
5. Tone: Professional but personable, confident not arrogant
6. Include specific details from the job description to show you've read it carefully
7. Start with "Dear Hiring Manager," and end with "Sincerely, ${resume.parsed_data.name}"

Do NOT use generic phrases like "I believe I would be a great fit." Be specific.`;

    const result = await model.generateContent(prompt);
    const content = result.response.text();

    // Store cover letter
    await supabase.from("cover_letters").insert({
      user_id: user.id,
      job_id: jobId,
      original_resume_id: resume.id,
      company_name: job.company,
      generated_content: content,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ content });
  } catch (err) {
    console.error("Cover letter generation error:", err);
    return NextResponse.json({ error: "Failed to generate cover letter" }, { status: 500 });
  }
}
