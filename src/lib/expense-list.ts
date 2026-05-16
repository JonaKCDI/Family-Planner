export type ExpenseListItem = {
  id: string;
  kind: "EXPENSE" | "INCOME";
  amountCents: number;
  currency: string;
  date: string;
  paymentMethod: string;
  store: string;
  categoryId: string | null;
  labelId: string | null;
  contractId: string | null;
  description: string;
  category: { id: string; name: string; color: string } | null;
  label: { id: string; name: string; color: string } | null;
  contract: { id: string; provider: string; contractType: string } | null;
};

export type ExpenseDocumentItem = {
  id: string;
  title: string;
  url: string;
  linkedEntityId: string | null;
};

export function toExpenseListItem(expense: {
  id: string;
  kind: "EXPENSE" | "INCOME";
  amountCents: number;
  currency: string;
  date: Date;
  paymentMethod: string;
  store: string;
  categoryId: string | null;
  labelId: string | null;
  contractId: string | null;
  description: string;
  category: { id: string; name: string; color: string } | null;
  label: { id: string; name: string; color: string } | null;
  contract: { id: string; provider: string; contractType: string } | null;
}): ExpenseListItem {
  return {
    id: expense.id,
    kind: expense.kind,
    amountCents: expense.amountCents,
    currency: expense.currency,
    date: expense.date.toISOString(),
    paymentMethod: expense.paymentMethod,
    store: expense.store,
    categoryId: expense.categoryId,
    labelId: expense.labelId,
    contractId: expense.contractId,
    description: expense.description,
    category: expense.category ? { id: expense.category.id, name: expense.category.name, color: expense.category.color } : null,
    label: expense.label ? { id: expense.label.id, name: expense.label.name, color: expense.label.color } : null,
    contract: expense.contract ? { id: expense.contract.id, provider: expense.contract.provider, contractType: expense.contract.contractType } : null
  };
}

export function toExpenseDocumentItem(document: {
  id: string;
  title: string;
  url: string;
  linkedEntityId: string | null;
}): ExpenseDocumentItem {
  return {
    id: document.id,
    title: document.title,
    url: document.url,
    linkedEntityId: document.linkedEntityId
  };
}
