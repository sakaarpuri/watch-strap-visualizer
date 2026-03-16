"use client";

import { ChangeEvent, DragEvent, useId, useState } from "react";

interface ImageUploaderProps {
  id: string;
  label?: string;
  helperText?: string;
  previewUrl?: string;
  onFileSelect: (file: File) => void;
  compact?: boolean;
  showOrientationHints?: boolean;
  className?: string;
  accentActive?: boolean;
}

export default function ImageUploader({
  id,
  label,
  helperText,
  previewUrl,
  onFileSelect,
  compact = false,
  showOrientationHints = false,
  className = "",
  accentActive = false
}: ImageUploaderProps) {
  const inputId = useId();
  const [fileName, setFileName] = useState<string>("No file selected");
  const [isDragOver, setIsDragOver] = useState(false);

  const acceptFile = (file?: File) => {
    if (!file) {
      setFileName("No file selected");
      return;
    }
    setFileName(file.name);
    onFileSelect(file);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    acceptFile(event.target.files?.[0]);
  };

  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    acceptFile(event.dataTransfer.files?.[0]);
  };

  return (
    <div
      className={`glass-card rounded-2xl border border-line ${accentActive ? "upload-attention-ring" : ""} ${compact ? "p-4 sm:p-4" : "p-5 sm:p-5"} ${className}`}
    >
      {label ? (
        <p id={id} className="text-2xl font-semibold leading-tight text-ink sm:text-xl">
          {label}
        </p>
      ) : null}
      {helperText ? (
        <p className="mt-2 whitespace-pre-line text-base leading-7 text-ink/85 sm:text-[15px]">
          {helperText}
        </p>
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
      <div className={`${label || helperText ? "mt-3" : "mt-0"} flex items-center justify-between gap-3`}>
        <p className="text-sm font-medium text-muted">PNG, JPG, or a crisp retailer screenshot.</p>
        <span className={`truncate text-sm text-muted ${compact ? "max-w-[12rem]" : "max-w-[16rem] md:max-w-[22rem]"}`}>
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
      <label
        htmlFor={inputId}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-4 text-center transition ${
          isDragOver
            ? "border-emerald-400 bg-emerald-50/60"
            : "border-slate-300 bg-canvas hover:border-emerald-300 hover:bg-white/70"
        } ${compact ? "min-h-[8rem]" : "min-h-[12rem]"}`}
      >
        {previewUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={`${label} preview`}
              className={`${compact ? "h-20" : "h-24"} w-auto rounded-lg object-contain`}
            />
            <p className="mt-3 text-base font-semibold text-ink">Click or drop to replace</p>
            <p className="mt-1 text-sm text-muted">Keep the watch front-on and centered.</p>
          </>
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-300 bg-white/80 text-xl text-muted">
              +
            </div>
            <p className="mt-3 text-lg font-semibold text-ink">Click to upload or drag a watch photo here</p>
          </>
        )}
      </label>
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
