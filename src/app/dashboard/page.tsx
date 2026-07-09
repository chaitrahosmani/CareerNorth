"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ResumeRecord } from "@/lib/types";
import {
  Search,
  MessageSquare,
  LogOut,
  Target,
  Upload,
  ClipboardList,
  Users,
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userName, setUserName] = useState("");
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async (uid: string) => {
    const { data: resumeRes } = await supabase.from("resumes").select("*").eq("user_id", uid);
    if (resumeRes) setResumes(resumeRes);
  }, [supabase]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUserName(user.user_metadata?.full_name || user.email || "User");
      await fetchData(user.id);
      setLoading(false);
    };
    init();
  }, [router, supabase.auth, fetchData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">CN</span>
            </div>
            <span className="font-semibold text-lg">CareerNorth</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">Hi, {userName}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-1" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => router.push("/preferences")}
          >
            <CardContent className="p-6 flex items-center gap-4">
              <Target className="w-8 h-8 text-indigo-600" />
              <div>
                <p className="font-medium">Edit Preferences</p>
                <p className="text-sm text-muted-foreground">Update your career goals</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => router.push("/upload")}
          >
            <CardContent className="p-6 flex items-center gap-4">
              <Upload className="w-8 h-8 text-green-600" />
              <div>
                <p className="font-medium">Manage Resumes</p>
                <p className="text-sm text-muted-foreground">
                  {resumes.length} resume{resumes.length !== 1 ? "s" : ""} uploaded
                </p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => router.push("/jobs")}
          >
            <CardContent className="p-6 flex items-center gap-4">
              <Search className="w-8 h-8 text-blue-600" />
              <div>
                <p className="font-medium">Find Matching Jobs</p>
                <p className="text-sm text-muted-foreground">Configure & search job boards</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => router.push("/match")}
          >
            <CardContent className="p-6 flex items-center gap-4">
              <Target className="w-8 h-8 text-purple-600" />
              <div>
                <p className="font-medium">Job Match Score</p>
                <p className="text-sm text-muted-foreground">Match resume to a specific job</p>
              </div>
            </CardContent>
          </Card>
          </div>
        </div>

        {/* Coming Soon - Placeholder Widgets */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Coming Soon</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="opacity-75 border-dashed">
              <CardContent className="p-6 flex items-center gap-4">
                <ClipboardList className="w-8 h-8 text-orange-600" />
                <div>
                  <p className="font-medium">My Application Status</p>
                  <p className="text-sm text-muted-foreground">Track your job applications</p>
                  <Badge variant="secondary" className="mt-1 text-xs">Coming Soon</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="opacity-75 border-dashed">
              <CardContent className="p-6 flex items-center gap-4">
                <Users className="w-8 h-8 text-pink-600" />
                <div>
                  <p className="font-medium">Find References</p>
                  <p className="text-sm text-muted-foreground">Connect with professional references</p>
                  <Badge variant="secondary" className="mt-1 text-xs">Coming Soon</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
