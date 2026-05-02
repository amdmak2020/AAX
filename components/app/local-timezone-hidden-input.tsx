"use client";

import { useEffect, useState } from "react";

export function LocalTimezoneHiddenInput() {
  const [offsetMinutes, setOffsetMinutes] = useState("0");

  useEffect(() => {
    setOffsetMinutes(String(new Date().getTimezoneOffset()));
  }, []);

  return <input name="timezoneOffsetMinutes" type="hidden" value={offsetMinutes} />;
}
