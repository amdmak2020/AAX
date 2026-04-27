import { CsrfHiddenInput } from "@/components/security/csrf-hidden-input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function UpdatePasswordPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <Card className="w-full max-w-md">
      <h1 className="text-3xl font-black">Create a new password</h1>
      <p className="mt-2 text-sm text-pearl/62">Choose a new password for your account.</p>
      {params.error ? (
        <div className="mt-4 rounded-lg border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-pearl/80">{params.error}</div>
      ) : null}
      <form action="/api/auth/update-password" className="mt-6 grid gap-4" method="post">
        <CsrfHiddenInput />
        <label className="grid gap-2">
          <span className="text-sm font-black">New password</span>
          <input className="rounded-lg border border-pearl/10 bg-ink px-4 py-3" minLength={8} name="password" type="password" required />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-black">Confirm password</span>
          <input className="rounded-lg border border-pearl/10 bg-ink px-4 py-3" minLength={8} name="confirmPassword" type="password" required />
        </label>
        <Button type="submit">Update password</Button>
      </form>
    </Card>
  );
}
