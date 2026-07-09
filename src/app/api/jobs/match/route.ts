import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { callLLM, AllProvidersExhaustedError } from "@/lib/llm";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface SearchedJob {
  title: string;
  company: string;
  location: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  job_url: string;
  job_description: string;
  required_skills: string[];
  remote_type: "remote" | "hybrid" | "onsite";
  posted_date: string;
}

interface MatchResult {
  match_score: number;
  skill_score: number;
  experience_score: number;
  salary_score: number;
  culture_score: number;
  matching_skills: string[];
  missing_skills: string[];
  reasoning: string;
}

const JOB_SITE_MAP: Record<string, { label: string; url: string; domain: string }> = {
  gojobs: { label: "Ontario Public Service", url: "https://www.gojobs.gov.on.ca/", domain: "gojobs.gov.on.ca" },
  mississauga: { label: "City of Mississauga", url: "https://jobs.mississauga.ca/", domain: "jobs.mississauga.ca" },
  toronto: { label: "City of Toronto", url: "https://jobs.toronto.ca/", domain: "jobs.toronto.ca" },
  peel: { label: "Region of Peel", url: "https://peelregion.ca/careers/", domain: "peelregion.ca" },
  federal: { label: "Government of Canada", url: "https://emploisfp-psjobs.cfp-psc.gc.ca/", domain: "emploisfp-psjobs.cfp-psc.gc.ca" },
  linkedin: { label: "LinkedIn Jobs", url: "https://www.linkedin.com/jobs/", domain: "linkedin.com/jobs" },
  indeed: { label: "Indeed Canada", url: "https://ca.indeed.com/", domain: "ca.indeed.com" },
  oakville: { label: "Town of Oakville", url: "https://tre.tbe.taleo.net/tre01/ats/careers/v2/jobSearch?act=redirectCwsV2&cws=43&org=TOWNOFOA", domain: "tre.tbe.taleo.net" },
};

