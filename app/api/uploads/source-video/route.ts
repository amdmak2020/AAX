import { NextResponse } from "next/server";
import { z } from "zod";
import { planCatalog, sourceUploadMaxMb } from "@/lib/app-config";
import { ensureAccountRecords } from "@/lib/account-bootstrap";
import { areSubmissionsLocked, isAccountSuspended } from "@/lib/access-control";
import { verifyCsrfRequest } from "@/lib/csrf";
import { enforceRateLimit } from "@/lib/request-security";
import { createSignedSourceVideoUploadTarget } from "@/lib/storage/supabase-storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z
  .object({
    fileName: z.string().trim().min(1).max(255),
    contentType: z.string().trim().min(1).max(120),
    size: z.number().int().positive()
  })
  .strict();

export async function POST(request: Request) {
  const csrfCheck = await verifyCsrfRequest(request);
  if (!csrfCheck.ok) {
    return NextResponse.json({ error: "Your session expired. Refresh and try again." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before uploading a clip." }, { status: 401 });
  }

  const limiter = await enforceRateLimit({
    request,
    bucket: "source-video:prepare-upload",
    key: user.id,
    limit: 20,
    windowMs: 15 * 60 * 1000
  });

  if (!limiter.allowed) {
    return NextResponse.json({ error: "You are uploading too many clips too quickly. Give it a minute." }, { status: 429 });
  }

  const profileResult = await supabase
    .from("profiles")
    .select("is_suspended,submissions_locked,suspended_reason")
    .eq("id", user.id)
    .maybeSingle();

  if (isAccountSuspended(profileResult.data as Record<string, unknown> | null | undefined)) {
    return NextResponse.json({ error: "Your account is suspended. Contact support for help." }, { status: 403 });
  }

  if (areSubmissionsLocked(profileResult.data as Record<string, unknown> | null | undefined)) {
    return NextResponse.json({ error: "New submissions are currently locked on this account." }, { status: 403 });
  }

  const subscription = await ensureAccountRecords(user);
  const plan = planCatalog[subscription.plan_key];
  const uploadLimitMb = Math.min(plan.maxFileSizeMb, sourceUploadMaxMb);
  const uploadLimitBytes = uploadLimitMb * 1024 * 1024;

  if (parsed.data.size > uploadLimitBytes) {
    return NextResponse.json({ error: `Uploads are currently limited to ${uploadLimitMb}MB.` }, { status: 413 });
  }

  if (!/^video\//i.test(parsed.data.contentType)) {
    return NextResponse.json({ error: "Upload an MP4, MOV, M4V, or WebM video." }, { status: 400 });
  }

  const target = await createSignedSourceVideoUploadTarget({
    userId: user.id,
    fileName: parsed.data.fileName
  });

  return NextResponse.json(target);
}
