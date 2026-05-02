import crypto from "node:crypto";
import { getEnv } from "@/lib/env";

const cipherAlgorithm = "aes-256-gcm";

function getSecretMaterial() {
  const raw = getEnv("APP_ENCRYPTION_KEY")?.trim();
  if (!raw) {
    return null;
  }

  return crypto.createHash("sha256").update(raw).digest();
}

function toBase64Url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64");
}

export function hasAppEncryptionKey() {
  return Boolean(getSecretMaterial());
}

export function encryptSecret(plainText: string) {
  const key = getSecretMaterial();
  if (!key) {
    throw new Error("APP_ENCRYPTION_KEY is not configured.");
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(cipherAlgorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${toBase64Url(iv)}.${toBase64Url(tag)}.${toBase64Url(encrypted)}`;
}

export function decryptSecret(payload: string) {
  const key = getSecretMaterial();
  if (!key) {
    throw new Error("APP_ENCRYPTION_KEY is not configured.");
  }

  const [ivPart, tagPart, encryptedPart] = payload.split(".");
  if (!ivPart || !tagPart || !encryptedPart) {
    throw new Error("Encrypted payload format is invalid.");
  }

  const decipher = crypto.createDecipheriv(cipherAlgorithm, key, fromBase64Url(ivPart));
  decipher.setAuthTag(fromBase64Url(tagPart));
  const decrypted = Buffer.concat([decipher.update(fromBase64Url(encryptedPart)), decipher.final()]);
  return decrypted.toString("utf8");
}

export function createSignedState(scope: string, payload: Record<string, unknown>) {
  const key = getSecretMaterial();
  if (!key) {
    throw new Error("APP_ENCRYPTION_KEY is not configured.");
  }

  const body = {
    scope,
    issuedAt: Date.now(),
    ...payload
  };

  const encodedBody = toBase64Url(JSON.stringify(body));
  const signature = crypto.createHmac("sha256", key).update(encodedBody).digest();
  return `${encodedBody}.${toBase64Url(signature)}`;
}

export function verifySignedState<T extends Record<string, unknown>>(value: string, scope: string, maxAgeMs: number) {
  const key = getSecretMaterial();
  if (!key) {
    throw new Error("APP_ENCRYPTION_KEY is not configured.");
  }

  const [encodedBody, encodedSignature] = value.split(".");
  if (!encodedBody || !encodedSignature) {
    return null;
  }

  const expectedSignature = crypto.createHmac("sha256", key).update(encodedBody).digest();
  const incomingSignature = fromBase64Url(encodedSignature);

  if (incomingSignature.length !== expectedSignature.length || !crypto.timingSafeEqual(incomingSignature, expectedSignature)) {
    return null;
  }

  const decoded = JSON.parse(Buffer.from(fromBase64Url(encodedBody)).toString("utf8")) as T & {
    scope?: string;
    issuedAt?: number;
  };

  if (decoded.scope !== scope || typeof decoded.issuedAt !== "number" || Date.now() - decoded.issuedAt > maxAgeMs) {
    return null;
  }

  return decoded;
}
