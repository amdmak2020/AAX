import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app/app-sidebar";
import { getViewerWorkspace } from "@/lib/app-data";

export default async function ProductAppLayout({ children }: { children: React.ReactNode }) {
  const workspace = await getViewerWorkspace();
  if (!workspace) {
    redirect("/login?next=/app");
  }

  return (
    <div className="min-h-screen md:flex">
      <AppSidebar
        creditsTotal={workspace.subscription.credits_total}
        creditsUsed={workspace.subscription.credits_used}
        plan={workspace.subscription.plan_key}
      />
      <div className="min-w-0 flex-1">
        <header className="border-b border-pearl/10 bg-ink/70 px-5 py-4 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase text-pearl/46">Account</p>
              <p className="font-black">{workspace.profile.full_name || workspace.profile.email}</p>
            </div>
            <div className="rounded-lg border border-pearl/10 px-3 py-2 text-sm text-pearl/70">{workspace.subscription.plan_key} plan</div>
          </div>
        </header>
        <main className="px-5 py-8">{children}</main>
      </div>
    </div>
  );
}
