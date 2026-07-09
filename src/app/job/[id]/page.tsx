"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import type { JobMatch } from "@/lib/types";
import {
  ArrowLeft,
  FileText,
  MessageSquare,
  Download,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface InterviewQuestion {
  question: string;
  why_asked: string;
  sample_answer: string;
  pitfalls: string[];
}

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const [job, setJob] = useState<JobMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingResume, setGeneratingResume] = useState(false);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [generatingInterview, setGeneratingInterview] = useState(false);
  const [tailoredResume, setTailoredResume] = useState<string | null>(null);
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [interviewQuestions, setInterviewQuestions] = useState<InterviewQuestion[]>([]);
  const [talkingPoints, setTalkingPoints] = useState<string[]>([]);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);

  const fetchJob = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    const { data } = await supabase
      .from("jobs_matched")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (data) setJob(data);
    setLoading(false);
  }, [supabase, id, router]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  const handleGenerateResume = async () => {
    if (!job) return;
    setGeneratingResume(true);
    try {
      const res = await fetch("/api/generate/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setTailoredResume(data.content);
      } else {
        alert(data.error || "Failed to generate tailored resume");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to generate tailored resume. Please try again.");
    }
    setGeneratingResume(false);
  };

  const handleGenerateCoverLetter = async () => {
    if (!job) return;
    setGeneratingCover(true);
    try {
      const res = await fetch("/api/generate/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setCoverLetter(data.content);
      } else {
        alert(data.error || "Failed to generate cover letter");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to generate cover letter. Please try again.");
    }
    setGeneratingCover(false);
  };

  const handleGenerateInterviewPrep = async () => {
    if (!job) return;
    setGeneratingInterview(true);
    try {
      const res = await fetch("/api/generate/interview-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setInterviewQuestions(data.questions);
        setTalkingPoints(data.talking_points);
      } else {
        alert(data.error || "Failed to generate interview prep");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to generate interview prep. Please try again.");
    }
    setGeneratingInterview(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Loading job details...</div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Job not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold text-lg">{job.title}</h1>
            <p className="text-sm text-muted-foreground">{job.company} • {job.location}</p>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${
              job.match_score >= 80 ? "text-green-600" :
              job.match_score >= 60 ? "text-yellow-600" : "text-red-500"
            }`}>
              {job.match_score}%
            </div>
            <p className="text-xs text-muted-foreground">Match</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Job Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>Job Details</CardTitle>
            <CardDescription>
              {job.salary_min && job.salary_max && (
                <span>${job.salary_min.toLocaleString()} – ${job.salary_max.toLocaleString()} {job.salary_currency} • </span>
              )}
              <Badge variant="secondary">{job.remote_type}</Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">{job.job_description}</p>
            <Separator />
            <div className="grid grid-cols-3 gap-4 text-center text-sm">
              <div>
                <p className="font-medium text-lg">{job.match_breakdown.skill_score}%</p>
                <p className="text-muted-foreground">Skills</p>
              </div>
              <div>
                <p className="font-medium text-lg">{job.match_breakdown.experience_score}%</p>
                <p className="text-muted-foreground">Experience</p>
              </div>
              <div>
                <p className="font-medium text-lg">{job.match_breakdown.salary_score}%</p>
                <p className="text-muted-foreground">Salary Fit</p>
              </div>
            </div>
            <Separator />
            <div>
              <p className="text-sm font-medium mb-2">Your Matching Skills:</p>
              <div className="flex flex-wrap gap-1">
                {job.match_breakdown.user_skills.map((s) => (
                  <Badge key={s} variant="default" className="text-xs">{s}</Badge>
                ))}
              </div>
            </div>
            {job.match_breakdown.missing_skills.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Missing Skills:</p>
                <div className="flex flex-wrap gap-1">
                  {job.match_breakdown.missing_skills.map((s) => (
                    <Badge key={s} variant="destructive" className="text-xs">{s}</Badge>
                  ))}
                </div>
              </div>
            )}
            {job.job_url && (
              <a href={job.job_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="w-3 h-3 mr-1" /> View Original Posting
                </Button>
              </a>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            onClick={handleGenerateResume}
            disabled={generatingResume}
            className="h-14 gap-2"
          >
            <FileText className="w-5 h-5" />
            {generatingResume ? "Generating..." : "Generate Tailored Resume"}
          </Button>
          <Button
            onClick={handleGenerateCoverLetter}
            disabled={generatingCover}
            variant="outline"
            className="h-14 gap-2"
          >
            <FileText className="w-5 h-5" />
            {generatingCover ? "Generating..." : "Generate Cover Letter"}
          </Button>
          <Button
            onClick={handleGenerateInterviewPrep}
            disabled={generatingInterview}
            variant="outline"
            className="h-14 gap-2"
          >
            <MessageSquare className="w-5 h-5" />
            {generatingInterview ? "Generating..." : "Prepare for Interview"}
          </Button>
        </div>

        {/* Generated Resume */}
        {generatingResume && (
          <Card>
            <CardContent className="p-6 text-center">
              <Progress value={60} className="max-w-xs mx-auto mb-3" />
              <p className="text-sm">AI is tailoring your resume for this role...</p>
            </CardContent>
          </Card>
        )}
        {tailoredResume && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Tailored Resume</CardTitle>
                <Button size="sm" variant="outline" className="gap-1">
                  <Download className="w-3 h-3" /> Download .docx
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-md">
                {tailoredResume}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Generated Cover Letter */}
        {generatingCover && (
          <Card>
            <CardContent className="p-6 text-center">
              <Progress value={60} className="max-w-xs mx-auto mb-3" />
              <p className="text-sm">AI is writing your cover letter...</p>
            </CardContent>
          </Card>
        )}
        {coverLetter && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Cover Letter</CardTitle>
                <Button size="sm" variant="outline" className="gap-1">
                  <Download className="w-3 h-3" /> Download .docx
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-md">
                {coverLetter}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Interview Prep */}
        {generatingInterview && (
          <Card>
            <CardContent className="p-6 text-center">
              <Progress value={60} className="max-w-xs mx-auto mb-3" />
              <p className="text-sm">AI is generating interview questions...</p>
            </CardContent>
          </Card>
        )}
        {interviewQuestions.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Interview Preparation</CardTitle>
                <Button size="sm" variant="outline" className="gap-1">
                  <Download className="w-3 h-3" /> Download PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {talkingPoints.length > 0 && (
                <div className="bg-blue-50 p-4 rounded-md mb-4">
                  <p className="font-medium text-sm mb-2">Company Talking Points:</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {talkingPoints.map((point, i) => (
                      <li key={i}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}

              {interviewQuestions.map((q, i) => (
                <div key={i} className="border rounded-md">
                  <button
                    className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50"
                    onClick={() => setExpandedQuestion(expandedQuestion === i ? null : i)}
                  >
                    <span className="font-medium text-sm">
                      {i + 1}. {q.question}
                    </span>
                    {expandedQuestion === i ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                  {expandedQuestion === i && (
                    <div className="px-4 pb-4 space-y-3 text-sm">
                      <div>
                        <p className="font-medium text-indigo-700">Why it&apos;s asked:</p>
                        <p className="text-muted-foreground">{q.why_asked}</p>
                      </div>
                      <div>
                        <p className="font-medium text-green-700">Sample Answer (STAR format):</p>
                        <p className="text-muted-foreground">{q.sample_answer}</p>
                      </div>
                      <div>
                        <p className="font-medium text-red-700">Pitfalls to Avoid:</p>
                        <ul className="list-disc list-inside text-muted-foreground">
                          {q.pitfalls.map((p, j) => (
                            <li key={j}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
