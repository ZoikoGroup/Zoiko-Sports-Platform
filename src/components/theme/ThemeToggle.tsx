"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={(e) => toggleTheme({ x: e.clientX, y: e.clientY })}
      className={`neu-inset-sm relative flex h-10 w-[74px] shrink-0 items-center rounded-full p-1 ${className}`}
    >
      <span
        className={`neu-sm grid size-8 place-items-center rounded-full transition-transform duration-500 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] ${
          dark ? "translate-x-[34px]" : "translate-x-0"
        }`}
      >
        <Sun
          className={`absolute size-[18px] text-yellow transition-all duration-500 ${dark ? "rotate-90 scale-0" : "rotate-0 scale-100"}`}
        />
        <Moon
          className={`absolute size-[18px] text-primary transition-all duration-500 ${dark ? "rotate-0 scale-100" : "-rotate-90 scale-0"}`}
        />
      </span>
    </button>
  );
}
