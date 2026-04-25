import Link from "next/link";
import { AaxLogo } from "@/components/brand/aax-logo";
import { brand } from "@/lib/app-config";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[0.9fr_1.1fr]">
      <section className="hidden bg-pearl text-ink lg:block">
        <div className="flex min-h-screen flex-col justify-between p-10">
          <Link className="font-black text-ink" href="/">
            <AaxLogo compact mono className="text-ink" />
          </Link>
          <div>
            <p className="max-w-lg text-5xl font-black leading-tight">Turn boring clips into high-retention shorts.</p>
            <p className="mt-5 max-w-md text-lg leading-8 text-ink/68">
              {brand.name} helps creators improve hooks, subtitles, and pacing without learning a complicated editor.
            </p>
          </div>
          <p className="text-sm text-ink/48">Built for creators posting to TikTok, Reels, and Shorts.</p>
        </div>
      </section>
      <section className="flex min-h-screen items-center justify-center px-5 py-12">{children}</section>
    </main>
  );
}
