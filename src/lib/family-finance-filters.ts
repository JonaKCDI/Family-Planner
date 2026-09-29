import { normalizeFamilyFinanceParams } from "./family-finance-params";
import type { ExpenseFilterParams } from "./expense-filter-url";
import { getMonthKey } from "./expense-filter-url";
import { getExpenseRange, dateKey } from "./expense-range";

type SharedEntry = { date: Date; currency: string; amountCents: number; description: string; store: string; paymentMethod: string; person: { id: string; name: string }; categoryId: string | null; labelId: string | null; category: { name: string } | null; label: { name: string } | null };
const values = (value: string | string[] | null | undefined) => Array.isArray(value) ? value : value ? [value] : [];

export function getFamilyExpenseRange(entries: { date: Date }[], params: ExpenseFilterParams, today = new Date()) {
  params = normalizeFamilyFinanceParams(params);
  if (params.from || params.to) {
    const dates = entries.map(e => dateKey(e.date)).sort();
    return getExpenseRange({ from: params.from || dates[0] || dateKey(today), to: params.to || dates.at(-1) || dateKey(today) }, getMonthKey(today));
  }
  return getExpenseRange({ month: params.month, year: params.year }, getMonthKey(today));
}

export function filterFamilyExpenses<T extends SharedEntry>(entries: T[], params: ExpenseFilterParams, today = new Date()) {
  params = normalizeFamilyFinanceParams(params);
  const currency = /^[A-Z]{3}$/.test(params.currency || "") ? params.currency! : "EUR";
  const month = (!params.from && !params.to && !params.year ? params.month : "") || (!params.year && !params.from && !params.to ? today.toISOString().slice(0, 7) : "");
  const query = (params.q || "").trim().toLocaleLowerCase("de");
  return entries.filter(entry => {
    const date = entry.date.toISOString().slice(0, 10);
    return entry.currency === currency && (!params.person || entry.person.id === params.person)
      && (!month || date.startsWith(month)) && (!params.year || date.startsWith(params.year))
      && (!params.from || date >= params.from) && (!params.to || date <= params.to)
      && (!values(params.category).length || values(params.category).includes(entry.categoryId ?? "unassigned"))
      && (!values(params.label).length || values(params.label).includes(entry.labelId ?? "unassigned"))
      && (!values(params.paymentMethod).length || values(params.paymentMethod).includes(entry.paymentMethod))
      && (!query || [entry.description, entry.store, entry.paymentMethod, entry.person.name, entry.category?.name, entry.label?.name, date, (entry.amountCents / 100).toFixed(2), (entry.amountCents / 100).toFixed(2).replace(".", ",")].join(" ").toLocaleLowerCase("de").includes(query));
  }).sort((a, b) => params.sort === "amount-desc" ? b.amountCents - a.amountCents : params.sort === "amount-asc" ? a.amountCents - b.amountCents : params.sort === "date-asc" ? a.date.getTime() - b.date.getTime() : b.date.getTime() - a.date.getTime());
}

export function familyPersonTotals<T extends SharedEntry>(entries: T[]) {
  const total = entries.reduce((sum, e) => sum + e.amountCents, 0);
  const people = new Map<string, { id: string; name: string; amount: number; percent: number | null }>();
  for (const e of entries) {
    const person = people.get(e.person.id) ?? { ...e.person, amount: 0, percent: null };
    person.amount += e.amountCents;
    people.set(person.id, person);
  }
  return [...people.values()].map(p => ({ ...p, percent: total > 0 ? p.amount / total * 100 : null })).sort((a, b) => b.amount - a.amount);
}

type FamilyTransferLike = {
  senderUserId: string;
  recipientUserId: string;
  amountCents: number;
  currency: string;
  date: Date;
};

/** Actual spending remains intact; transfers only change the net contribution. */
export function familyPersonPositions<T extends SharedEntry>(entries: T[], transfers: FamilyTransferLike[]) {
  const positions = new Map<string, { id: string; name: string; spending: number; sent: number; received: number; net: number; percent: number | null }>();
  const total = entries.reduce((sum, entry) => sum + entry.amountCents, 0);
  for (const entry of entries) {
    const current = positions.get(entry.person.id) ?? { id: entry.person.id, name: entry.person.name, spending: 0, sent: 0, received: 0, net: 0, percent: null };
    current.spending += entry.amountCents;
    positions.set(entry.person.id, current);
  }
  for (const transfer of transfers) {
    const sender = positions.get(transfer.senderUserId) ?? { id: transfer.senderUserId, name: "Unbekannt", spending: 0, sent: 0, received: 0, net: 0, percent: null };
    sender.sent += transfer.amountCents;
    positions.set(sender.id, sender);
    const recipient = positions.get(transfer.recipientUserId) ?? { id: transfer.recipientUserId, name: "Unbekannt", spending: 0, sent: 0, received: 0, net: 0, percent: null };
    recipient.received += transfer.amountCents;
    positions.set(recipient.id, recipient);
  }
  return [...positions.values()].map(position => ({
    ...position,
    net: position.spending + position.sent - position.received,
    percent: total > 0 ? position.spending / total * 100 : null
  })).sort((a, b) => b.spending - a.spending || a.name.localeCompare(b.name, "de"));
}
