import type { ReactNode } from "react";
import { Pencil } from "lucide-react";
import { ActionModal } from "@/components/action-modal";

export function FinanceSetupEdit({ title, children }: { title: string; children: ReactNode }) {
  return <ActionModal title={title} trigger={<Pencil size={18} aria-hidden="true" />} triggerLabel={title} triggerClassName="icon-button finance-setup-icon" panelClassName="finance-setup-edit" sheetSize="large">{children}</ActionModal>;
}
