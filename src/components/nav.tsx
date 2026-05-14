"use client";

import { ClipboardCheck, Euro, FileText, Home, ScrollText, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Cockpit", icon: Home },
  { href: "/aufgaben", label: "Aufgaben", icon: ClipboardCheck },
  { href: "/ausgaben", label: "Finanzen", icon: Euro },
  { href: "/vertraege", label: "Verträge", icon: ScrollText },
  { href: "/dokumente", label: "Dokumente", icon: FileText },
  { href: "/einstellungen", label: "Einstellungen", icon: Settings }
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="nav" aria-label="Hauptnavigation">
      {items.map((item) => (
        <Link className={pathname.startsWith(item.href) ? "active" : ""} href={item.href} key={item.href} title={item.label}>
          <span className="nav-icon" aria-hidden="true">
            <item.icon size={18} strokeWidth={2.2} />
          </span>
          <strong>{item.label}</strong>
        </Link>
      ))}
    </nav>
  );
}
