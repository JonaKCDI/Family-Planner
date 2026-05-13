"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Cockpit", icon: "HA" },
  { href: "/aufgaben", label: "Aufgaben", icon: "OK" },
  { href: "/ausgaben", label: "Finanzen", icon: "EU" },
  { href: "/vertraege", label: "Verträge", icon: "VE" },
  { href: "/dokumente", label: "Dokumente", icon: "DO" },
  { href: "/einstellungen", label: "Einstellungen", icon: "SE" }
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="nav" aria-label="Hauptnavigation">
      {items.map((item) => (
        <Link className={pathname.startsWith(item.href) ? "active" : ""} href={item.href} key={item.href}>
          <span className="nav-icon" aria-hidden="true">{item.icon}</span>
          <strong>{item.label}</strong>
        </Link>
      ))}
    </nav>
  );
}
