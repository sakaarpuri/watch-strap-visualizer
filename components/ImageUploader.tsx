"use client";

import { ChangeEvent, useId, useState } from "react";

interface ImageUploaderProps {
  id: string;
  label: string;
  helperText?: string;
  previewUrl?: string;
  onFileSelect: (file: File) => void;
  compact?: boolean;
  showOrientationHints?: boolean;
}

export default function ImageUploader({
  id,
  label,
  helperText,
  previewUrl,
  onFileSelect,
  compact = false,
  showOrientationHints = false
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
    <div className={`rounded-2xl border border-line ${compact ? "p-4 sm:p-5" : "p-6"}`}>
      <p id={id} className="text-lg font-medium text-ink">
        {label}
      </p>
      {helperText ? (
        <p className="mt-2 text-sm leading-relaxed text-muted">{helperText}</p>
      ) : null}
      {showOrientationHints ? (
        <div className="mt-3 rounded-xl border border-line bg-canvas/60 p-3">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted">Photo Angle Guide</p>
          <div className="mt-2 grid grid-cols-5 gap-2">
            <OrientationChip label="Good" rotation={0} good />
            <OrientationChip label="Left" rotation={-24} />
            <OrientationChip label="Right" rotation={24} />
            <OrientationChip label="Up" rotation={-66} />
            <OrientationChip label="Down" rotation={66} />
          </div>
        </div>
      ) : null}
      <div className={`mt-3 ${compact ? "flex flex-col gap-3 sm:flex-row sm:items-center" : "flex items-center gap-3"}`}>
        <label
          htmlFor={inputId}
          className="cursor-pointer rounded-lg border border-line bg-white px-4 py-2.5 text-base text-ink transition hover:bg-canvas"
        >
          Choose File
        </label>
        <span className={`truncate text-base text-muted ${compact ? "max-w-full" : "max-w-[160px] md:max-w-[220px]"}`}>
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
      <div className={`mt-4 flex items-center justify-center rounded-xl border border-dashed border-line bg-canvas ${compact ? "h-20 sm:h-20" : "h-24"}`}>
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

function OrientationChip({
  label,
  rotation,
  good = false
}: {
  label: string;
  rotation: number;
  good?: boolean;
}) {
  return (
    <div className={`rounded-lg border px-2 py-1.5 text-center ${good ? "border-emerald-300 bg-emerald-50/70" : "border-line bg-white/80"}`}>
      <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-line bg-canvas">
        <span
          className="inline-block h-5 w-1.5 rounded-sm bg-slate-700"
          style={{ transform: `rotate(${rotation}deg)` }}
          aria-hidden="true"
        />
      </div>
      <p className={`mt-1 text-[11px] ${good ? "text-emerald-700" : "text-muted"}`}>{label}</p>
    </div>
  );
}
