"use client";

import { Car, ClipboardCheck, Euro, FileText, Home, PanelLeftClose, PanelLeftOpen, ScrollText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

const items = [
  { href: "/dashboard", label: "Cockpit", icon: Home },
  { href: "/aufgaben", label: "Aufgaben", icon: ClipboardCheck },
  { href: "/ausgaben", label: "Finanzen", icon: Euro },
  { href: "/kilometer", label: "Auto", icon: Car },
  { href: "/vertraege", label: "Verträge", icon: ScrollText },
  { href: "/dokumente", label: "Dokumente", icon: FileText }
];

export function Nav() {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribeToDesktopNav, getDesktopNavSnapshot, getServerDesktopNavSnapshot);

  function toggleCollapsed() {
    window.localStorage.setItem("family-app.desktop-nav-collapsed", String(!collapsed));
    window.dispatchEvent(new Event("family-app-desktop-nav-change"));
  }

  return (
    <nav className={collapsed ? "app-nav is-collapsed" : "app-nav"} aria-label="Hauptnavigation">
      <span className="app-nav-heading">Arbeitsbereiche</span>
      <div className="app-nav-items">
        {items.map((item) => (
          <Link className={pathname.startsWith(item.href) ? "active" : ""} href={item.href} key={item.href} title={item.label}>
            <span className="app-nav-icon" aria-hidden="true">
              <item.icon size={18} strokeWidth={2.2} />
            </span>
            <strong>{item.label}</strong>
          </Link>
        ))}
      </div>
      <button className="app-nav-collapse" type="button" onClick={toggleCollapsed} aria-label={collapsed ? "Navigation ausklappen" : "Navigation einklappen"} title={collapsed ? "Navigation ausklappen" : "Navigation einklappen"}>
        {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
        <span>{collapsed ? "Ausklappen" : "Einklappen"}</span>
      </button>
    </nav>
  );
}

function subscribeToDesktopNav(callback: () => void) {
  const notify = () => callback();
  window.addEventListener("storage", notify);
  window.addEventListener("family-app-desktop-nav-change", notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener("family-app-desktop-nav-change", notify);
  };
}

function getDesktopNavSnapshot() {
  return window.localStorage.getItem("family-app.desktop-nav-collapsed") === "true";
}

function getServerDesktopNavSnapshot() {
  return false;
}
