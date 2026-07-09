-- CareerNorth Database Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Table: user_preferences
-- Stores career preferences from the 7-question flow
-- ============================================
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  career_goals TEXT,
  target_roles TEXT[] DEFAULT '{}',
  industry_openness BOOLEAN DEFAULT FALSE,
  target_industries TEXT[] DEFAULT '{}',
  salary_min INTEGER DEFAULT 80000,
  salary_max INTEGER DEFAULT 200000,
  remote_preference TEXT DEFAULT 'remote' CHECK (remote_preference IN ('remote', 'hybrid', 'onsite', 'any')),
  dealbreakers TEXT[] DEFAULT '{}',
  current_frustration TEXT,
  skills_to_develop TEXT[] DEFAULT '{}',
  job_sites TEXT[] DEFAULT '{}',
  custom_job_sites JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================
-- Table: resumes
-- Stores uploaded resume files and parsed data
-- ============================================
CREATE TABLE IF NOT EXISTS resumes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  parsed_data JSONB,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  parsed_at TIMESTAMPTZ
);

-- ============================================
-- Table: jobs_matched
-- Stores job matches with relevance scores
-- ============================================
CREATE TABLE IF NOT EXISTS jobs_matched (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL,
  search_batch_id TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  salary_min INTEGER,
  salary_max INTEGER,
  salary_currency TEXT DEFAULT 'CAD',
  job_url TEXT,
  job_description TEXT,
  match_score INTEGER DEFAULT 0 CHECK (match_score >= 0 AND match_score <= 100),
  match_breakdown JSONB,
  remote_type TEXT DEFAULT 'remote' CHECK (remote_type IN ('remote', 'hybrid', 'onsite')),
  matched_at TIMESTAMPTZ DEFAULT NOW(),
  user_selected BOOLEAN DEFAULT FALSE,
  selected_at TIMESTAMPTZ
);

-- ============================================
-- Table: resumes_tailored
-- Stores AI-tailored resume versions
-- ============================================
CREATE TABLE IF NOT EXISTS resumes_tailored (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs_matched(id) ON DELETE SET NULL,
  original_resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
  tailored_content JSONB,
  download_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  downloaded_at TIMESTAMPTZ
);

-- ============================================
-- Table: cover_letters
-- Stores generated cover letters
-- ============================================
CREATE TABLE IF NOT EXISTS cover_letters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs_matched(id) ON DELETE SET NULL,
  original_resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
  company_name TEXT,
  generated_content TEXT,
  download_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  downloaded_at TIMESTAMPTZ
);

-- ============================================
-- Table: interview_prep
-- Stores interview preparation data
-- ============================================
CREATE TABLE IF NOT EXISTS interview_prep (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs_matched(id) ON DELETE SET NULL,
  questions JSONB DEFAULT '[]',
  talking_points JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Row Level Security (RLS) Policies
-- Users can only access their own data
-- ============================================

-- Enable RLS on all tables
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs_matched ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes_tailored ENABLE ROW LEVEL SECURITY;
ALTER TABLE cover_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_prep ENABLE ROW LEVEL SECURITY;

-- user_preferences policies
CREATE POLICY "Users can view own preferences" ON user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own preferences" ON user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON user_preferences FOR UPDATE USING (auth.uid() = user_id);

-- resumes policies
CREATE POLICY "Users can view own resumes" ON resumes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own resumes" ON resumes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own resumes" ON resumes FOR DELETE USING (auth.uid() = user_id);

-- jobs_matched policies
CREATE POLICY "Users can view own job matches" ON jobs_matched FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own job matches" ON jobs_matched FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own job matches" ON jobs_matched FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own job matches" ON jobs_matched FOR DELETE USING (auth.uid() = user_id);

-- resumes_tailored policies
CREATE POLICY "Users can view own tailored resumes" ON resumes_tailored FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tailored resumes" ON resumes_tailored FOR INSERT WITH CHECK (auth.uid() = user_id);

-- cover_letters policies
CREATE POLICY "Users can view own cover letters" ON cover_letters FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cover letters" ON cover_letters FOR INSERT WITH CHECK (auth.uid() = user_id);

-- interview_prep policies
CREATE POLICY "Users can view own interview prep" ON interview_prep FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own interview prep" ON interview_prep FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- Table: match_analyses
-- Stores job match analysis results (URL-based matching)
-- ============================================
CREATE TABLE IF NOT EXISTS match_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_url TEXT NOT NULL,
  job_title TEXT,
  company TEXT,
  location TEXT,
  overall_score INTEGER DEFAULT 0 CHECK (overall_score >= 0 AND overall_score <= 100),
  skill_score INTEGER DEFAULT 0,
  experience_score INTEGER DEFAULT 0,
  salary_score INTEGER DEFAULT 0,
  culture_score INTEGER DEFAULT 0,
  matching_skills TEXT[] DEFAULT '{}',
  missing_skills TEXT[] DEFAULT '{}',
  pros TEXT[] DEFAULT '{}',
  cons TEXT[] DEFAULT '{}',
  summary TEXT,
  recommendations TEXT[] DEFAULT '{}',
  job_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- match_analyses RLS
ALTER TABLE match_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own match analyses" ON match_analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own match analyses" ON match_analyses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own match analyses" ON match_analyses FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Storage bucket for resumes
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload their own resumes" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'resumes' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view their own resumes" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'resumes' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own resumes" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'resumes' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================
-- Updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
