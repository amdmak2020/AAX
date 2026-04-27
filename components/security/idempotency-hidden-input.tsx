import crypto from "node:crypto";

export function IdempotencyHiddenInput({ name = "idempotencyKey" }: { name?: string }) {
  return <input name={name} type="hidden" value={crypto.randomUUID()} />;
}
