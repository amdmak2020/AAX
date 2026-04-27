import Link from "next/link";
import { BarChart3, CreditCard, FolderOpen, Home, LogOut, PlusCircle, Settings, Shield } from "lucide-react";
import { AaxLogo } from "@/components/brand/aax-logo";
import { CsrfHiddenInput } from "@/components/security/csrf-hidden-input";
import { Button } from "@/components/ui/button";
import { formatCredits } from "@/lib/utils";

const items = [
  { label: "Dashboard", href: "/app", icon: Home },
  { label: "Create", href: "/app/create", icon: PlusCircle },
  { label: "Jobs", href: "/app/jobs", icon: FolderOpen },
  { label: "Billing", href: "/app/billing", icon: CreditCard },
  { label: "Settings", href: "/app/settings", icon: Settings },
  { label: "Admin", href: "/app/admin", icon: Shield }
];

export function AppSidebar({
  creditsUsed = 18,
  creditsTotal = 60,
  plan = "Creator"
}: {
  creditsUsed?: number;
  creditsTotal?: number;
  plan?: string;
}) {
  return (
    <aside className="border-pearl/10 bg-[#0f1216] p-4 md:min-h-screen md:w-64 md:border-r">
      <Link className="mb-8 block font-black" href="/app">
        <AaxLogo compact className="text-pearl" />
      </Link>
      <nav className="grid gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold text-pearl/70 transition hover:bg-white/[0.04] hover:text-pearl" href={item.href} key={item.label}>
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-8 rounded-lg border border-pearl/10 bg-white/[0.03] p-4">
        <BarChart3 className="h-5 w-5 text-pearl/72" />
        <p className="mt-3 text-sm font-black">{formatCredits(creditsUsed, creditsTotal)}</p>
        <p className="mt-1 text-xs leading-5 text-pearl/58">{plan} plan usage</p>
      </div>
      <form action="/api/auth/logout" className="mt-4" method="post">
        <CsrfHiddenInput />
        <Button className="w-full justify-center" type="submit" variant="secondary">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </form>
    </aside>
  );
}
