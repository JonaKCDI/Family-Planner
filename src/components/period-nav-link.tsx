"use client";

import type React from "react";
import Link from "next/link";

type PeriodNavLinkProps = {
  href: string;
  className?: string;
  activeClassName?: string;
  role?: string;
  title?: string;
  "aria-label"?: string;
  children: React.ReactNode;
};

export function PeriodNavLink({ href, className, activeClassName, children, ...props }: PeriodNavLinkProps) {
  return (
    <Link
      {...props}
      href={href}
      prefetch={false}
      className={[className, activeClassName].filter(Boolean).join(" ")}
    >
      {children}
    </Link>
  );
}
