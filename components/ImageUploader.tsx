"use client";

import { ChangeEvent, useId, useState } from "react";

interface ImageUploaderProps {
  id: string;
  label: string;
  previewUrl?: string;
  onFileSelect: (file: File) => void;
}

export default function ImageUploader({
  id,
  label,
  previewUrl,
  onFileSelect
}: ImageUploaderProps) {
  const inputId = useId();
  const [fileName, setFileName] = useState<string>("No file selected");

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setFileName("No file selected");
      return;
    }
    setFileName(file.name);
    onFileSelect(file);
  };

  return (
    <div className="rounded-2xl border border-line p-6">
      <p id={id} className="text-lg font-medium text-ink">
        {label}
      </p>
      <div className="mt-3 flex items-center gap-3">
        <label
          htmlFor={inputId}
          className="cursor-pointer rounded-lg border border-line bg-white px-4 py-2.5 text-base text-ink transition hover:bg-canvas"
        >
          Choose File
        </label>
        <span className="max-w-[160px] truncate text-base text-muted md:max-w-[220px]">
          {fileName}
        </span>
      </div>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        aria-labelledby={id}
        onChange={handleChange}
        className="sr-only"
      />
      <div className="mt-4 flex h-24 items-center justify-center rounded-xl border border-dashed border-line bg-canvas">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={`${label} preview`}
            className="h-20 w-auto rounded-md object-contain"
          />
        ) : (
          <span className="text-xs text-muted">No image selected</span>
        )}
      </div>
    </div>
  );
}
