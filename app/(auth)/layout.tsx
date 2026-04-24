import Link from "next/link";
import { brand } from "@/lib/app-config";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[0.9fr_1.1fr]">
      <section className="hidden bg-pearl text-ink lg:block">
        <div className="flex min-h-screen flex-col justify-between p-10">
          <Link className="flex items-center gap-3 font-black" href="/">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-mint">RB</span>
            {brand.shortName}
          </Link>
          <div>
            <p className="max-w-lg text-5xl font-black leading-tight">Turn boring clips into high-retention shorts.</p>
            <p className="mt-5 max-w-md text-lg leading-8 text-ink/68">
              Better hooks, cleaner subtitles, and tighter pacing without learning a complicated editor.
            </p>
          </div>
          <p className="text-sm text-ink/48">Built for creators posting to TikTok, Reels, and Shorts.</p>
        </div>
      </section>
      <section className="flex min-h-screen items-center justify-center px-5 py-12">{children}</section>
    </main>
  );
}
