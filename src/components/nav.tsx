"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/ausgaben", label: "Ausgaben", icon: "EUR" },
  { href: "/aufgaben", label: "Aufgaben", icon: "OK" },
  { href: "/vertraege", label: "Verträge", icon: "V" },
  { href: "/kalender", label: "Kalender", icon: "K" },
  { href: "/dokumente", label: "Dokumente", icon: "D" },
  { href: "/einstellungen", label: "Einstellungen", icon: "SET" }
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="nav" aria-label="Hauptnavigation">
      {items.map((item) => (
        <Link className={pathname.startsWith(item.href) ? "active" : ""} href={item.href} key={item.href}>
          <span aria-hidden="true">{item.icon}</span>
          <strong>{item.label}</strong>
        </Link>
      ))}
    </nav>
  );
}
