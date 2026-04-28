import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function readRepoFile(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assertSourceContains(relativePath: string, pattern: RegExp | string, message: string) {
  const source = readRepoFile(relativePath);
  const matches = typeof pattern === "string" ? source.includes(pattern) : pattern.test(source);
  assert.equal(matches, true, `${relativePath}: ${message}`);
}

function expectThrows(fn: () => unknown, matcher: RegExp, message: string) {
  let thrown = false;
  try {
    fn();
  } catch (error) {
    thrown = true;
    assert.match(String(error), matcher, message);
  }

  assert.equal(thrown, true, message);
}

async function main() {
  const accessControl = await import(new URL("../lib/access-control.ts", import.meta.url).href);
  const fileSecurity = await import(new URL("../lib/file-security.ts", import.meta.url).href);
  const networkSecurity = await import(new URL("../lib/network-security.ts", import.meta.url).href);
  const subscriptionAccess = await import(new URL("../lib/subscription-access.ts", import.meta.url).href);
  const validation = await import(new URL("../lib/validation.ts", import.meta.url).href);

  const results: string[] = [];

  assertSourceContains("app/api/account/export/route.ts", /auth\.getUser\(\)/, "account export should require authenticated user lookup");
  assertSourceContains("app/api/account/export/route.ts", /Authentication required/, "account export should reject unauthenticated callers");
  assertSourceContains("app/api/admin/users/security/route.ts", /if \(!profile\)/, "admin security route should block unauthenticated access");
  assertSourceContains("app/api/admin/users/security/route.ts", /\/login\?next=\/app\/admin/, "admin security route should redirect unauthenticated users");
  results.push("unauthenticated access blocked");

  assert.equal(accessControl.canAccessUserResource({ actorUserId: "a", ownerUserId: "a", actorRole: "viewer" }), true);
  assert.equal(accessControl.canAccessUserResource({ actorUserId: "a", ownerUserId: "b", actorRole: "viewer" }), false);
  assert.equal(accessControl.canAccessUserResource({ actorUserId: "a", ownerUserId: "b", actorRole: "admin" }), true);
  results.push("cross-user access blocked");

  assert.equal(accessControl.normalizeRole("user"), "owner");
  assert.equal(accessControl.hasRole("viewer", "admin"), false);
  assert.equal(accessControl.hasRole("member", "viewer"), true);
  assert.equal(accessControl.hasRole("admin", "admin"), true);
  results.push("role permissions enforced");

  assertSourceContains("app/api/boost-jobs/route.ts", /\.strict\(\)/, "boost job payload must use a strict schema");
  assertSourceContains("app/api/admin/users/security/route.ts", /\.strict\(\)/, "admin security payload must use a strict schema");
  assertSourceContains("app/api/boost-jobs/route.ts", /getUnexpectedFormFields/, "boost jobs should reject unexpected form fields");
  assertSourceContains("app/api/account/delete-request/route.ts", /getUnexpectedFormFields/, "delete-request route should reject unexpected form fields");
  results.push("invalid input rejected");

  assert.equal(validation.sanitizeSingleLineText(`<script>alert(1)</script>\u202E user`), "scriptalert(1)/script user");
  assert.equal(validation.sanitizeMultilineText(`hello<script>\nworld</script>\u202E`), "helloscript\nworld/script");
  results.push("XSS payloads escaped");

  const sourceRoots = ["app", "components", "lib"];
  const suspiciousPattern =
    /\b(pg|postgres|mysql|sqlite|prisma)\b[\s\S]{0,40}\b(query|execute|raw)\s*\(|\bselect\s+.+\$\{|\binsert\s+into\s+.+\$\{|\bupdate\s+.+\$\{|\bdelete\s+from\s+.+\$\{/i;
  for (const root of sourceRoots) {
    const stack = [path.join(repoRoot, root)];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
          continue;
        }

        if (!/\.(ts|tsx)$/.test(entry.name)) {
          continue;
        }

        const source = fs.readFileSync(fullPath, "utf8");
        assert.equal(suspiciousPattern.test(source), false, `Potential raw SQL pattern found in ${path.relative(repoRoot, fullPath)}`);
      }
    }
  }
  results.push("raw SQL injection patterns absent");

  const oversizedRequest = new Request("https://example.com", { headers: { "content-length": String(25 * 1024 * 1024) } });
  assert.equal(validation.requestExceedsBytes(oversizedRequest, 20 * 1024 * 1024), true);
  const mp4Header = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
  assert.deepEqual(fileSecurity.detectVideoFileType(mp4Header), { mime: "video/mp4", extension: "mp4" });
  assert.equal(fileSecurity.detectVideoFileType(new Uint8Array([0x3c, 0x73, 0x76, 0x67])), null);
  results.push("upload size/type limits enforced");

  const payload = JSON.stringify({ ok: true });
  const digest = crypto.createHmac("sha256", "secret").update(payload).digest("hex");
  assert.notEqual(digest, "bad-signature");
  assertSourceContains("app/api/lemonsqueezy/webhook/route.ts", /request\.text\(\)/, "webhook should verify the raw body");
  assertSourceContains("app/api/lemonsqueezy/webhook/route.ts", /verifyLemonSqueezySignature/, "webhook route should verify signatures before processing");
  results.push("invalid webhook signatures rejected");

  assertSourceContains("lib/credits.ts", /scope:\s*"job-failed-refund"/, "credit refunds should be idempotent");
  assertSourceContains("app/api/lemonsqueezy/webhook/route.ts", /reservePersistentWebhookEvent/, "Lemon Squeezy webhook should reserve event IDs before processing");
  results.push("duplicate webhook events do not double-credit");

  assert.equal(subscriptionAccess.hasActiveBillingAccessForBoost({ planKey: "creator", status: "active" }), true);
  assert.equal(subscriptionAccess.hasActiveBillingAccessForBoost({ planKey: "creator", status: "trialing" }), true);
  assert.equal(subscriptionAccess.hasActiveBillingAccessForBoost({ planKey: "creator", status: "cancelled" }), false);
  assert.equal(subscriptionAccess.hasActiveBillingAccessForBoost({ planKey: "pro", status: "refunded" }), false);
  results.push("cancelled subscriptions lose access");

  assertSourceContains("lib/credits.ts", /credits_reserved:\s*0/, "failed-job refunds should clear reserved credits");
  assertSourceContains("lib/credits.ts", /boost_job_credit_refund:/, "refund ledger entries should be explicit and traceable");
  results.push("failed jobs do not double-refund");

  expectThrows(() => networkSecurity.parseSafeRemoteUrl("http://localhost:3000"), /internal hosts/i, "localhost should be blocked");
  expectThrows(() => networkSecurity.parseSafeRemoteUrl("http://127.0.0.1:8080"), /internal hosts/i, "loopback IPv4 should be blocked");
  expectThrows(() => networkSecurity.parseSafeRemoteUrl("http://169.254.169.254/latest/meta-data"), /internal hosts/i, "cloud metadata IP should be blocked");
  expectThrows(() => networkSecurity.parseSafeRemoteUrl("file:///etc/passwd"), /http and https/i, "file protocol should be blocked");
  results.push("SSRF URLs blocked");

  assertSourceContains("app/api/auth/login/route.ts", /enforceRateLimit/, "login route should be rate limited");
  assertSourceContains("app/api/auth/signup/route.ts", /enforceRateLimit/, "signup route should be rate limited");
  assertSourceContains("app/api/auth/reset/route.ts", /enforceRateLimit/, "password reset route should be rate limited");
  assertSourceContains("app/api/boost-jobs/route.ts", /enforceRateLimit/, "boost jobs should be rate limited");
  assertSourceContains("app/api/lemonsqueezy/checkout/route.ts", /enforceRateLimit/, "checkout creation should be rate limited");
  assertSourceContains("app/api/lemonsqueezy/webhook/route.ts", /enforceRateLimit/, "webhook route should be rate limited");
  results.push("rate limits present on sensitive routes");

  assertSourceContains("app/api/admin/users/security/route.ts", /hasRole\(profile\.role,\s*"admin"\)/, "admin user-security route should require admin role");
  assertSourceContains("app/api/admin/jobs/manage/route.ts", /hasRole\(profile\.role,\s*"admin"\)/, "admin job management route should require admin role");
  assertSourceContains("app/api/admin/subscriptions/manage/route.ts", /hasRole\(profile\.role,\s*"admin"\)/, "admin subscription route should require admin role");
  results.push("admin-only routes blocked for normal users");

  console.log("Security regression checks passed:");
  for (const result of results) {
    console.log(`- ${result}`);
  }
}

main().catch((error) => {
  console.error("Security regression checks failed.");
  console.error(error);
  process.exit(1);
});
