import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function CheckEmailPage({
  searchParams
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const params = await searchParams;

  return (
    <Card className="w-full max-w-md text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-mint text-ink">
        <MailCheck className="h-7 w-7" />
      </div>
      <h1 className="mt-6 text-3xl font-black">Check your email</h1>
      <p className="mt-3 leading-7 text-pearl/66">
        We sent a confirmation link{params.email ? ` to ${params.email}` : ""}. Open it once, then sign in and upload your first clip.
      </p>
      <Button className="mt-7 w-full" href="/login">
        Back to sign in
      </Button>
      <p className="mt-5 text-sm text-pearl/50">
        Used Google instead?{" "}
        <Link className="font-bold text-mint" href="/login">
          Continue from sign in
        </Link>
      </p>
    </Card>
  );
}
