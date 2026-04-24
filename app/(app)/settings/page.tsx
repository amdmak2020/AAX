import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCurrentAppData } from "@/lib/supabase/data";

export default async function SettingsPage() {
  const { account } = await getCurrentAppData();

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm font-black uppercase text-mint">Settings</p>
      <h1 className="mt-3 text-4xl font-black md:text-5xl">Account settings</h1>
      <div className="mt-8 grid gap-5">
        <Card>
          <h2 className="text-2xl font-black">Profile</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-black">Name</span>
              <input className="rounded-lg border border-pearl/10 bg-ink px-4 py-3" defaultValue={account.name} />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-black">Email</span>
              <input className="rounded-lg border border-pearl/10 bg-ink px-4 py-3" defaultValue={account.email} />
            </label>
          </div>
          <Button className="mt-6">Save changes</Button>
        </Card>
        <Card>
          <h2 className="text-2xl font-black">Default generation preferences</h2>
          <p className="mt-3 text-pearl/62">Default voice, style, and brand presets can live here after the first launch.</p>
        </Card>
      </div>
    </div>
  );
}
