"use client";

import { useMemo, useRef, useState } from "react";
import { UploadCloud, Video } from "lucide-react";

export function FileUploadDropzone({
  name,
  maxFileSizeMb,
  required = true
}: {
  name: string;
  maxFileSizeMb: number;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const helperText = useMemo(() => `MP4, MOV, M4V, or WebM. Up to ${maxFileSizeMb}MB.`, [maxFileSizeMb]);

  const handleFile = (file: File | null) => {
    if (!file) return;
    const limitBytes = maxFileSizeMb * 1024 * 1024;
    if (file.size > limitBytes) {
      setError(`This file is too large for the current plan. Limit: ${maxFileSizeMb}MB.`);
      setFileName(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setError(null);
    setFileName(file.name);
  };

  return (
    <div>
      <label
        className="interactive-card block cursor-pointer rounded-lg border border-dashed border-pearl/16 bg-pearl/[0.04] p-6"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files?.[0] ?? null;
          if (inputRef.current) {
            inputRef.current.files = event.dataTransfer.files;
          }
          handleFile(file);
        }}
      >
        <input
          accept="video/mp4,video/quicktime,video/x-m4v,video/webm"
          className="sr-only"
          name={name}
          onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
          ref={inputRef}
          required={required}
          type="file"
        />
        <div className="flex flex-col items-center justify-center text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-mint text-ink">
            {fileName ? <Video className="h-6 w-6" /> : <UploadCloud className="h-6 w-6" />}
          </div>
          <p className="mt-4 text-lg font-black">{fileName ? fileName : "Drop your clip here or click to upload"}</p>
          <p className="mt-2 text-sm leading-6 text-pearl/58">{error ?? helperText}</p>
        </div>
      </label>
    </div>
  );
}
