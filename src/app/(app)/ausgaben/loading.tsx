import { LoaderCircle } from "lucide-react";

export default function FinanceLoading() {
  return <div className="finance-loading-overlay" role="status" aria-live="polite" aria-label="Finanzdaten werden geladen">
    <div className="finance-loading-indicator">
      <LoaderCircle className="finance-loading-spinner" size={38} strokeWidth={2.2} aria-hidden="true" />
      <span>Finanzdaten werden geladen …</span>
    </div>
  </div>;
}
