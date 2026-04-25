import { PricingCard } from "@/components/public/pricing-card";
import { faqs, plans } from "@/lib/product";

export default function PricingPage() {
  return (
    <main className="px-5 py-16">
      <section className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase text-mint">Pricing</p>
          <h1 className="mt-3 text-5xl font-black md:text-7xl">Start free. Pay only when you want more boosts.</h1>
          <p className="mt-6 text-lg leading-8 text-pearl/70">
            Keep it simple: try the product on free, then upgrade when you want more monthly volume.
          </p>
          <p className="mt-4 text-sm leading-6 text-pearl/56">Free is live now. Paid plans run through Lemon Squeezy once your store details are connected.</p>
        </div>
        <div className="mt-12 grid gap-5 lg:grid-cols-4">
          {plans.map((plan) => (
            <PricingCard key={plan.name} plan={plan} />
          ))}
        </div>
      </section>
      <section className="mx-auto mt-20 max-w-4xl">
        <h2 className="text-3xl font-black">Quick answers</h2>
        <div className="mt-6 divide-y divide-pearl/10 rounded-lg border border-pearl/10">
          {faqs.map((faq) => (
            <div className="p-6" key={faq.question}>
              <h3 className="font-black">{faq.question}</h3>
              <p className="mt-2 leading-7 text-pearl/64">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
