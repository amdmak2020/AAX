import crypto from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AuditMetadata = Record<string, unknown>;

function hashIdentifier(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function buildRequestAuditMetadata(request: Request, extras: AuditMetadata = {}) {
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  const forwardedFor = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown";

  return {
    ip_hash: hashIdentifier(forwardedFor),
    user_agent: userAgent.slice(0, 255),
    ...extras
  };
}

export async function logAuditEvent(input: {
  actorUserId?: string | null;
  targetType: string;
  targetId: string;
  action: string;
  metadata?: AuditMetadata;
}) {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("admin_events").insert({
      actor_user_id: input.actorUserId ?? null,
      target_type: input.targetType,
      target_id: input.targetId,
      action: input.action,
      metadata: input.metadata ?? {}
    });
  } catch (error) {
    console.error("Audit log write failed", error);
  }
}

export function hashAuditIdentifier(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return hashIdentifier(value);
}
