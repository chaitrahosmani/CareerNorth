"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ResumeRecord } from "@/lib/types";
import {
  ArrowLeft,
  Upload,
  Link,
  Target,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Trash2,
  FileText,
  Copy,
  Check,
} from "lucide-react";

interface MatchResult {
  overall_score: number;
  skill_score: number;
  experience_score: number;
  salary_score: number;
  culture_score: number;
  job_title: string;
  company: string;
  location: string;
  matching_skills: string[];
  missing_skills: string[];
  pros: string[];
  cons: string[];
  summary: string;
  recommendations: string[];
}

interface SavedAnalysis {
  id: string;
  job_url: string;
  job_title: string | null;
  company: string | null;
  location: string | null;
  overall_score: number;
  skill_score: number;
  experience_score: number;
  salary_score: number;
  culture_score: number;
  matching_skills: string[];
  missing_skills: string[];
  pros: string[];
  cons: string[];
  summary: string | null;
  recommendations: string[];
  created_at: string;
}

export default function MatchPage() {
  const router = useRouter();
  const supabase = createClient();
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [jobUrl, setJobUrl] = useState("");
  const [selectedResumeId, setSelectedResumeId] = useState<string>("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [useUpload, setUseUpload] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [history, setHistory] = useState<SavedAnalysis[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [generatingCoverLetter, setGeneratingCoverLetter] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchResumes = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("resumes")
      .select("*")
      .eq("user_id", uid)
      .order("uploaded_at", { ascending: false });
    if (data) {
      setResumes(data);
      if (data.length > 0) setSelectedResumeId(data[0].id);
    }
  }, [supabase]);

  const fetchHistory = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("match_analyses")
      .select("id, job_url, job_title, company, location, overall_score, skill_score, experience_score, salary_score, culture_score, matching_skills, missing_skills, pros, cons, summary, recommendations, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setHistory(data);
  }, [supabase]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      fetchResumes(user.id);
      fetchHistory(user.id);
    };
    init();
  }, [router, supabase.auth, fetchResumes, fetchHistory]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("File size must be under 5MB.");
        return;
      }
      if (file.type !== "application/pdf") {
        setError("Only PDF files are accepted.");
        return;
      }
      setUploadedFile(file);
      setUseUpload(true);
      setError(null);
    }
  };

  const handleFindMatch = async () => {
    if (!jobUrl.trim()) {
      setError("Please enter a job posting URL.");
      return;
    }
    if (!useUpload && !selectedResumeId) {
      setError("Please select a resume or upload one.");
      return;
    }
    if (useUpload && !uploadedFile) {
      setError("Please upload a resume file.");
      return;
    }

    setError(null);
    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("jobUrl", jobUrl.trim());

      if (useUpload && uploadedFile) {
        formData.append("file", uploadedFile);
      } else {
        formData.append("resumeId", selectedResumeId);
      }

      const response = await fetch("/api/match", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const { error: errMsg } = await response.json();
        throw new Error(errMsg || "Match analysis failed");
      }

      const { match } = await response.json();
      setResult(match);
      // Refresh history
      const { data: { user } } = await supabase.auth.getUser();
      if (user) fetchHistory(user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze match");
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-500";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-green-100";
    if (score >= 60) return "bg-yellow-100";
    return "bg-red-100";
  };

  const handleViewHistory = (item: SavedAnalysis) => {
    setResult({
      overall_score: item.overall_score,
      skill_score: item.skill_score,
      experience_score: item.experience_score,
      salary_score: item.salary_score,
      culture_score: item.culture_score,
      job_title: item.job_title || "Unknown Role",
      company: item.company || "Unknown Company",
      location: item.location || "",
      matching_skills: item.matching_skills || [],
      missing_skills: item.missing_skills || [],
      pros: item.pros || [],
      cons: item.cons || [],
      summary: item.summary || "",
      recommendations: item.recommendations || [],
    });
  };

  const handleToggleExpand = (id: string) => {
    setExpandedHistoryId((prev) => (prev === id ? null : id));
  };

  const handleDeleteAnalysis = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await supabase.from("match_analyses").delete().eq("id", id);
    setHistory((prev) => prev.filter((item) => item.id !== id));
    if (expandedHistoryId === id) setExpandedHistoryId(null);
  };

  const handleGenerateCoverLetter = async () => {
    if (!result) return;
    setGeneratingCoverLetter(true);
    setCoverLetter(null);
    try {
      const res = await fetch("/api/generate/cover-letter-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: result.job_title,
          company: result.company,
          jobUrl,
          matchingSkills: result.matching_skills,
          recommendations: result.recommendations,
          resumeId: selectedResumeId || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCoverLetter(data.content);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to generate cover letter");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to generate cover letter");
    }
    setGeneratingCoverLetter(false);
  };

  const handleCopyToClipboard = async () => {
    if (!coverLetter) return;
    await navigator.clipboard.writeText(coverLetter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-3xl mx-auto space-y-6 pt-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Dashboard
          </Button>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Job Match Analysis</h1>
          <p className="text-muted-foreground">
            Enter a job posting URL and select your resume to see how well you match.
          </p>
        </div>

        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-600" />
              Match Parameters
            </CardTitle>
            <CardDescription>
              Provide a job posting URL and your resume for AI-powered match analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Job URL */}
            <div className="space-y-2">
              <Label htmlFor="job-url" className="font-medium flex items-center gap-2">
                <Link className="w-4 h-4" />
                Job Posting URL
              </Label>
              <Input
                id="job-url"
                type="url"
                placeholder="https://www.linkedin.com/jobs/view/..."
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Paste the full URL of the job posting (LinkedIn, Indeed, company career page, etc.)
              </p>
            </div>

            <Separator />

            {/* Resume Selection */}
            <div className="space-y-3">
              <Label className="font-medium">Resume</Label>

              {/* Option 1: Use existing resume */}
              {resumes.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="use-existing"
                      name="resume-source"
                      checked={!useUpload}
                      onChange={() => setUseUpload(false)}
                      className="w-4 h-4"
                    />
                    <label htmlFor="use-existing" className="text-sm font-medium cursor-pointer">
                      Use uploaded resume
                    </label>
                  </div>
                  {!useUpload && (
                    <Select value={selectedResumeId} onValueChange={setSelectedResumeId}>
                      <SelectTrigger className="ml-6">
                        <SelectValue placeholder="Select a resume" />
                      </SelectTrigger>
                      <SelectContent>
                        {resumes.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.file_name} {r.parsed_data ? "✓" : "(not parsed)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* Option 2: Upload new resume */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="use-upload"
                    name="resume-source"
                    checked={useUpload}
                    onChange={() => setUseUpload(true)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="use-upload" className="text-sm font-medium cursor-pointer">
                    Upload a different resume
                  </label>
                </div>
                {useUpload && (
                  <div className="ml-6">
                    <label
                      htmlFor="resume-upload"
                      className="flex items-center gap-2 border-2 border-dashed rounded-lg p-4 cursor-pointer hover:border-indigo-400 transition-colors"
                    >
                      <Upload className="w-5 h-5 text-gray-400" />
                      <span className="text-sm">
                        {uploadedFile ? uploadedFile.name : "Click to upload PDF (max 5MB)"}
                      </span>
                    </label>
                    <input
                      id="resume-upload"
                      type="file"
                      accept=".pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-md">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <Button
              onClick={handleFindMatch}
              disabled={loading || !jobUrl.trim()}
              className="w-full h-12 text-base"
            >
              {loading ? "Analyzing Match..." : "Find the Match"}
            </Button>

            {loading && (
              <div className="space-y-2">
                <Progress value={65} className="h-2" />
                <p className="text-xs text-center text-muted-foreground">
                  Fetching job posting and analyzing match with AI... This may take 15–30 seconds.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Overall Score */}
            <Card>
              <CardContent className="p-6">
                <div className="text-center space-y-3">
                  <h2 className="text-lg font-semibold">
                    {result.job_title} at {result.company}
                  </h2>
                  {result.location && (
                    <p className="text-sm text-muted-foreground">{result.location}</p>
                  )}
                  <div className={`text-5xl font-bold ${getScoreColor(result.overall_score)}`}>
                    {result.overall_score}%
                  </div>
                  <p className="text-sm text-muted-foreground">Overall Match Score</p>
                  <p className="text-sm max-w-lg mx-auto">{result.summary}</p>
                </div>
              </CardContent>
            </Card>

            {/* Score Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Score Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Skills", score: result.skill_score },
                    { label: "Experience", score: result.experience_score },
                    { label: "Salary", score: result.salary_score },
                    { label: "Culture Fit", score: result.culture_score },
                  ].map(({ label, score }) => (
                    <div key={label} className={`rounded-lg p-4 text-center ${getScoreBg(score)}`}>
                      <div className={`text-2xl font-bold ${getScoreColor(score)}`}>
                        {score}%
                      </div>
                      <p className="text-xs font-medium mt-1">{label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Skills */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Skills Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> Matching Skills
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {result.matching_skills.map((skill) => (
                      <Badge key={skill} variant="secondary" className="bg-green-100 text-green-800">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
                {result.missing_skills.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1">
                      <XCircle className="w-4 h-4" /> Missing Skills
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {result.missing_skills.map((skill) => (
                        <Badge key={skill} variant="destructive" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pros & Cons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-green-700">
                    <TrendingUp className="w-5 h-5" />
                    Pros
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {result.pros.map((pro, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        {pro}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-red-700">
                    <TrendingDown className="w-5 h-5" />
                    Cons
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {result.cons.map((con, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                        {con}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Recommendations */}
            {result.recommendations && result.recommendations.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-yellow-500" />
                    Recommendations to Improve Your Chances
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {result.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="font-medium text-indigo-600 flex-shrink-0">{i + 1}.</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Generate Cover Letter */}
            <Card>
              <CardContent className="p-6">
                <Button
                  onClick={handleGenerateCoverLetter}
                  disabled={generatingCoverLetter}
                  className="w-full h-12 gap-2"
                >
                  <FileText className="w-5 h-5" />
                  {generatingCoverLetter ? "Generating Cover Letter..." : "Generate Cover Letter"}
                </Button>
                {generatingCoverLetter && (
                  <div className="mt-3 space-y-2">
                    <Progress value={60} className="h-2" />
                    <p className="text-xs text-center text-muted-foreground">
                      AI is writing your cover letter...
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cover Letter Result */}
            {coverLetter && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-600" />
                      Cover Letter
                    </CardTitle>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={handleCopyToClipboard}
                    >
                      {copied ? (
                        <><Check className="w-3 h-3" /> Copied!</>
                      ) : (
                        <><Copy className="w-3 h-3" /> Copy to Clipboard</>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-wrap text-sm bg-white border rounded-md p-4">
                    {coverLetter}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Try Again */}
            <div className="text-center pb-8">
              <Button variant="outline" onClick={() => { setResult(null); setCoverLetter(null); }}>
                Analyze Another Job
              </Button>
            </div>
          </div>
        )}

        {/* History Section */}
        {history.length > 0 && !result && (
          <Card>
            <CardHeader
              className="cursor-pointer select-none"
              onClick={() => setHistoryExpanded(!historyExpanded)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Previous Analyses</CardTitle>
                  <CardDescription>Your recent job match results (auto-saved) — {history.length} result{history.length !== 1 ? "s" : ""}</CardDescription>
                </div>
                {historyExpanded ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
            {historyExpanded && (
              <CardContent>
                <div className="space-y-3">
                  {history.map((item) => (
                    <div key={item.id} className="rounded-lg border overflow-hidden">
                      {/* Header row — click to expand/collapse */}
                      <div
                        className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => handleToggleExpand(item.id)}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {expandedHistoryId === item.id ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          )}
                          <div className="space-y-0.5 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {item.job_title || "Unknown Role"} {item.company ? `at ${item.company}` : ""}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {new Date(item.created_at).toLocaleDateString()} — {item.job_url.length > 50 ? item.job_url.slice(0, 50) + "..." : item.job_url}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className={`text-lg font-bold ${getScoreColor(item.overall_score)}`}>
                            {item.overall_score}%
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                            onClick={(e) => handleDeleteAnalysis(e, item.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Expanded details */}
                      {expandedHistoryId === item.id && (
                        <div className="border-t px-4 py-3 bg-gray-50/50 space-y-3">
                          {/* Score breakdown */}
                          <div className="grid grid-cols-4 gap-2">
                            {[
                              { label: "Skills", score: item.skill_score },
                              { label: "Experience", score: item.experience_score },
                              { label: "Salary", score: item.salary_score },
                              { label: "Culture", score: item.culture_score },
                            ].map(({ label, score }) => (
                              <div key={label} className={`rounded p-2 text-center ${getScoreBg(score)}`}>
                                <div className={`text-sm font-bold ${getScoreColor(score)}`}>{score}%</div>
                                <p className="text-[10px] font-medium">{label}</p>
                              </div>
                            ))}
                          </div>

                          {/* Summary */}
                          {item.summary && (
                            <p className="text-xs text-muted-foreground">{item.summary}</p>
                          )}

                          {/* Skills */}
                          {item.matching_skills.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-green-700 mb-1">Matching Skills:</p>
                              <div className="flex flex-wrap gap-1">
                                {item.matching_skills.slice(0, 8).map((s) => (
                                  <Badge key={s} variant="secondary" className="text-[10px] bg-green-100 text-green-800">{s}</Badge>
                                ))}
                                {item.matching_skills.length > 8 && (
                                  <Badge variant="secondary" className="text-[10px]">+{item.matching_skills.length - 8} more</Badge>
                                )}
                              </div>
                            </div>
                          )}
                          {item.missing_skills.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-red-700 mb-1">Missing Skills:</p>
                              <div className="flex flex-wrap gap-1">
                                {item.missing_skills.slice(0, 6).map((s) => (
                                  <Badge key={s} variant="destructive" className="text-[10px]">{s}</Badge>
                                ))}
                                {item.missing_skills.length > 6 && (
                                  <Badge variant="secondary" className="text-[10px]">+{item.missing_skills.length - 6} more</Badge>
                                )}
                              </div>
                            </div>
                          )}

                          {/* View full button */}
                          <div className="flex gap-2 pt-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={() => handleViewHistory(item)}
                            >
                              View Full Analysis
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
