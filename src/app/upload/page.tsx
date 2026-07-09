"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import type { ParsedResume, ResumeRecord } from "@/lib/types";
import { Upload, FileText, CheckCircle, X, AlertCircle } from "lucide-react";

const MAX_RESUMES = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = [
  "application/pdf",
];

export default function UploadPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fetchResumes = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("resumes")
      .select("*")
      .eq("user_id", uid)
      .order("uploaded_at", { ascending: false });
    if (data) setResumes(data);
  }, [supabase]);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUserId(user.id);
      fetchResumes(user.id);
    };
    getUser();
  }, [router, supabase.auth, fetchResumes]);

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return "Only PDF and DOCX files are accepted.";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "File size must be under 5MB.";
    }
    if (resumes.length >= MAX_RESUMES) {
      return `Maximum ${MAX_RESUMES} resumes allowed. Delete one to upload another.`;
    }
    return null;
  };

  const handleUpload = async (file: File) => {
    if (!userId) return;

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setUploading(true);
    setUploadProgress(20);

    try {
      // Upload file to Supabase Storage
      const filePath = `${userId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(filePath, file);

      if (uploadError) throw new Error("File upload failed: " + uploadError.message);
      setUploadProgress(50);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("resumes")
        .getPublicUrl(filePath);

      setUploadProgress(70);

      // Call our parse API (mock for now)
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", userId);
      formData.append("fileName", file.name);
      formData.append("fileUrl", publicUrl);

      const parseResponse = await fetch("/api/upload/parse", {
        method: "POST",
        body: formData,
      });

      if (!parseResponse.ok) throw new Error("Resume parsing failed");
      setUploadProgress(90);

      const { resume } = await parseResponse.json();
      setResumes((prev) => [resume, ...prev]);
      setUploadProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = "";
  };

  const handleDelete = async (resume: ResumeRecord) => {
    if (!userId) return;

    await supabase.from("resumes").delete().eq("id", resume.id);
    await supabase.storage.from("resumes").remove([resume.file_url]);
    setResumes((prev) => prev.filter((r) => r.id !== resume.id));
  };

  const [parsing, setParsing] = useState<string | null>(null);

  const handleReparse = async (resume: ResumeRecord) => {
    if (!userId) return;
    setParsing(resume.id);
    try {
      // Download the file from Supabase Storage
      const filePath = resume.file_url.includes("/storage/")
        ? resume.file_url.split("/storage/v1/object/public/resumes/")[1]
        : `${userId}/${resume.file_name}`;
      const { data: fileData, error: dlError } = await supabase.storage
        .from("resumes")
        .download(filePath);

      if (dlError || !fileData) throw new Error("Could not download file from storage");

      // Send to parse API
      const formData = new FormData();
      formData.append("file", fileData, resume.file_name);
      formData.append("userId", userId);
      formData.append("fileName", resume.file_name);
      formData.append("fileUrl", resume.file_url);
      formData.append("resumeId", resume.id);

      const response = await fetch("/api/upload/parse", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Parsing failed");
      const { resume: updated } = await response.json();
      setResumes((prev) => prev.map((r) => r.id === resume.id ? updated : r));
    } catch (err) {
      console.error("Re-parse error:", err);
      setError(err instanceof Error ? err.message : "Failed to parse resume");
    } finally {
      setParsing(null);
    }
  };

  const handleContinue = () => {
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto space-y-6 pt-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Upload Your Resume(s)</h1>
          <p className="text-muted-foreground">
            Upload 1–3 resumes (PDF only). We&apos;ll parse them to understand your skills and experience.
          </p>
        </div>

        {/* Upload Area */}
        <Card>
          <CardContent className="p-6">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragOver
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-gray-300 hover:border-indigo-400"
              } ${uploading ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
              <p className="text-sm font-medium">
                Drag and drop your resume here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF only, max 5MB • {resumes.length}/{MAX_RESUMES} uploaded
              </p>
              <input
                id="file-input"
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {uploadProgress > 0 && (
              <div className="mt-4">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1 text-center">
                  {uploadProgress < 50 ? "Uploading..." : uploadProgress < 90 ? "Parsing resume..." : "Done!"}
                </p>
              </div>
            )}

            {error && (
              <div className="mt-4 flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-md">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Uploaded Resumes */}
        {resumes.map((resume) => (
          <Card key={resume.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  <CardTitle className="text-base">{resume.file_name}</CardTitle>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(resume)}
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <CardDescription className="text-xs">
                Uploaded {new Date(resume.uploaded_at).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            {resume.parsed_data && (
              <CardContent className="pt-0 space-y-3">
                <Separator />
                <ResumePreview data={resume.parsed_data} />
              </CardContent>
            )}
            {!resume.parsed_data && (
              <CardContent className="pt-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReparse(resume)}
                  disabled={parsing === resume.id}
                >
                  {parsing === resume.id ? "Parsing..." : "Parse Resume with AI"}
                </Button>
              </CardContent>
            )}
          </Card>
        ))}

        {/* Continue Button */}
        <div className="flex justify-between">
          <Button variant="ghost" onClick={() => router.push("/preferences")}>
            Back to Preferences
          </Button>
          <Button
            onClick={handleContinue}
            disabled={resumes.length === 0}
          >
            Continue to Dashboard →
          </Button>
        </div>
      </div>
    </div>
  );
}

function ResumePreview({ data }: { data: ParsedResume }) {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <span className="font-medium">Name:</span> {data.name}
      </div>
      <div>
        <span className="font-medium">Skills:</span>
        <div className="flex flex-wrap gap-1 mt-1">
          {data.skills.map((skill) => (
            <Badge key={skill} variant="secondary" className="text-xs">
              {skill}
            </Badge>
          ))}
        </div>
      </div>
      <div>
        <span className="font-medium">Experience:</span>
        <div className="mt-1 space-y-1">
          {data.experience.slice(0, 3).map((exp, i) => (
            <div key={i} className="text-xs text-muted-foreground">
              {exp.title} at {exp.company} ({exp.start_date} – {exp.end_date})
            </div>
          ))}
          {data.experience.length > 3 && (
            <div className="text-xs text-muted-foreground">
              +{data.experience.length - 3} more positions
            </div>
          )}
        </div>
      </div>
      <div>
        <span className="font-medium">Education:</span>
        <div className="mt-1 space-y-1">
          {data.education.map((edu, i) => (
            <div key={i} className="text-xs text-muted-foreground">
              {edu.degree} — {edu.school} ({edu.graduation_year})
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
