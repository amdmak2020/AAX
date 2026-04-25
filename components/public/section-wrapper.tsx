export function SectionWrapper({
  id,
  eyebrow,
  title,
  body,
  children
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  body?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="section-shell px-5 py-20" id={id}>
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          {eyebrow ? <p className="floating-eyebrow text-sm font-black uppercase text-mint">{eyebrow}</p> : null}
          <h2 className="mt-3 text-4xl font-black md:text-5xl">{title}</h2>
          {body ? <p className="mt-4 text-lg leading-8 text-pearl/66">{body}</p> : null}
        </div>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}
