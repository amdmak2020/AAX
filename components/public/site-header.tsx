import Link from "next/link";
import { navItems } from "@/lib/product";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  let isLoggedIn = false;

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    isLoggedIn = Boolean(user);
  } catch {
    isLoggedIn = false;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-pearl/10 bg-ink/86 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        <Link className="flex items-center gap-3 font-black tracking-normal" href="/">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-mint text-ink">RB</span>
          <span>Retention Booster</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-pearl/72 md:flex">
          {navItems.map((item) => (
            <Link className="transition hover:text-pearl" href={item.href} key={item.label}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <>
              <Button href="/app" variant="ghost">
                Dashboard
              </Button>
              <Button className="hidden sm:inline-flex" href="/app/create">
                Boost My Video
              </Button>
            </>
          ) : (
            <>
              <Button href="/login" variant="ghost">
                Sign In
              </Button>
              <Button className="hidden sm:inline-flex" href="/signup">
                Boost My Video
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
