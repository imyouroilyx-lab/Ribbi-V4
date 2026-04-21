"use client";

import { useInvertMode } from "@/hooks/useInvertMode";

export default function InvertToggle() {
  const { inverted, toggle } = useInvertMode();

  return (
    <button
      onClick={toggle}
      title={inverted ? "ปิด dark mode" : "เปิด dark mode"}
      aria-label={inverted ? "ปิด dark mode" : "เปิด dark mode"}
      className="invert-toggle"
      data-inverted={inverted ? "true" : "false"}
    >
      {inverted ? "☀️" : "🌙"}
    </button>
  );
}
