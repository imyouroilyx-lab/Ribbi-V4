import { useEffect, useState } from "react";

const STORAGE_KEY = "ribbi-invert-mode";

export function useInvertMode() {
  const [inverted, setInverted] = useState(false);

  // โหลดค่าจาก localStorage และซิงก์กับ class บน <html>
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const isInverted = stored === "true";
    setInverted(isInverted);
    document.documentElement.classList.toggle("inverted", isInverted);
  }, []);

  const toggle = () => {
    setInverted((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      document.documentElement.classList.toggle("inverted", next);
      return next;
    });
  };

  return { inverted, toggle };
}
