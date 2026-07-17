import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  FileText,
  Search,
  Mail,
  MessageSquare,
  Clock,
  TrendingUp,
  Sparkles,
  ArrowRight,
} from "lucide-react";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">CN</span>
          </div>
          <span className="text-xl font-bold text-gray-900">CareerNorth</span>
        </div>
        <Link
          href="/login"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          Sign in
        </Link>
      </header>

      {/* Hero Section */}
      <section className="px-6 pt-16 pb-20 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
          <Sparkles className="w-4 h-4" />
          AI-Powered Career Mentoring
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight leading-tight">
          Find better jobs,{" "}
          <span className="text-indigo-600">faster.</span>
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
          CareerNorth is your AI career mentor — helping mid-career professionals
          in Canada tailor resumes, discover matched jobs, craft cover letters,
          and prepare for interviews, all in one place.
        </p>
        <div className="mt-10">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-4 rounded-xl text-lg shadow-lg shadow-indigo-200 transition-all hover:shadow-xl hover:shadow-indigo-300"
          >
            Check it now
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-20 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
          What CareerNorth does for you
        </h2>
        <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
          Four powerful AI tools designed to accelerate your job search and help
          you land the right role.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard
            icon={<FileText className="w-6 h-6" />}
            title="AI Resume Tailoring"
            description="Upload your resume and get it tailored to specific job postings with AI-powered suggestions."
          />
          <FeatureCard
            icon={<Search className="w-6 h-6" />}
            title="Smart Job Matching"
            description="Discover jobs that match your skills, experience, and preferences — ranked by fit."
          />
          <FeatureCard
            icon={<Mail className="w-6 h-6" />}
            title="Cover Letter Generation"
            description="Generate personalized cover letters that highlight your relevant experience for each role."
          />
          <FeatureCard
            icon={<MessageSquare className="w-6 h-6" />}
            title="Interview Prep Coach"
            description="Practice with AI-generated interview questions tailored to the job you're applying for."
          />
        </div>
      </section>

      {/* Why CareerNorth Section */}
      <section className="px-6 py-20 bg-white/60">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Why professionals choose CareerNorth
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            <ValueProp
              icon={<Clock className="w-8 h-8 text-indigo-600" />}
              title="Save Hours Every Week"
              description="Stop spending hours rewriting resumes and cover letters. Let AI handle the heavy lifting so you can focus on networking and interviews."
            />
            <ValueProp
              icon={<TrendingUp className="w-8 h-8 text-indigo-600" />}
              title="Land Better Roles"
              description="AI-powered matching ensures you apply to jobs where you're a strong fit — increasing your interview rate and offer potential."
            />
            <ValueProp
              icon={<Sparkles className="w-8 h-8 text-indigo-600" />}
              title="AI-Powered Insights"
              description="Get actionable feedback on your resume, understand how well you match a role, and prepare with targeted interview questions."
            />
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="px-6 py-20 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to accelerate your career?
          </h2>
          <p className="text-gray-600 text-lg mb-8">
            Join CareerNorth today and let AI guide your next career move.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-4 rounded-xl text-lg shadow-lg shadow-indigo-200 transition-all hover:shadow-xl hover:shadow-indigo-300"
          >
            Check it now
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-gray-200 text-center text-sm text-gray-500">
        <p>&copy; 2025 CareerNorth. AI-powered career mentoring for mid-career professionals.</p>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}

function ValueProp({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-50 rounded-2xl mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}

