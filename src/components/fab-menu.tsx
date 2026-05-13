"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const defaults = [
  { href: "/kalender#termin-erfassen", label: "Termin" },
  { href: "/ausgaben#eintrag-erfassen", label: "Eintrag" },
  { href: "/aufgaben", label: "Aufgabe" },
  { href: "/vertraege", label: "Vertrag" },
  { href: "/dokumente", label: "Dokument" }
];

const byPath: Record<string, { href: string; label: string }[]> = {
  "/dashboard": defaults,
  "/kalender": [
    { href: "/kalender#termin-erfassen", label: "Termin erstellen" },
    { href: "/kalender#kalender-verbinden", label: "Kalender verbinden" }
  ],
  "/ausgaben": [
    { href: "/ausgaben#eintrag-erfassen", label: "Eintrag erfassen" },
    { href: "/ausgaben#kategorie-erfassen", label: "Kategorie" }
  ],
  "/aufgaben": [{ href: "/aufgaben", label: "Aufgabe erstellen" }],
  "/vertraege": [{ href: "/vertraege", label: "Vertrag erstellen" }],
  "/dokumente": [{ href: "/dokumente", label: "Dokument verknüpfen" }],
  "/einstellungen": [{ href: "/einstellungen", label: "Benutzer anlegen" }]
};

export function FabMenu() {
  const pathname = usePathname();
  const items = byPath[pathname] ?? defaults;

  return (
    <details className="fab-menu">
      <summary aria-label="Neu erstellen">+</summary>
      <div className="fab-options">
        {items.map((item) => (
          <Link href={item.href} key={`${item.href}-${item.label}`}>{item.label}</Link>
        ))}
      </div>
    </details>
  );
}
