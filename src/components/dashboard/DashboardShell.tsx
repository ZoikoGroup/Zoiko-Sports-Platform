"use client";

import { useCallback, useEffect, useState } from "react";
import { BrandLoader } from "@/components/brand/BrandLoader";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

const COLLAPSE_KEY = "zoiko-sidebar-collapsed";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [splash, setSplash] = useState(true);

  // Brief branded splash when the dashboard first mounts.
  useEffect(() => {
    const id = setTimeout(() => setSplash(false), 1300);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a saved preference after hydration
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {}
  }, []);

  const toggleCollapse = useCallback(() => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });
  }, []);

  // Ctrl/Cmd + B toggles the sidebar, like most editors.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        if (window.matchMedia("(min-width: 1024px)").matches) toggleCollapse();
        else setMenuOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleCollapse]);

  return (
    <div className="flex min-h-dvh">
      {splash && (
        <div className="[animation:fade-out_0.4s_ease_1s_forwards]">
          <BrandLoader label="Loading dashboard" />
        </div>
      )}
      <Sidebar
        open={menuOpen}
        collapsed={collapsed}
        onClose={() => setMenuOpen(false)}
        onToggleCollapse={toggleCollapse}
      />
      <div className="min-w-0 flex-1 px-4 pb-10 pt-5 sm:px-6 lg:px-8 lg:pt-7">
        <Topbar onMenu={() => setMenuOpen(true)} />
        <main className="mt-7">{children}</main>
      </div>
    </div>
  );
}
