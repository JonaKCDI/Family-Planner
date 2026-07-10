"use client";

import { Car, ClipboardCheck, Euro, FileText, Home, ScrollText } from "lucide-react";
import { BottomNavigation } from "@/components/ui-system";

const items = [
  { href: "/dashboard", label: "Cockpit", icon: Home },
  { href: "/aufgaben", label: "Aufgaben", icon: ClipboardCheck },
  { href: "/ausgaben", label: "Finanzen", icon: Euro },
  { href: "/kilometer", label: "Auto", icon: Car },
  { href: "/vertraege", label: "Verträge", icon: ScrollText },
  { href: "/dokumente", label: "Dokumente", icon: FileText }
];

export function Nav() {
  return <BottomNavigation items={items} />;
}
