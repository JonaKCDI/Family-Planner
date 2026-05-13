"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const defaults = [
  { href: "/ausgaben#eintrag-erfassen", label: "Eintrag" },
  { href: "/aufgaben#aufgabe-erfassen", label: "Aufgabe" },
  { href: "/vertraege#vertrag-erfassen", label: "Vertrag" },
  { href: "/dokumente#dokument-erfassen", label: "Dokument" }
];

const byPath: Record<string, { href: string; label: string }[]> = {
  "/dashboard": defaults,
  "/ausgaben": [
    { href: "/ausgaben#eintrag-erfassen", label: "Eintrag erfassen" },
    { href: "/ausgaben#kategorie-erfassen", label: "Kategorie" }
  ],
  "/aufgaben": [{ href: "/aufgaben#aufgabe-erfassen", label: "Aufgabe erstellen" }],
  "/vertraege": [{ href: "/vertraege#vertrag-erfassen", label: "Vertrag erstellen" }],
  "/dokumente": [{ href: "/dokumente#dokument-erfassen", label: "Dokument verknüpfen" }],
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
