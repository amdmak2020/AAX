import type { Metadata } from "next";
import { ClickSpark } from "@/components/effects/click-spark";
import { brand } from "@/lib/app-config";
import { marketingCopy } from "@/lib/product";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(brand.url),
  title: {
    default: marketingCopy.title,
    template: `%s | ${brand.name}`
  },
  description: marketingCopy.description,
  applicationName: brand.name,
  authors: [{ name: brand.name }],
  creator: brand.name,
  publisher: brand.name,
  category: "technology",
  keywords: [
    "AI video editor",
    "short form video editor",
    "TikTok video editor",
    "YouTube Shorts editor",
    "Instagram Reels editor",
    "subtitle generator",
    "hook generator",
    "retention editing",
    "creator tools",
    "AutoAgentX"
  ],
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    url: brand.url,
    siteName: brand.name,
    title: marketingCopy.title,
    description: marketingCopy.description,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${brand.name} AI video editor`
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: marketingCopy.title,
    description: marketingCopy.description,
    images: ["/twitter-image"]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/apple-icon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ClickSpark sparkColor="#fffaf0" sparkSize={7} sparkRadius={18} sparkCount={7} duration={420}>
          {children}
        </ClickSpark>
      </body>
    </html>
  );
}
