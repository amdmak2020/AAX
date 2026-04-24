import Link from "next/link";
import { cn } from "@/lib/utils";

type ButtonProps = {
  children: React.ReactNode;
  href?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
};

export function Button({
  children,
  href,
  variant = "primary",
  className,
  type = "button",
  disabled = false
}: ButtonProps) {
  const classes = cn(
    "button-sheen inline-flex min-h-11 items-center justify-center rounded-lg px-5 py-2.5 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-mint/60",
    variant === "primary" && "bg-mint text-ink",
    variant === "secondary" && "border border-pearl/15 bg-pearl/10 text-pearl",
    variant === "ghost" && "text-pearl/78",
    variant === "danger" && "bg-coral text-ink",
    disabled && "cursor-not-allowed opacity-55 pointer-events-none",
    className
  );

  if (href && !disabled) {
    return (
      <Link className={classes} data-button-variant={variant} href={href}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} data-button-variant={variant} disabled={disabled} type={type}>
      {children}
    </button>
  );
}
