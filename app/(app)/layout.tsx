import { AppSidebar } from "@/components/app/app-sidebar";
import { getCurrentAppData } from "@/lib/supabase/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { account } = await getCurrentAppData();

  return (
    <div className="min-h-screen md:flex">
      <AppSidebar creditsTotal={account.creditsTotal} creditsUsed={account.creditsUsed} plan={account.plan} />
      <div className="min-w-0 flex-1">
        <header className="border-b border-pearl/10 bg-ink/70 px-5 py-4 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase text-pearl/46">Workspace</p>
              <p className="font-black">{account.name}</p>
            </div>
            <div className="rounded-lg border border-pearl/10 px-3 py-2 text-sm text-pearl/70">
              {account.plan} plan
            </div>
          </div>
        </header>
        <main className="px-5 py-8">{children}</main>
      </div>
    </div>
  );
}
