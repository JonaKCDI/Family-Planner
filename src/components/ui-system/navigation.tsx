"use client";

import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

type NavigationItem = {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
};

export function BottomNavigation({ items }: { items: NavigationItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="app-nav bottom-navigation" aria-label="Hauptnavigation">
      {items.map((item) => (
        <BottomNavigationItem active={pathname.startsWith(item.href)} href={item.href} icon={<item.icon size={18} strokeWidth={2.2} />} key={item.href}>
          {item.label}
        </BottomNavigationItem>
      ))}
    </nav>
  );
}

type BottomNavigationItemProps = {
  active: boolean;
  href: string;
  icon: ReactNode;
  children: ReactNode;
};

export function BottomNavigationItem({ active, href, icon, children }: BottomNavigationItemProps) {
  const label = typeof children === "string" ? children : undefined;

  return (
    <Link className={clsx(active && "active")} href={href} title={label} aria-current={active ? "page" : undefined}>
      <span className="app-nav-icon bottom-navigation-icon" aria-hidden="true">
        {icon}
      </span>
      <strong>{children}</strong>
    </Link>
  );
}
