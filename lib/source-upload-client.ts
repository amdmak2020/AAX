"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export async function uploadSourceFileDirect(input: {
  file: File;
  csrfToken: string;
}) {
  const response = await fetch("/api/uploads/source-video", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": input.csrfToken
    },
    body: JSON.stringify({
      fileName: input.file.name,
      contentType: input.file.type || "application/octet-stream",
      size: input.file.size
    })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Could not prepare the upload.");
  }

  const payload = (await response.json()) as {
    bucket: string;
    path: string;
    token: string;
  };

  const supabase = createSupabaseBrowserClient();
  const upload = await supabase.storage.from(payload.bucket).uploadToSignedUrl(payload.path, payload.token, input.file, {
    contentType: input.file.type || "application/octet-stream"
  });

  if (upload.error) {
    throw new Error(upload.error.message);
  }

  return {
    path: payload.path,
    fileName: input.file.name
  };
}

function ensureHiddenInput(form: HTMLFormElement, name: string, value: string) {
  let input = form.querySelector(`input[name="${name}"]`) as HTMLInputElement | null;
  if (!input) {
    input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    form.appendChild(input);
  }

  input.value = value;
}

export async function prepareBoostJobFormForSubmit(input: {
  form: HTMLFormElement;
  csrfToken: string;
}) {
  const sourceUrlInput = input.form.querySelector('input[name="sourceUrl"]') as HTMLInputElement | null;
  if (sourceUrlInput?.value.trim()) {
    return { uploaded: false as const };
  }

  const fileInput = input.form.querySelector('input[type="file"][name="sourceFile"]') as HTMLInputElement | null;
  const file = fileInput?.files?.[0] ?? null;

  if (!file) {
    return { uploaded: false as const };
  }

  const uploaded = await uploadSourceFileDirect({
    file,
    csrfToken: input.csrfToken
  });

  ensureHiddenInput(input.form, "sourceUploadPath", uploaded.path);
  ensureHiddenInput(input.form, "sourceUploadFileName", uploaded.fileName);

  if (fileInput) {
    fileInput.disabled = true;
  }

  return { uploaded: true as const, path: uploaded.path };
}
