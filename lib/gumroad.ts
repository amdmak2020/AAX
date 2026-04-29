import crypto from "node:crypto";

function toSafeUrl(input: string) {
  try {
    return new URL(input);
  } catch {
    throw new Error("Invalid Gumroad checkout URL.");
  }
}

export function buildGumroadCheckoutUrl(productUrl: string, params: { email?: string | null }) {
  const url = toSafeUrl(productUrl);

  if (params.email) {
    url.searchParams.set("email", params.email);
  }

  return url.toString();
}

export function verifyGumroadSignature(payload: string, signature: string | null, secret: string) {
  if (!signature) {
    return false;
  }

  const digest = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const digestBuffer = Buffer.from(digest, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");

  if (digestBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(digestBuffer, signatureBuffer);
}

export function parseGumroadBoolean(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

export function getGumroadEventName(fields: URLSearchParams) {
  const explicit = fields.get("event");
  if (explicit) {
    return explicit;
  }

  if (parseGumroadBoolean(fields.get("refunded")) || parseGumroadBoolean(fields.get("chargebacked")) || parseGumroadBoolean(fields.get("disputed"))) {
    return "sale_refunded";
  }

  if (parseGumroadBoolean(fields.get("cancelled"))) {
    return "subscription_cancelled";
  }

  if (parseGumroadBoolean(fields.get("is_recurring_charge"))) {
    return "subscription_payment_success";
  }

  if (fields.get("subscription_id")) {
    return "subscription_created";
  }

  return "sale_created";
}
