"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { JobMatch } from "@/lib/types";
import {
  ArrowLeft,
  Search,
  ExternalLink,
  Briefcase,
  Loader2,
} from "lucide-react";

const JOB_SITES = [
  { id: "gojobs", label: "Ontario Public Service" },
  { id: "federal", label: "Government of Canada" },
  { id: "toronto", label: "City of Toronto" },
  { id: "mississauga", label: "City of Mississauga" },
  { id: "peel", label: "Region of Peel" },
  { id: "oakville", label: "Town of Oakville" },
  { id: "linkedin", label: "LinkedIn Jobs" },
  { id: "indeed", label: "Indeed Canada" },
];

export default function JobsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobMatch[]>([]);
  const [previousJobs, setPreviousJobs] = useState<JobMatch[]>([]);
  const [jobRole, setJobRole] = useState("");
  const [postedOn, setPostedOn] = useState("48h");
  const [selectedSites, setSelectedSites] = useState<string[]>([]);
  const [hasPreferences, setHasPreferences] = useState(false);

  const fetchPreviousJobs = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("jobs_matched")
      .select("*")
      .eq("user_id", uid)
      .order("matched_at", { ascending: false })
      .limit(10);
    if (data) setPreviousJobs(data);
  }, [supabase]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      // Load saved preferences for defaults
      const { data: prefs } = await supabase
        .from("user_preferences")
        .select("target_roles, job_sites")
        .eq("user_id", user.id)
        .single();
      if (prefs) {
        setHasPreferences(true);
        if (prefs.target_roles?.length > 0) {
          setJobRole(prefs.target_roles.join(", "));
        }
        if (prefs.job_sites?.length > 0) {
          setSelectedSites(prefs.job_sites);
        }
      }
      fetchPreviousJobs(user.id);
    };
    init();
  }, [router, supabase, fetchPreviousJobs]);

  const handleSearch = async () => {
    setError(null);
    setLoading(true);
    setJobs([]);

    try {
      const response = await fetch("/api/jobs/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_role: jobRole,
          job_sites: selectedSites,
          posted_on: postedOn,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to find matching jobs");
      }

      const data = await response.json();
      setJobs(data.jobs || []);
      // Refresh previous jobs
      const { data: { user } } = await supabase.auth.getUser();
      if (user) fetchPreviousJobs(user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const toggleSite = (siteId: string) => {
    setSelectedSites((prev) =>
      prev.includes(siteId)
        ? prev.filter((s) => s !== siteId)
        : [...prev, siteId]
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-500";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto space-y-6 pt-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Dashboard
          </Button>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Find Matching Jobs</h1>
          <p className="text-muted-foreground">
            Search job boards and get AI-powered match scores against your resume.
          </p>
        </div>

        {/* Search Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-600" />
              Search Filters
            </CardTitle>
            <CardDescription>
              {hasPreferences
                ? "Defaults loaded from your preferences. Adjust as needed."
                : "Set your search criteria below."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Job Role */}
            <div className="space-y-2">
              <Label htmlFor="job-role" className="font-medium">Job Role / Title</Label>
              <Input
                id="job-role"
                placeholder="e.g. Solution Architect, IT Project Manager"
                value={jobRole}
                onChange={(e) => setJobRole(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated roles. Leave blank to use your saved preferences.
              </p>
            </div>

            {/* Posted Within */}
            <div className="space-y-2">
              <Label className="font-medium">Posted Within</Label>
              <Select value={postedOn} onValueChange={(val) => setPostedOn(val ?? "48h")}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="48h">Last 48 hours</SelectItem>
                  <SelectItem value="4d">Last 4 days</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="any">Any time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Job Sites */}
            <div className="space-y-2">
              <Label className="font-medium">Job Sites to Search</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {JOB_SITES.map((site) => (
                  <label key={site.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selectedSites.includes(site.id)}
                      onCheckedChange={() => toggleSite(site.id)}
                    />
                    <span className="text-sm">{site.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Select which job boards to search. Leave empty to use your saved preferences.
              </p>
            </div>

            {/* Search Button */}
            <Button
              className="w-full"
              onClick={handleSearch}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Searching & scoring jobs...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Find Matching Jobs
                </>
              )}
            </Button>

            {error && (
              <p className="text-sm text-red-600 text-center">{error}</p>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {jobs.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">New Matches ({jobs.length})</h2>
            {jobs.map((job) => (
              <Card
                key={job.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push(`/job/${job.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-muted-foreground" />
                        <h3 className="font-semibold">{job.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {job.company} • {job.location}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {job.job_description}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Badge variant="secondary">{job.remote_type}</Badge>
                        {job.salary_min && job.salary_max && (
                          <Badge variant="secondary">
                            ${job.salary_min.toLocaleString()} – ${job.salary_max.toLocaleString()}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-2xl font-bold ${getScoreColor(job.match_score)}`}>
                        {job.match_score}%
                      </div>
                      <p className="text-xs text-muted-foreground">Match</p>
                      {job.job_url && (
                        <a
                          href={job.job_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 flex items-center gap-1 mt-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3" />
                          View posting
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Previous Matches */}
        {previousJobs.length > 0 && jobs.length === 0 && !loading && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Previous Matches</h2>
            {previousJobs.map((job) => (
              <Card
                key={job.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push(`/job/${job.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-muted-foreground" />
                        <h3 className="font-semibold">{job.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {job.company} • {job.location}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Badge variant="secondary">{job.remote_type}</Badge>
                        {job.salary_min && job.salary_max && (
                          <Badge variant="secondary">
                            ${job.salary_min.toLocaleString()} – ${job.salary_max.toLocaleString()}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-2xl font-bold ${getScoreColor(job.match_score)}`}>
                        {job.match_score}%
                      </div>
                      <p className="text-xs text-muted-foreground">Match</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
