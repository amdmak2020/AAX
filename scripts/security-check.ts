import assert from "node:assert/strict";
const { canAccessUserResource, hasRole, isEmailVerified, isRecentlyAuthenticated, normalizeRole } = await import(
  new URL("../lib/access-control.ts", import.meta.url).href
);
const { normalizeHttpUrl, sanitizeMultilineText, sanitizeSingleLineText } = await import(new URL("../lib/validation.ts", import.meta.url).href);

assert.equal(normalizeRole("user"), "owner", "legacy user role should normalize to owner");
assert.equal(hasRole("admin", "member"), true, "admin should satisfy member access");
assert.equal(hasRole("viewer", "member"), false, "viewer should not satisfy member access");
assert.equal(
  canAccessUserResource({
    actorUserId: "user-a",
    ownerUserId: "user-a",
    actorRole: "viewer"
  }),
  true,
  "users should be able to access their own resources"
);
assert.equal(
  canAccessUserResource({
    actorUserId: "user-a",
    ownerUserId: "user-b",
    actorRole: "owner"
  }),
  false,
  "changing the resource id must not let a user access someone else's record"
);
assert.equal(
  canAccessUserResource({
    actorUserId: "admin-a",
    ownerUserId: "user-b",
    actorRole: "admin"
  }),
  true,
  "admin should be able to access another user's record"
);
assert.equal(isEmailVerified({ email_confirmed_at: null }), false, "unverified emails should fail verification");
assert.equal(isEmailVerified({ email_confirmed_at: "2026-04-27T00:00:00.000Z" }), true, "verified emails should pass verification");

const stale = new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString();
const fresh = new Date(Date.now() - 30 * 60 * 1000).toISOString();

assert.equal(isRecentlyAuthenticated({ last_sign_in_at: stale }), false, "stale sessions should fail elevated checks");
assert.equal(isRecentlyAuthenticated({ last_sign_in_at: fresh }), true, "fresh sessions should pass elevated checks");
assert.equal(sanitizeSingleLineText("  hello\u0000   world  "), "hello world", "single-line sanitization should remove control chars");
assert.equal(
  sanitizeMultilineText("line 1\r\n\r\n\r\nline\u0007 2"),
  "line 1\n\nline  2",
  "multiline sanitization should normalize line endings and strip control chars"
);
assert.equal(
  normalizeHttpUrl("https://example.com/path?q=1#fragment"),
  "https://example.com/path?q=1",
  "URL normalization should strip fragments"
);

console.log("Security access-control checks passed.");
