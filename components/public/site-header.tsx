import Link from "next/link";
import { AaxLogo } from "@/components/brand/aax-logo";
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
    <header className="sticky top-0 z-50 border-b border-pearl/10 bg-[#0b1016]/82 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[86rem] items-center justify-between px-5 py-4">
        <Link className="font-black tracking-normal" href="/">
          <AaxLogo compact className="text-pearl" />
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
