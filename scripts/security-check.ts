import assert from "node:assert/strict";
const { canAccessUserResource, hasRole, isEmailVerified, isRecentlyAuthenticated, normalizeRole } = await import(
  new URL("../lib/access-control.ts", import.meta.url).href
);
const { detectVideoFileType } = await import(new URL("../lib/file-security.ts", import.meta.url).href);
const { isSafeRemoteUrl } = await import(new URL("../lib/network-security.ts", import.meta.url).href);
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
assert.equal(sanitizeSingleLineText("<script>alert(1)</script> hello"), "scriptalert(1)/script hello", "single-line sanitization should strip markup delimiters");
assert.equal(
  sanitizeMultilineText("line 1\r\n\r\n\r\nline\u0007 2"),
  "line 1\n\nline  2",
  "multiline sanitization should normalize line endings and strip control chars"
);
assert.equal(
  sanitizeMultilineText("hello\u202E\n<script>world</script>"),
  "hello\nscriptworld/script",
  "multiline sanitization should strip bidi controls and markup delimiters"
);
assert.equal(
  normalizeHttpUrl("https://example.com/path?q=1#fragment"),
  "https://example.com/path?q=1",
  "URL normalization should strip fragments"
);
assert.equal(
  isSafeRemoteUrl("https://x.com/cookwithzuri/status/2046615624286179416"),
  true,
  "public https URLs should be allowed when they are not internal"
);
assert.equal(isSafeRemoteUrl("http://127.0.0.1:3000/test"), false, "localhost IPv4 targets must be blocked");
assert.equal(isSafeRemoteUrl("http://169.254.169.254/latest/meta-data"), false, "metadata IP targets must be blocked");
assert.deepEqual(
  detectVideoFileType(
    new Uint8Array([
      0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x00, 0x00
    ])
  ),
  { mime: "video/mp4", extension: "mp4" },
  "MP4 signatures should be detected from file bytes"
);
assert.equal(detectVideoFileType(new Uint8Array([0x3c, 0x73, 0x76, 0x67])), null, "non-video payloads must be rejected");

console.log("Security access-control checks passed.");
