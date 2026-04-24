import { Button } from "@/components/ui/button";

export function GoogleButton({
  label = "Continue with Google",
  next = "/app"
}: {
  label?: string;
  next?: string;
}) {
  return (
    <form action="/api/auth/google" method="post">
      <input name="next" type="hidden" value={next} />
      <Button className="w-full bg-pearl text-ink hover:bg-pearl/90" type="submit" variant="secondary">
        <span className="mr-3 flex h-5 w-5 items-center justify-center rounded bg-white text-sm font-black text-ink">G</span>
        {label}
      </Button>
    </form>
  );
}
