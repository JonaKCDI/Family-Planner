import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Settings } from "lucide-react";
import clsx from "clsx";
import { LogoutForm } from "@/components/logout-form";

type AppShellProps = {
  children: ReactNode;
  navigation: ReactNode;
  createAction: ReactNode;
};

export function AppShell({ children, navigation, createAction }: AppShellProps) {
  return (
    <div className="shell app-shell">
      {children}
      {navigation}
      {createAction}
    </div>
  );
}

type AppHeaderProps = {
  appName: string;
  familyName: string;
  userName: string;
  logoutAction: (formData: FormData) => void | Promise<void>;
};

export function AppHeader({ appName, familyName, userName, logoutAction }: AppHeaderProps) {
  return (
    <header className="topbar app-header">
      <Link className="brand app-header-brand" href="/dashboard">
        <span className="brand-mark app-header-mark" aria-hidden="true">
          <Image src="/icon.svg" alt="" width={32} height={32} priority />
        </span>
        <span className="brand-copy app-header-copy">
          <strong>{appName}</strong>
          <span>{familyName} · {userName}</span>
        </span>
      </Link>
      <div className="topbar-actions app-header-actions">
        <Link className="topbar-icon-link app-header-icon-link" href="/einstellungen" aria-label="Einstellungen" title="Einstellungen">
          <Settings size={19} strokeWidth={2.2} />
        </Link>
        <LogoutForm action={logoutAction} />
      </div>
    </header>
  );
}

type AppMainProps = {
  children: ReactNode;
  className?: string;
};

export function AppMain({ children, className }: AppMainProps) {
  return <main className={clsx("content app-main", className)}>{children}</main>;
}
