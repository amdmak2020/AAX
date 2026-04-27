import { CsrfHiddenInput } from "@/components/security/csrf-hidden-input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function ForgotPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; sent?: string; email?: string }>;
}) {
  const params = await searchParams;

  return (
    <Card className="w-full max-w-md">
      <h1 className="text-3xl font-black">Reset password</h1>
      <p className="mt-2 text-sm text-pearl/62">Enter your email and we will send a reset link.</p>
      {params.error ? (
        <div className="mt-4 rounded-lg border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-pearl/80">{params.error}</div>
      ) : null}
      {params.sent === "1" ? (
        <div className="mt-4 rounded-lg border border-mint/30 bg-mint/10 px-4 py-3 text-sm text-pearl/80">
          Reset link sent{params.email ? ` to ${params.email}` : ""}.
        </div>
      ) : null}
      <form className="mt-6 grid gap-4" action="/api/auth/reset" method="post">
        <CsrfHiddenInput />
        <label className="grid gap-2">
          <span className="text-sm font-black">Email</span>
          <input className="rounded-lg border border-pearl/10 bg-ink px-4 py-3" defaultValue={params.email ?? ""} name="email" type="email" required />
        </label>
        <Button type="submit">Send reset link</Button>
      </form>
    </Card>
  );
}
