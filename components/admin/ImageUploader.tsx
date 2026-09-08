"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export const STORAGE_BUCKET = "hair-artisan-images";

type ImageUploaderProps = {
  value?: string | null;
  onChange: (url: string, path: string) => void;
  folder: "services" | "gallery" | "site";
  label?: string;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function ImageUploader({
  value,
  onChange,
  folder,
  label = "Photo",
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const supabase = useMemo(() => createClient(), []);

  async function handleFile(file: File) {
    setError("");

    if (!file.type.startsWith("image/")) {
      setError("Please select a JPG, PNG or WebP image.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("Image must be smaller than 5MB.");
      return;
    }

    setUploading(true);

    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const baseName = file.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[^a-zA-Z0-9-_]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase() || "image";

      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${baseName}.${extension}`;
      const path = `${folder}/${uniqueName}`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        throw new Error(
          uploadError.message.includes("Bucket not found")
            ? `Storage bucket "${STORAGE_BUCKET}" was not found. Run the Supabase setup SQL supplied with this project.`
            : uploadError.message
        );
      }

      const { data } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(path);

      if (!data.publicUrl) {
        throw new Error("Supabase did not return a public image URL.");
      }

      onChange(data.publicUrl, path);
    } catch (err) {
      console.error("Image upload failed:", err);
      setError(err instanceof Error ? err.message : "Something went wrong while uploading.");
    } finally {
      setUploading(false);
    }
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
    event.target.value = "";
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium">{label}</label>

      {value ? (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-xl border bg-gray-50">
            <img src={value} alt="Selected" className="h-64 w-full object-cover" />
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Change photo"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-64 w-full items-center justify-center rounded-xl border-2 border-dashed bg-gray-50 text-sm hover:bg-gray-100 disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Click to upload photo"}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleInputChange}
        className="hidden"
      />

      <p className="text-xs text-gray-500">JPG, PNG or WebP. Maximum 5MB.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
