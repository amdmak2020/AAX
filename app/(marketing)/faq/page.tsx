import { Card } from "@/components/ui/card";
import { faqs } from "@/lib/product";

export default function FaqPage() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-16">
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
