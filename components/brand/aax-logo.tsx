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
  const gradientId = compact ? "aax-compact-gradient" : "aax-gradient";
  const stroke = mono ? "currentColor" : `url(#${gradientId})`;
  const fill = mono ? "currentColor" : `url(#${gradientId})`;

  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <svg aria-hidden="true" className="shrink-0" fill="none" viewBox={compact ? "0 0 52 52" : "0 0 60 52"} xmlns="http://www.w3.org/2000/svg">
        {!mono ? (
          <defs>
            <linearGradient id={gradientId} x1="4" x2="56" y1="44" y2="8" gradientUnits="userSpaceOnUse">
              <stop stopColor="#A03BFF" />
              <stop offset="0.52" stopColor="#5A7BFF" />
              <stop offset="1" stopColor="#55F7FF" />
            </linearGradient>
          </defs>
        ) : null}

        {!compact ? (
          <path
            d="M4 43 18.4 11.5c1.4-3 5.7-3 7.1 0L40 43h-8.3l-3.2-7.5H16L12.9 43H4Zm15.1-14.1h6.1l-3-7.2-3.1 7.2Z"
            fill={fill}
          />
        ) : null}

        <g transform={compact ? "translate(0 0)" : "translate(14 2)"}>
          <circle cx="18" cy="22" r="17" stroke={stroke} strokeWidth="3.5" />
          <path d="M9 42.2 14.1 35" stroke={stroke} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" />
          <path d="M2.5 22h3.4" stroke={stroke} strokeLinecap="round" strokeWidth="3.5" />
          <path d="M30.1 22h3.4" stroke={stroke} strokeLinecap="round" strokeWidth="3.5" />
          <path d="M18 2.8v3.6" stroke={stroke} strokeLinecap="round" strokeWidth="3.5" />
          <circle cx="18" cy="1.8" fill={mono ? "currentColor" : "#72F3FF"} r="1.8" />
          <rect x="8.5" y="14.5" width="19" height="15" rx="6.8" fill={mono ? "currentColor" : "#12151D"} opacity={mono ? 0.18 : 1} stroke={stroke} strokeWidth="2.8" />
          <circle cx="14.3" cy="21.9" fill={mono ? "currentColor" : "#7A7FFF"} r="1.9" />
          <circle cx="21.7" cy="21.9" fill={mono ? "currentColor" : "#55F7FF"} r="1.9" />
          <path d="M16.3 26.4c.7.7 2.7.7 3.4 0" stroke={stroke} strokeLinecap="round" strokeWidth="2.5" />
        </g>

        {!compact ? (
          <path
            d="m40.2 10.5 7.9 10.6L56 10.5h-7.6l-4.1 5.6-4.1-5.6h0ZM40 22.7l8.1 9.3L56 43H47.8l-3.8-5.3-3.8 5.3H32l8-10.9Z"
            fill={fill}
          />
        ) : null}
      </svg>

      {showWordmark ? (
        <span className="leading-none">
          <span className="block text-sm font-black uppercase tracking-[0.26em] text-pearl/58">AAX</span>
          <span className="block text-base font-black">{compact ? "AutoAgentX" : "AutoAgentX Studio"}</span>
        </span>
      ) : null}
    </span>
  );
}
