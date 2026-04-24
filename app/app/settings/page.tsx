import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getViewerWorkspace } from "@/lib/app-data";

export default async function AppSettingsPage() {
  const workspace = await getViewerWorkspace();
  if (!workspace) return null;

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm font-black uppercase text-mint">Settings</p>
      <h1 className="mt-3 text-4xl font-black md:text-5xl">Account settings</h1>

      <div className="mt-8 grid gap-5">
        <Card>
          <h2 className="text-2xl font-black">Profile</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-black">Full name</span>
              <input className="rounded-lg border border-pearl/10 bg-ink px-4 py-3" defaultValue={workspace.profile.full_name} />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-black">Email</span>
              <input className="rounded-lg border border-pearl/10 bg-ink px-4 py-3" defaultValue={workspace.profile.email} />
            </label>
          </div>
          <Button className="mt-6">Save changes</Button>
        </Card>

        <Card>
          <h2 className="text-2xl font-black">Defaults</h2>
          <p className="mt-3 leading-7 text-pearl/62">
            Subtitle style, default preset, and preferred platform defaults can live here as the product grows.
          </p>
        </Card>
      </div>
    </div>
  );
}
