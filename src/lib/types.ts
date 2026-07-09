export interface UserPreferences {
  career_goals: string;
  target_roles: string[];
  industry_openness: boolean;
  salary_min: number;
  salary_max: number;
  remote_preference: "remote" | "hybrid" | "onsite";
  dealbreakers: string[];
  current_frustration: string;
  skills_to_develop: string[];
  job_sites: string[];
}

export interface ParsedResume {
  name: string;
  skills: string[];
  experience: {
    title: string;
    company: string;
    start_date: string;
    end_date: string;
    years: number;
    description: string;
  }[];
  education: {
    degree: string;
    school: string;
    graduation_year: number;
  }[];
}

export interface ResumeRecord {
  id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  parsed_data: ParsedResume | null;
  uploaded_at: string;
  parsed_at: string | null;
}

export interface JobMatch {
  id: string;
  user_id: string;
  job_id: string;
  search_batch_id: string;
  title: string;
  company: string;
  location: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  job_url: string;
  job_description: string;
  match_score: number;
  match_breakdown: {
    skill_score: number;
    experience_score: number;
    salary_score: number;
    culture_score?: number;
    user_skills: string[];
    required_skills: string[];
    missing_skills: string[];
    reasoning?: string;
  };
  remote_type: "remote" | "hybrid" | "onsite";
  matched_at: string;
  user_selected: boolean;
  selected_at: string | null;
}
