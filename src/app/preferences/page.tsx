"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Home } from "lucide-react";

const TOTAL_QUESTIONS = 8;

const DEALBREAKER_OPTIONS = [
  "Relocation required",
  "Frequent travel (>25%)",
  "Shift work / nights",
  "On-call requirements",
  "No remote option",
  "Contract / no benefits",
];

const INDUSTRY_OPTIONS = [
  { id: "all", label: "All Industries (does not matter)" },
  { id: "government", label: "Government / Public Sector" },
  { id: "healthcare", label: "Healthcare" },
  { id: "finance", label: "Finance & Banking" },
  { id: "technology", label: "Technology / IT" },
  { id: "education", label: "Education" },
  { id: "construction", label: "Construction & Engineering" },
  { id: "transportation", label: "Transportation & Logistics" },
  { id: "energy", label: "Energy & Utilities" },
  { id: "retail", label: "Retail & Consumer Services" },
  { id: "nonprofit", label: "Non-Profit / Social Services" },
];

const JOB_SITE_OPTIONS = [
  { id: "gojobs", label: "Ontario Public Service", url: "https://www.gojobs.gov.on.ca/" },
  { id: "toronto", label: "City of Toronto", url: "https://jobs.toronto.ca/" },
  { id: "federal", label: "Government of Canada (Federal)", url: "https://emploisfp-psjobs.cfp-psc.gc.ca/" },
  { id: "jobbank", label: "Job Bank (GC)", url: "https://www.jobbank.gc.ca/" },
  { id: "linkedin", label: "LinkedIn Jobs", url: "https://www.linkedin.com/jobs/" },
  { id: "indeed", label: "Indeed Canada", url: "https://ca.indeed.com/" },
  { id: "glassdoor", label: "Glassdoor Canada", url: "https://www.glassdoor.ca/Job/" },
];

