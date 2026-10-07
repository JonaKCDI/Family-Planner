import type { ReactNode } from "react";
import "./setup.css";

export default function FinanceSetupLayout({ children }: { children: ReactNode }) {
  return <div className="finance-setup-space">{children}</div>;
}
