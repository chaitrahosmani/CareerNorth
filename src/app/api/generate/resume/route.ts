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

    // Fetch job and user's resume (filter job by user_id for data isolation)
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

    const prompt = `You are an expert resume writer and career coach. Tailor the following resume for the specific job description below.

JOB TITLE: ${job.title}
COMPANY: ${job.company}
JOB DESCRIPTION: ${job.job_description}
REQUIRED SKILLS: ${job.match_breakdown.required_skills.join(", ")}

CANDIDATE'S CURRENT RESUME DATA:
Name: ${resume.parsed_data.name}
Skills: ${resume.parsed_data.skills.join(", ")}
Experience:
${resume.parsed_data.experience.map((exp: { title: string; company: string; start_date: string; end_date: string; description: string }) => 
  `- ${exp.title} at ${exp.company} (${exp.start_date} - ${exp.end_date}): ${exp.description}`
).join("\n")}
Education:
${resume.parsed_data.education.map((edu: { degree: string; school: string; graduation_year: number }) => 
  `- ${edu.degree} from ${edu.school} (${edu.graduation_year})`
).join("\n")}

INSTRUCTIONS:
1. Reorder and rewrite bullet points to emphasize skills most relevant to this job
2. Add quantified results where possible
3. Strengthen action verbs
4. Ensure ATS compliance (use keywords from job description naturally)
5. Keep the same job history but reframe descriptions to align with target role

Output a complete tailored resume in a clean, professional format. Include a strong summary at the top.`;

    const result = await model.generateContent(prompt);
    const content = result.response.text();

    // Store tailored resume
    await supabase.from("resumes_tailored").insert({
      user_id: user.id,
      job_id: jobId,
      original_resume_id: resume.id,
      tailored_content: { text: content, job_title: job.title, company: job.company },
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ content });
  } catch (err) {
    console.error("Resume generation error:", err);
    return NextResponse.json({ error: "Failed to generate tailored resume" }, { status: 500 });
  }
}
