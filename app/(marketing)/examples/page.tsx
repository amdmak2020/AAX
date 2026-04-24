import { ExamplePhone } from "@/components/public/example-phone";
import { examples } from "@/lib/product";

export default function ExamplesPage() {
  return (
    <main className="px-5 py-16">
      <section className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase text-coral">Examples</p>
          <h1 className="mt-3 text-5xl font-black md:text-7xl">See how a plain clip can come back sharper and more watchable.</h1>
          <p className="mt-6 text-lg leading-8 text-pearl/70">
            Use these placeholder examples to explain the transformation: stronger opening text, cleaner captions, and more retention-minded presentation.
          </p>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {examples.map((example, index) => (
            <div key={example.title}>
              <ExamplePhone index={index} />
              <h2 className="mt-5 text-2xl font-black">{example.title}</h2>
              <p className="mt-2 text-pearl/60">{example.label}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
