"use client";

import { ChangeEvent } from "react";

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
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    onFileSelect(file);
  };

  return (
    <div className="rounded-2xl border border-line p-5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="mt-3 block w-full text-sm file:mr-4 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-2 file:text-sm file:text-ink"
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
