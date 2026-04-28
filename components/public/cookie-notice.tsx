"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const storageKey = "aax-cookie-notice-dismissed";

export function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!window.localStorage.getItem(storageKey)) {
      setVisible(true);
    }
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 rounded-lg border border-pearl/15 bg-coal/95 px-4 py-3 shadow-2xl backdrop-blur md:left-auto md:max-w-md">
      <p className="text-sm leading-6 text-pearl/84">
        We use essential cookies for sign-in, security, billing, and keeping your session stable.{" "}
        <Link className="font-semibold text-mint hover:text-pearl" href="/privacy">
          Learn more
        </Link>
        .
      </p>
      <button
        className="mt-3 rounded-lg bg-mint px-4 py-2 text-sm font-bold text-ink transition hover:opacity-90"
        onClick={() => {
          window.localStorage.setItem(storageKey, "1");
          setVisible(false);
        }}
        type="button"
      >
        Got it
      </button>
    </div>
  );
}
