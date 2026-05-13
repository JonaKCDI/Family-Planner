"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/ausgaben", label: "Ausgaben" },
  { href: "/aufgaben", label: "Aufgaben" },
  { href: "/vertraege", label: "Vertraege" },
  { href: "/kalender", label: "Kalender" },
  { href: "/dokumente", label: "Dokumente" },
  { href: "/einstellungen", label: "Einstellungen" }
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="nav" aria-label="Hauptnavigation">
      {items.map((item) => (
        <Link className={pathname.startsWith(item.href) ? "active" : ""} href={item.href} key={item.href}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
