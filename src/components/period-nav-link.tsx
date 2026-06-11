"use client";

import type React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

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
  const router = useRouter();

  useEffect(() => {
    router.prefetch(href);
  }, [href, router]);

  return (
    <Link
      {...props}
      href={href}
      prefetch
      className={[className, activeClassName].filter(Boolean).join(" ")}
    >
      {children}
    </Link>
  );
}