export default function PreferencesPage() {
  const router = useRouter();
  const supabase = createClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Form state
  const [careerGoals, setCareerGoals] = useState("");
  const [targetIndustries, setTargetIndustries] = useState<string[]>([]);
  const [salaryRange, setSalaryRange] = useState([80000, 150000]);
  const [remotePreference, setRemotePreference] = useState("");
  const [dealbreakers, setDealbreakers] = useState<string[]>([]);
  const [currentFrustration, setCurrentFrustration] = useState("");
  const [skillsToDevelop, setSkillsToDevelop] = useState("");
  const [jobSites, setJobSites] = useState<string[]>([]);
  const [customJobSites, setCustomJobSites] = useState<{id: string; label: string; url: string}[]>([]);
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteUrl, setNewSiteUrl] = useState("");

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUserId(user.id);

      // Load existing preferences
      const { data: prefs } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (prefs) {
        setCareerGoals(prefs.career_goals || "");
        setTargetIndustries(prefs.target_industries || []);
        setSalaryRange([prefs.salary_min || 80000, prefs.salary_max || 150000]);
        setRemotePreference(prefs.remote_preference || "");
        setDealbreakers(prefs.dealbreakers || []);
        setCurrentFrustration(prefs.current_frustration || "");
        setSkillsToDevelop((prefs.skills_to_develop || []).join(", "));
        setJobSites(prefs.job_sites || []);
        setCustomJobSites(prefs.custom_job_sites || []);
      }
    };
    getUser();
  }, [router, supabase]);

  const handleNext = () => {
    if (currentStep < TOTAL_QUESTIONS) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    setLoading(true);

    const preferences = {
      user_id: userId,
      career_goals: careerGoals,
      target_roles: careerGoals.split(",").map((r) => r.trim()).filter(Boolean),
      industry_openness: targetIndustries.includes("all"),
      target_industries: targetIndustries,
      salary_min: salaryRange[0],
      salary_max: salaryRange[1],
      remote_preference: remotePreference || "remote",
      dealbreakers,
      current_frustration: currentFrustration,
      skills_to_develop: skillsToDevelop.split(",").map((s) => s.trim()).filter(Boolean),
      job_sites: jobSites,
      custom_job_sites: customJobSites,
    };

    const { error } = await supabase
      .from("user_preferences")
      .upsert(preferences, { onConflict: "user_id" });

    setLoading(false);

    if (error) {
      console.error("Error saving preferences:", error);
      alert("Failed to save preferences. Please try again.");
      return;
    }

    router.push("/upload");
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1: return careerGoals.trim().length > 0;
      case 2: return targetIndustries.length > 0;
      case 3: return true; // slider always has value
      case 4: return remotePreference !== "";
      case 5: return true; // optional
      case 6: return currentFrustration.trim().length > 0;
      case 7: return skillsToDevelop.trim().length > 0;
      case 8: return jobSites.length > 0;
      default: return false;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <Label className="text-lg font-medium">
              What type of role are you looking for?
            </Label>
            <p className="text-sm text-muted-foreground">
              Describe your target roles or career direction. You can list multiple roles separated by commas.
            </p>
            <Input
              placeholder="e.g., Cloud Solutions Architect, DevOps Lead, Engineering Manager"
              value={careerGoals}
              onChange={(e) => setCareerGoals(e.target.value)}
              className="h-12"
            />
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <Label className="text-lg font-medium">
              Which industries are you targeting?
            </Label>
            <p className="text-sm text-muted-foreground">
              Select one or more industries. Choose &quot;All Industries&quot; if you&apos;re open to anything.
            </p>
            <div className="space-y-3 pt-2">
              {INDUSTRY_OPTIONS.map((option) => (
                <div key={option.id} className="flex items-center space-x-3">
                  <Checkbox
                    id={`industry-${option.id}`}
                    checked={targetIndustries.includes(option.id)}
                    onCheckedChange={(checked) => {
                      if (option.id === "all") {
                        setTargetIndustries(checked ? ["all"] : []);
                      } else {
                        if (checked) {
                          setTargetIndustries((prev) => prev.filter((i) => i !== "all").concat(option.id));
                        } else {
                          setTargetIndustries((prev) => prev.filter((i) => i !== option.id));
                        }
                      }
                    }}
                  />
                  <label htmlFor={`industry-${option.id}`} className="text-sm cursor-pointer">
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <Label className="text-lg font-medium">
              What are your salary expectations?
            </Label>
            <p className="text-sm text-muted-foreground">
              Drag the sliders to set your minimum and maximum range (CAD).
            </p>
            <div className="pt-6 px-2">
              <Slider
                value={salaryRange}
                onValueChange={(value) => setSalaryRange(value as number[])}
                min={40000}
                max={300000}
                step={5000}
              />
              <div className="flex justify-between mt-4 text-sm font-medium">
                <span>${salaryRange[0].toLocaleString()}</span>
                <span>${salaryRange[1].toLocaleString()}</span>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <Label className="text-lg font-medium">
              Remote / hybrid / onsite preference?
            </Label>
            <p className="text-sm text-muted-foreground">
              What&apos;s your preferred work arrangement?
            </p>
            <Select value={remotePreference} onValueChange={(value) => setRemotePreference(value ?? "")}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Select your preference" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="remote">Fully Remote</SelectItem>
                <SelectItem value="hybrid">Hybrid (mix of remote + office)</SelectItem>
                <SelectItem value="onsite">Onsite (in-office)</SelectItem>
                <SelectItem value="any">Does not matter</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <Label className="text-lg font-medium">
              Any hard dealbreakers?
            </Label>
            <p className="text-sm text-muted-foreground">
              Select anything that would make you immediately reject a role.
            </p>
            <div className="space-y-3 pt-2">
              {DEALBREAKER_OPTIONS.map((option) => (
                <div key={option} className="flex items-center space-x-3">
                  <Checkbox
                    id={option}
                    checked={dealbreakers.includes(option)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setDealbreakers([...dealbreakers, option]);
                      } else {
                        setDealbreakers(dealbreakers.filter((d) => d !== option));
                      }
                    }}
                  />
                  <label htmlFor={option} className="text-sm cursor-pointer">
                    {option}
                  </label>
                </div>
              ))}
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <Label className="text-lg font-medium">
              What&apos;s your biggest current frustration?
            </Label>
            <p className="text-sm text-muted-foreground">
              Tell us what&apos;s driving you to make a change. This helps us understand your motivation.
            </p>
            <Textarea
              placeholder="e.g., I've been applying to 50+ jobs with almost no callbacks. I don't know if my resume is even getting past ATS screening..."
              value={currentFrustration}
              onChange={(e) => setCurrentFrustration(e.target.value)}
              rows={4}
            />
          </div>
        );

      case 7:
        return (
          <div className="space-y-4">
            <Label className="text-lg font-medium">
              What skills do you want to develop?
            </Label>
            <p className="text-sm text-muted-foreground">
              List skills you&apos;d like to grow, separated by commas. These help us identify growth-oriented roles.
            </p>
            <Input
              placeholder="e.g., Kubernetes, Cloud Architecture, Team Leadership, Terraform"
              value={skillsToDevelop}
              onChange={(e) => setSkillsToDevelop(e.target.value)}
              className="h-12"
            />
          </div>
        );

      case 8:
        return (
          <div className="space-y-4">
            <Label className="text-lg font-medium">
              Which job sites should we search?
            </Label>
            <p className="text-sm text-muted-foreground">
              Select the job boards you want CareerNorth to search for matching positions.
            </p>
            <div className="space-y-3 pt-2">
              {JOB_SITE_OPTIONS.map((site) => (
                <div key={site.id} className="flex items-center space-x-3">
                  <Checkbox
                    id={site.id}
                    checked={jobSites.includes(site.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setJobSites([...jobSites, site.id]);
                      } else {
                        setJobSites(jobSites.filter((s) => s !== site.id));
                      }
                    }}
                  />
                  <label htmlFor={site.id} className="text-sm cursor-pointer">
                    {site.label}
                  </label>
                </div>
              ))}
              {customJobSites.map((site) => (
                <div key={site.id} className="flex items-center space-x-3">
                  <Checkbox
                    id={site.id}
                    checked={jobSites.includes(site.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setJobSites([...jobSites, site.id]);
                      } else {
                        setJobSites(jobSites.filter((s) => s !== site.id));
                      }
                    }}
                  />
                  <label htmlFor={site.id} className="text-sm cursor-pointer">
                    {site.label}
                  </label>
                  <button
                    type="button"
                    aria-label={`Remove ${site.label}`}
                    className="text-xs text-red-500 hover:text-red-700"
                    onClick={() => {
                      setCustomJobSites(customJobSites.filter((s) => s.id !== site.id));
                      setJobSites(jobSites.filter((s) => s !== site.id));
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="border-t pt-3 mt-3 space-y-2">
              <p className="text-sm font-medium">Add a custom job site</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Site name"
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="https://..."
                  value={newSiteUrl}
                  onChange={(e) => setNewSiteUrl(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!newSiteName.trim() || !newSiteUrl.trim()}
                  onClick={() => {
                    try {
                      const domain = new URL(newSiteUrl.trim()).hostname;
                      const id = `custom-${domain}`;
                      if (!customJobSites.find((s) => s.id === id)) {
                        setCustomJobSites([...customJobSites, { id, label: newSiteName.trim(), url: newSiteUrl.trim() }]);
                        setJobSites([...jobSites, id]);
                      }
                      setNewSiteName("");
                      setNewSiteUrl("");
                    } catch {
                      alert("Please enter a valid URL (e.g. https://example.com)");
                    }
                  }}
                >
                  Add
                </Button>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setJobSites([
                ...JOB_SITE_OPTIONS.map((s) => s.id),
                ...customJobSites.map((s) => s.id),
              ])}
            >
              Select All
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <CardTitle className="text-xl">Career Preferences</CardTitle>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => router.push("/dashboard")}>
                <Home className="w-4 h-4 mr-1" /> Dashboard
              </Button>
              <span className="text-sm text-muted-foreground">
                {currentStep} / {TOTAL_QUESTIONS}
              </span>
            </div>
          </div>
          <Progress value={(currentStep / TOTAL_QUESTIONS) * 100} className="h-2" />
        </CardHeader>
        <CardContent className="space-y-6">
          {renderStep()}

          <div className="flex justify-between pt-4">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 1}
            >
              Back
            </Button>

            {currentStep < TOTAL_QUESTIONS ? (
              <Button onClick={handleNext} disabled={!isStepValid()}>
                Next
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={!isStepValid() || loading}>
                {loading ? "Saving..." : "Save & Continue"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
