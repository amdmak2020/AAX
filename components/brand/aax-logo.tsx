import { cn } from "@/lib/utils";

type AaxLogoProps = {
  className?: string;
  compact?: boolean;
  mono?: boolean;
  showWordmark?: boolean;
};

export function AaxLogo({
  className,
  compact = false,
  mono = false,
  showWordmark = true
}: AaxLogoProps) {
  const gradientId = compact ? "aax-a-gradient-compact" : "aax-a-gradient";
  const fill = mono ? "currentColor" : `url(#${gradientId})`;

  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <svg aria-hidden="true" className="shrink-0" fill="none" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        {!mono ? (
          <defs>
            <linearGradient id={gradientId} x1="10" x2="56" y1="54" y2="12" gradientUnits="userSpaceOnUse">
              <stop stopColor="#A03BFF" />
              <stop offset="0.55" stopColor="#5A7BFF" />
              <stop offset="1" stopColor="#21C8FF" />
            </linearGradient>
          </defs>
        ) : null}

        <path
          d="M11.8 53c-1.8 0-3.3-1.2-3.8-3-.4-1.4-.1-2.8.7-4L28.6 13.5c1.5-2.5 3.4-3.9 5.6-3.9 2.3 0 4.2 1.4 5.7 4.1L58.6 46c.7 1.2 1 2.6.6 3.9-.5 1.8-2 3.1-3.8 3.1-1 0-2-.4-2.8-1l-7-3.3c-1.4-.7-2.4-1.7-3-3l-6.9-12.5c-.5-.9-1.2-1.4-2-1.4-.8 0-1.5.5-2 1.4l-3.1 5.8 4.3 7.7c.5 1 .4 2.2-.2 3.1-.7 1-1.8 1.6-3 1.6H11.8Z"
          fill={fill}
        />
        <path
          d="M24.3 41.1c4.7 0 8.6-3.4 9.7-8 1.1 4.6 5 8 9.7 8-4.7 0-8.6 3.4-9.7 8-1.1-4.6-5-8-9.7-8Z"
          fill={mono ? "currentColor" : "#55D9FF"}
          opacity={mono ? 0.8 : 1}
        />
        <rect x="43.2" y="35.8" width="2.8" height="2.8" rx="0.4" fill={mono ? "currentColor" : "#B8F4FF"} />
        <rect x="46.9" y="39.5" width="2.8" height="2.8" rx="0.4" fill={mono ? "currentColor" : "#B8F4FF"} />
        <rect x="43.2" y="43.2" width="2.8" height="2.8" rx="0.4" fill={mono ? "currentColor" : "#B8F4FF"} />
        <circle cx="53.2" cy="49.7" r="1.4" fill={mono ? "currentColor" : "#B8F4FF"} />
        <path d="M53.2 49.8 57 53.5" stroke={mono ? "currentColor" : "#B8F4FF"} strokeLinecap="round" strokeWidth="1.8" />
      </svg>

      {showWordmark ? (
        <span className="leading-none">
          <span className="block text-base font-black">{compact ? "AutoAgentX" : "AutoAgentX Studio"}</span>
        </span>
      ) : null}
    </span>
  );
}