async function searchJobsWithGemini(
  targetRoles: string[],
  location: string,
  remotePreference: string,
  skills: string[],
  jobSites: string[],
  postedOn: string,
  targetIndustries: string[],
  customSites: {id: string; label: string; url: string}[] = []
): Promise<SearchedJob[]> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    tools: [{ googleSearch: {} }] as never,
  });

  const rolesQuery = targetRoles.length > 0 ? targetRoles.join(" OR ") : "software engineer";
  const skillsContext = skills.length > 0 ? `Key skills: ${skills.slice(0, 10).join(", ")}` : "";

  // Map posted_on to human-readable timeframe
  const timeframeMap: Record<string, string> = {
    "48h": "last 48 hours",
    "4d": "last 4 days",
    "7d": "last 7 days",
    "any": "any date",
  };
  const timeframe = timeframeMap[postedOn] || "last 48 hours";

  // Build site-specific search instructions
  const builtinSites = jobSites
    .map((id) => JOB_SITE_MAP[id])
    .filter(Boolean);
  const customSiteEntries = jobSites
    .filter((id) => id.startsWith("custom-"))
    .map((id) => {
      const cs = customSites.find((s) => s.id === id);
      if (!cs) return null;
      try {
        const domain = new URL(cs.url).hostname;
        return { label: cs.label, url: cs.url, domain };
      } catch { return null; }
    })
    .filter(Boolean) as {label: string; url: string; domain: string}[];
  const selectedSites = [...builtinSites, ...customSiteEntries];
  
  const siteNames = selectedSites.length > 0
    ? selectedSites.map((s) => `${s.label} (${s.url})`).join(", ")
    : "major Canadian job boards including LinkedIn, Indeed, and government job sites";

  const industryContext = targetIndustries.includes("all")
    ? "any industry"
    : targetIndustries.join(", ");

  const searchPrompt = `Search for current job postings for: ${rolesQuery}

Search these job sites: ${siteNames}

Search query examples to try:
${selectedSites.map((s) => `- "${rolesQuery}" site:${s.domain}`).join("\n")}
- "${rolesQuery}" ${selectedSites.map((s) => s.label).join(" OR ")}
- "${rolesQuery}" jobs Canada ${new Date().getFullYear()}

Requirements:
- Find jobs that are currently open/active (posted within the ${timeframe} preferred, but include any currently active postings if recent ones are scarce)
- Location: anywhere in Canada (remote, hybrid, or onsite are ALL acceptable)
- Industry focus: ${industryContext}
${skillsContext ? `- ${skillsContext}` : ""}
- Do NOT filter by work arrangement — include remote, hybrid, AND onsite jobs
- Try broader search terms if exact titles return no results (e.g. "architect" instead of "solution architect")

Return a JSON array of up to 5 jobs found. Each job must have this structure:
{
  "title": "exact job title from the posting",
  "company": "company/organization name",
  "location": "city, province or Remote",
  "salary_min": number or null,
  "salary_max": number or null,
  "salary_currency": "CAD",
  "job_url": "actual URL to the job posting",
  "job_description": "brief 2-3 sentence description of the role",
  "required_skills": ["skill1", "skill2", ...],
  "remote_type": "remote" | "hybrid" | "onsite",
  "posted_date": "YYYY-MM-DD"
}

IMPORTANT: Only return real jobs you actually found from your web search. Include the actual job posting URL. If you find fewer than 5, that's fine. If you find zero, return an empty array []. Return ONLY the JSON array, no other text.`;

  let responseText: string;
  try {
    // Try Gemini with Google Search grounding first
    const result = await model.generateContent(searchPrompt);
    responseText = result.response.text();
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("429")) {
      // Gemini rate limited — fall back to Groq (without web search)
      console.warn("Gemini rate limited for job search, falling back to Groq...");
      try {
        responseText = await callLLM(searchPrompt);
      } catch (fallbackErr) {
        if (fallbackErr instanceof AllProvidersExhaustedError) throw fallbackErr;
        throw fallbackErr;
      }
    } else {
      throw err;
    }
  }

  // Extract JSON from response
  console.log("Gemini search response (first 500 chars):", responseText.substring(0, 500));
  const jsonMatch = responseText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error("Failed to parse job search results. Full response:", responseText);
    return [];
  }

  try {
    const jobs: SearchedJob[] = JSON.parse(jsonMatch[0]);
    return jobs.map((job, index) => ({
      ...job,
      salary_currency: job.salary_currency || "CAD",
      remote_type: job.remote_type || "hybrid",
      posted_date: job.posted_date || new Date().toISOString().split("T")[0],
      job_url: job.job_url || "",
      required_skills: job.required_skills || [],
      salary_min: job.salary_min ?? null,
      salary_max: job.salary_max ?? null,
      title: job.title || `Job ${index + 1}`,
      company: job.company || "Unknown",
      location: job.location || "Canada",
      job_description: job.job_description || "",
    }));
  } catch (e) {
    console.error("JSON parse error:", e);
    return [];
  }
}

