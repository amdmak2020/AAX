import type { Metadata } from "next";
import { ClickSpark } from "@/components/effects/click-spark";
import { marketingCopy } from "@/lib/product";
import "./globals.css";

export const metadata: Metadata = {
  title: marketingCopy.title,
  description: marketingCopy.description
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
