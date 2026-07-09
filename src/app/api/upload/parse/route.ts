import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import mammoth from "mammoth";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

async function parseResumeWithGemini(fileBuffer: Buffer, mimeType: string) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `Parse this resume and extract structured data. Return ONLY a JSON object with this exact structure:
{
  "name": "full name",
  "skills": ["skill1", "skill2", ...],
  "experience": [
    {
      "title": "job title",
      "company": "company name",
      "start_date": "YYYY-MM or approximate",
      "end_date": "YYYY-MM or Present",
      "years": number of years (approximate),
      "description": "brief description of responsibilities"
    }
  ],
  "education": [
    {
      "degree": "degree name",
      "school": "institution name",
      "graduation_year": YYYY
    }
  ]
}

Extract ALL skills mentioned (technical, soft skills, tools, frameworks, certifications).
For experience, list most recent first.
Return ONLY the JSON, no markdown fences or other text.`;

  // For DOCX: extract text first, then send as text prompt
  // For PDF: send as inline data (Gemini supports PDF natively)
  const isDocx = mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  let result;
  if (isDocx) {
    const { value: text } = await mammoth.extractRawText({ buffer: fileBuffer });
    result = await model.generateContent(`${prompt}\n\nRESUME TEXT:\n${text}`);
  } else {
    result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType,
          data: fileBuffer.toString("base64"),
        },
      },
    ]);
  }

  const responseText = result.response.text();
  // Strip markdown code fences if present
  const cleaned = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const fileName = formData.get("fileName") as string;
    const fileUrl = formData.get("fileUrl") as string;
    const file = formData.get("file") as File | null;
    const resumeId = formData.get("resumeId") as string | null;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    if (!fileName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    let parsedData = null;
    let parsedAt = null;

    // Parse resume with Gemini if file is provided
    if (file) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mimeType = file.type || "application/pdf";
        parsedData = await parseResumeWithGemini(buffer, mimeType);
        parsedAt = new Date().toISOString();
        console.log("Resume parsed successfully:", parsedData.name, "- Skills:", parsedData.skills.length);
      } catch (parseErr) {
        console.error("Gemini parse error:", parseErr);
        // Continue without parsed data — still save the file reference
      }
    }

    // If resumeId provided, update existing record (re-parse)
    if (resumeId) {
      const { data: resume, error } = await supabase
        .from("resumes")
        .update({ parsed_data: parsedData, parsed_at: parsedAt })
        .eq("id", resumeId)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) {
        console.error("Database error:", error);
        return NextResponse.json(
          { error: "Failed to update resume data" },
          { status: 500 }
        );
      }
      return NextResponse.json({ resume });
    }

    // Store new record in database
    const { data: resume, error } = await supabase
      .from("resumes")
      .insert({
        user_id: userId,
        file_name: fileName,
        file_url: fileUrl || "",
        parsed_data: parsedData,
        uploaded_at: new Date().toISOString(),
        parsed_at: parsedAt,
      })
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to store resume data" },
        { status: 500 }
      );
    }

    return NextResponse.json({ resume });
  } catch (err) {
    console.error("Parse error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
