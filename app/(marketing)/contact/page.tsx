import { Button } from "@/components/ui/button";

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <p className="text-sm font-black uppercase text-mint">Contact</p>
      <h1 className="mt-3 text-5xl font-black">Need help improving a clip?</h1>
      <p className="mt-6 text-lg leading-8 text-pearl/70">
        Send your question to support@retentionbooster.example. We usually reply within one business day.
      </p>
      <Button className="mt-8" href="/signup">
        Try it free
      </Button>
    </main>
  );
}
