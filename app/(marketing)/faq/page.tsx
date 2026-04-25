import type { Metadata } from "next";
import Script from "next/script";
import { Card } from "@/components/ui/card";
import { brand } from "@/lib/app-config";
import { faqs } from "@/lib/product";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers about AutoAgentX, AI video editing, subtitles, hooks, plans, and how the editing workflow works."
};

export default function FaqPage() {
  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer
      }
    })),
    publisher: {
      "@type": "Organization",
      name: brand.name,
      url: brand.url
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-5 py-16">
      <Script id="aax-faq-schema" type="application/ld+json">
        {JSON.stringify(faqStructuredData)}
      </Script>
      <p className="text-sm font-black uppercase text-mint">FAQ</p>
      <h1 className="mt-3 text-5xl font-black">Answers before your first boost</h1>
      <div className="mt-10 grid gap-4">
        {faqs.map((faq) => (
          <Card key={faq.question}>
            <h2 className="text-xl font-black">{faq.question}</h2>
            <p className="mt-3 leading-7 text-pearl/64">{faq.answer}</p>
          </Card>
        ))}
      </div>
    </main>
  );
}
