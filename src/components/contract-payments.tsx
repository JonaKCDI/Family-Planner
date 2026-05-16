"use client";

import { useState } from "react";
import { formatDate, formatMoney } from "@/lib/format";

type ContractPayment = {
  id: string;
  date: string;
  description: string;
  amountCents: number;
  currency: string;
};

type ContractPaymentsProps = {
  payments: ContractPayment[];
  totalCents: number;
  currency: string;
};

const pageSize = 6;

export function ContractPayments({ payments, totalCents, currency }: ContractPaymentsProps) {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const visiblePayments = payments.slice(0, visibleCount);
  const hiddenCount = payments.length - visiblePayments.length;

  return (
    <div className="contract-payments">
      <div className="contract-payments-head">
        <strong>Zahlungen</strong>
        <span>{formatMoney(totalCents, currency)}</span>
      </div>
      {payments.length === 0 ? (
        <p className="muted">Noch keine Ausgaben mit diesem Vertrag verknüpft.</p>
      ) : (
        <>
          <div className="contract-payment-list">
            {visiblePayments.map((payment) => (
              <div className="contract-payment-row" key={payment.id}>
                <span>{formatDate(payment.date)}</span>
                <span>{payment.description}</span>
                <strong>{formatMoney(payment.amountCents, payment.currency)}</strong>
              </div>
            ))}
          </div>
          {hiddenCount > 0 ? (
            <button className="button secondary contract-load-more" type="button" onClick={() => setVisibleCount((count) => count + pageSize)}>
              Mehr laden ({hiddenCount})
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