async function matchJobWithResume(
  job: SearchedJob,
  resumeData: { skills: string[]; experience: { title: string; company: string; years: number; description: string }[] },
  preferences: { salary_min: number; salary_max: number; remote_preference: string; dealbreakers: string[]; career_goals: string; target_industries: string[] }
): Promise<MatchResult> {
  const industryPref = preferences.target_industries.includes("all")
    ? "Open to all industries"
    : `Preferred industries: ${preferences.target_industries.join(", ")}`;

  const prompt = `You are a career matching expert. Score how well this job matches the candidate's profile.

JOB:
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location}
- Remote type: ${job.remote_type}
- Salary: ${job.salary_min ? `$${job.salary_min}` : "Not listed"} - ${job.salary_max ? `$${job.salary_max}` : "Not listed"} ${job.salary_currency}
- Description: ${job.job_description}
- Required skills: ${job.required_skills.join(", ")}

CANDIDATE:
- Skills: ${resumeData.skills.join(", ")}
- Experience: ${resumeData.experience.map((e) => `${e.title} at ${e.company} (${e.years}yr)`).join("; ")}
- Career goals: ${preferences.career_goals || "Not specified"}
- Salary range: $${preferences.salary_min} - $${preferences.salary_max} CAD
- Remote preference: ${preferences.remote_preference}
- ${industryPref}
- Dealbreakers: ${preferences.dealbreakers.length > 0 ? preferences.dealbreakers.join(", ") : "None specified"}

Score each dimension 0-100:
- skill_score: How well candidate's skills match required skills
- experience_score: How well their experience level/type aligns
- salary_score: How well the salary fits their range (100 if in range, lower if below)
- culture_score: How well remote type and other factors align with preferences

Also provide:
- match_score: Weighted total (skills 40%, experience 30%, salary 15%, culture 15%)
- matching_skills: Array of candidate skills that match this job
- missing_skills: Array of required skills the candidate lacks
- reasoning: One sentence explaining the match

Return ONLY valid JSON with this exact structure:
{"match_score":N,"skill_score":N,"experience_score":N,"salary_score":N,"culture_score":N,"matching_skills":[],"missing_skills":[],"reasoning":"..."}`;

  try {
    const responseText = await callLLM(prompt);
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return getDefaultScore(job, resumeData, preferences);
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      match_score: Math.min(100, Math.max(0, parsed.match_score || 0)),
      skill_score: Math.min(100, Math.max(0, parsed.skill_score || 0)),
      experience_score: Math.min(100, Math.max(0, parsed.experience_score || 0)),
      salary_score: Math.min(100, Math.max(0, parsed.salary_score || 0)),
      culture_score: Math.min(100, Math.max(0, parsed.culture_score || 0)),
      matching_skills: parsed.matching_skills || [],
      missing_skills: parsed.missing_skills || [],
      reasoning: parsed.reasoning || "",
    };
  } catch (e) {
    if (e instanceof AllProvidersExhaustedError) throw e;
    console.error("Match scoring error:", e);
    return getDefaultScore(job, resumeData, preferences);
  }
}

