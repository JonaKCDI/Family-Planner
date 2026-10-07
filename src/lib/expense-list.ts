export type ExpenseListItem = {
  personName?: string;
  canEdit?: boolean;
  editExpense?: ExpenseListItem;
  sharedWithFamily?: boolean;
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
  fuelEntryId: string | null;
  recurringTransactionId: string | null;
  generatedByContract: boolean;
  generatedByFuelEntry: boolean;
  generatedByRecurringTransaction: boolean;
  description: string;
  category: { id: string; name: string; color: string; icon: string } | null;
  label: { id: string; name: string; color: string } | null;
  contract: { id: string; provider: string; contractType: string } | null;
  recurringTransaction: {
    id: string;
    title: string;
    description: string;
    kind: "EXPENSE" | "INCOME";
    paymentMethod: string;
    store: string;
    categoryId: string | null;
    labelId: string | null;
    startDate: string;
    endDate: string | null;
    status: "ACTIVE" | "PAUSED";
    sharedWithFamily: boolean;
    pricePhases: { id: string; amountCents: number; billingInterval: string; validFrom: string }[];
  } | null;
  fuelEntry: { id: string; odometerKm: number; car: { id: string; name: string } } | null;
};

export type ExpenseDocumentItem = {
  id: string;
  title: string;
  url: string;
  linkedEntityId: string | null;
};

export function toExpenseListItem(expense: {
  sharedWithFamily?: boolean;
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
  fuelEntryId: string | null;
  recurringTransactionId: string | null;
  generatedByContract: boolean;
  generatedByFuelEntry: boolean;
  generatedByRecurringTransaction: boolean;
  description: string;
  category: { id: string; name: string; color: string; icon: string } | null;
  label: { id: string; name: string; color: string } | null;
  contract: { id: string; provider: string; contractType: string } | null;
  recurringTransaction: {
    id: string; title: string; description: string; kind: "EXPENSE" | "INCOME"; paymentMethod: string; store: string;
    categoryId: string | null; labelId: string | null; startDate: Date; endDate: Date | null; status: "ACTIVE" | "PAUSED";
    sharedWithFamily: boolean; pricePhases?: { id: string; amountCents: number; billingInterval: string; validFrom: Date }[];
  } | null;
  fuelEntry: { id: string; odometerKm: number; car: { id: string; name: string } } | null;
}): ExpenseListItem {
  return {
    sharedWithFamily: expense.sharedWithFamily ?? false,
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
    fuelEntryId: expense.fuelEntryId,
    recurringTransactionId: expense.recurringTransactionId,
    generatedByContract: expense.generatedByContract,
    generatedByFuelEntry: expense.generatedByFuelEntry,
    generatedByRecurringTransaction: expense.generatedByRecurringTransaction,
    description: expense.description,
    category: expense.category ? { id: expense.category.id, name: expense.category.name, color: expense.category.color, icon: expense.category.icon } : null,
    label: expense.label ? { id: expense.label.id, name: expense.label.name, color: expense.label.color } : null,
    contract: expense.contract ? { id: expense.contract.id, provider: expense.contract.provider, contractType: expense.contract.contractType } : null,
    recurringTransaction: expense.recurringTransaction ? {
      id: expense.recurringTransaction.id, title: expense.recurringTransaction.title, description: expense.recurringTransaction.description,
      kind: expense.recurringTransaction.kind, paymentMethod: expense.recurringTransaction.paymentMethod, store: expense.recurringTransaction.store,
      categoryId: expense.recurringTransaction.categoryId, labelId: expense.recurringTransaction.labelId,
      startDate: expense.recurringTransaction.startDate.toISOString(), endDate: expense.recurringTransaction.endDate?.toISOString() ?? null,
      status: expense.recurringTransaction.status, sharedWithFamily: expense.recurringTransaction.sharedWithFamily,
      pricePhases: (expense.recurringTransaction.pricePhases ?? []).map((phase) => ({ id: phase.id, amountCents: phase.amountCents, billingInterval: phase.billingInterval, validFrom: phase.validFrom.toISOString() }))
    } : null,
    fuelEntry: expense.fuelEntry ? {
      id: expense.fuelEntry.id,
      odometerKm: expense.fuelEntry.odometerKm,
      car: { id: expense.fuelEntry.car.id, name: expense.fuelEntry.car.name }
    } : null
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
