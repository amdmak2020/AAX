import Link from "next/link";
import { AaxLogo } from "@/components/brand/aax-logo";
import { brand } from "@/lib/app-config";

const links = [
  { label: "Pricing", href: "/pricing" },
  { label: "Examples", href: "/examples" },
  { label: "Contact", href: "/contact" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Refunds", href: "/refunds" }
];

export function SiteFooter() {
  return (
    <footer className="border-t border-pearl/10 bg-coal">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 md:flex-row md:items-center md:justify-between">
        <div>
          <AaxLogo compact className="text-pearl" />
          <p className="mt-2 max-w-md text-sm text-pearl/58">
            AI video editing for creators who want stronger hooks, cleaner subtitles, and more watchable shorts without the manual editing grind.
          </p>
          <p className="mt-2 text-xs text-pearl/40">{brand.supportEmail}</p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-pearl/64">
          {links.map((link) => (
            <Link className="hover:text-pearl" href={link.href} key={link.label}>
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