function getDefaultScore(
  job: SearchedJob,
  resumeData: { skills: string[] },
  preferences: { salary_min: number; salary_max: number }
): MatchResult {
  // Fallback rule-based scoring
  const normalizedUserSkills = resumeData.skills.map((s) => s.toLowerCase());
  const normalizedRequired = job.required_skills.map((s) => s.toLowerCase());
  const matching = normalizedRequired.filter((s) =>
    normalizedUserSkills.some((us) => us.includes(s) || s.includes(us))
  );
  const skillScore = normalizedRequired.length > 0
    ? Math.round((matching.length / normalizedRequired.length) * 100)
    : 50;

  let salaryScore = 70;
  if (job.salary_max && job.salary_min) {
    if (job.salary_max >= preferences.salary_min && job.salary_min <= preferences.salary_max) {
      salaryScore = 100;
    } else if (job.salary_max < preferences.salary_min) {
      salaryScore = 40;
    }
  }

  const total = Math.round(skillScore * 0.5 + 60 * 0.3 + salaryScore * 0.2);

  return {
    match_score: total,
    skill_score: skillScore,
    experience_score: 60,
    salary_score: salaryScore,
    culture_score: 70,
    matching_skills: matching,
    missing_skills: normalizedRequired.filter((s) => !matching.includes(s)),
    reasoning: "Scored using rule-based fallback",
  };
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Read search params from request body
    const body = await request.json().catch(() => ({}));
    const postedOn: string = body.posted_on || "48h";
    const requestedSites: string[] = body.job_sites || [];
    const requestedRole: string = body.job_role || "";

    // Fetch user preferences and resumes
    const [prefsResult, resumesResult] = await Promise.all([
      supabase.from("user_preferences").select("*").eq("user_id", user.id).single(),
      supabase.from("resumes").select("*").eq("user_id", user.id),
    ]);

    const preferences = prefsResult.data;
    const resumes = resumesResult.data;

    // Extract user profile from resumes
    const userSkills: string[] = [];
    const userExperience: { title: string; company: string; years: number; description: string }[] = [];
    if (resumes) {
      for (const resume of resumes) {
        if (resume.parsed_data?.skills) {
          userSkills.push(...resume.parsed_data.skills);
        }
        if (resume.parsed_data?.experience) {
          userExperience.push(...resume.parsed_data.experience);
        }
      }
    }
    const uniqueSkills = [...new Set(userSkills)];

    const userProfile = {
      skills: uniqueSkills,
      experience: userExperience,
    };

    const userPrefs = {
      salary_min: preferences?.salary_min || 80000,
      salary_max: preferences?.salary_max || 200000,
      remote_preference: preferences?.remote_preference || "remote",
      dealbreakers: preferences?.dealbreakers || [],
      career_goals: preferences?.career_goals || "",
      target_industries: preferences?.target_industries || ["all"],
    };

    // Step 1: Search for real jobs using Gemini + Google Search
    // Use request params, fall back to saved preferences
    const targetRoles = requestedRole
      ? requestedRole.split(",").map((r: string) => r.trim()).filter(Boolean)
      : (preferences?.target_roles || []);
    const jobSites = requestedSites.length > 0 ? requestedSites : (preferences?.job_sites || []);
    const jobs = await searchJobsWithGemini(
      targetRoles,
      "Canada",
      userPrefs.remote_preference,
      uniqueSkills.slice(0, 8),
      jobSites,
      postedOn,
      userPrefs.target_industries,
      preferences?.custom_job_sites || []
    );

    if (jobs.length === 0) {
      return NextResponse.json({ error: "No jobs found. Try broadening your preferences." }, { status: 404 });
    }

    // Step 2: Score each job against the resume using Gemini
    const searchBatchId = `batch-${Date.now()}`;
    const scoredJobs = await Promise.all(
      jobs.map(async (job, index) => {
        const matchResult = await matchJobWithResume(job, userProfile, userPrefs);

        return {
          user_id: user.id,
          job_id: `search-${Date.now()}-${index}`,
          search_batch_id: searchBatchId,
          title: job.title,
          company: job.company,
          location: job.location,
          salary_min: job.salary_min,
          salary_max: job.salary_max,
          salary_currency: job.salary_currency,
          job_url: job.job_url,
          job_description: job.job_description,
          match_score: matchResult.match_score,
          match_breakdown: {
            skill_score: matchResult.skill_score,
            experience_score: matchResult.experience_score,
            salary_score: matchResult.salary_score,
            culture_score: matchResult.culture_score,
            user_skills: matchResult.matching_skills,
            required_skills: job.required_skills,
            missing_skills: matchResult.missing_skills,
            reasoning: matchResult.reasoning,
          },
          remote_type: job.remote_type,
          matched_at: new Date().toISOString(),
          user_selected: false,
          selected_at: null,
        };
      })
    );

    // Sort by match score
    scoredJobs.sort((a, b) => b.match_score - a.match_score);

    // Step 3: Store new matches (keep history)
    const { data: savedJobs, error } = await supabase
      .from("jobs_matched")
      .insert(scoredJobs)
      .select();

    if (error) {
      console.error("Error storing jobs:", error);
      return NextResponse.json({ error: "Failed to store job matches" }, { status: 500 });
    }

    return NextResponse.json({ jobs: savedJobs });
  } catch (err) {
    console.error("Job matching error:", err);
    if (err instanceof AllProvidersExhaustedError) {
      return NextResponse.json(
        { error: "AI service rate limit reached. Please wait a few minutes and try again." },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
