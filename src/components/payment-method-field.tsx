"use client";

import { useId } from "react";

export function PaymentMethodField({ defaultValue = "", name = "paymentMethod" }: { defaultValue?: string; name?: string }) {
  const listId = useId();
  return (
    <label>
      Zahlungsart
      <input name={name} list={listId} defaultValue={defaultValue} placeholder="Karte" />
      <datalist id={listId}>
        {["Karte", "Bar", "Überweisung", "Lastschrift", "PayPal", "Apple Pay"].map((value) => <option value={value} key={value} />)}
      </datalist>
    </label>
  );
}
