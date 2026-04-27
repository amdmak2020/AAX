import Link from "next/link";
import { GoogleButton } from "@/components/auth/google-button";
import { CsrfHiddenInput } from "@/components/security/csrf-hidden-input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function SignupPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next ?? "/app";

  return (
    <Card className="w-full max-w-md">
      <h1 className="text-3xl font-black">Create your account</h1>
      <p className="mt-2 text-sm text-pearl/62">Start free and upgrade later if you want more boosts.</p>
      {params.error ? (
        <div className="mt-4 rounded-lg border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-pearl/80">{params.error}</div>
      ) : null}
      <div className="mt-6">
        <GoogleButton label="Sign up with Google" next={next} />
      </div>
      <div className="my-6 flex items-center gap-3 text-xs font-bold uppercase text-pearl/38">
        <span className="h-px flex-1 bg-pearl/10" />
        or use email
        <span className="h-px flex-1 bg-pearl/10" />
      </div>
      <form className="grid gap-4" action="/api/auth/signup" method="post">
        <CsrfHiddenInput />
        <input name="next" type="hidden" value={next} />
        <label className="grid gap-2">
          <span className="text-sm font-black">Name</span>
          <input className="rounded-lg border border-pearl/10 bg-ink px-4 py-3" name="name" required />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-black">Email</span>
          <input className="rounded-lg border border-pearl/10 bg-ink px-4 py-3" name="email" type="email" required />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-black">Password</span>
          <input className="rounded-lg border border-pearl/10 bg-ink px-4 py-3" name="password" type="password" required />
        </label>
        <Button type="submit">Create account</Button>
      </form>
      <p className="mt-4 rounded-lg border border-mint/20 bg-mint/10 px-3 py-2 text-xs leading-5 text-pearl/62">Email signup needs confirmation. After that, you’re in.</p>
      <p className="mt-5 text-sm text-pearl/58">
        Already have an account?{" "}
        <Link className="font-bold text-mint" href={next !== "/app" ? `/login?next=${encodeURIComponent(next)}` : "/login"}>
          Sign in
        </Link>
      </p>
    </Card>
  );
}
