import Link from "next/link";
import { updateTaskStatus } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { ensureDueContractExpenses } from "@/lib/contract-auto-expenses";
import { getContractNextCancellationDate } from "@/lib/contracts";
import { formatDate, formatMoney } from "@/lib/format";
import { ensureDueRecurringTasks } from "@/lib/recurring-tasks";
import { isImportantTask, taskRank } from "@/lib/tasks";
import {
  getVisibleCategories,
  getVisibleContracts,
  getVisibleDocuments,
  getVisibleExpenses,
  getRecurringTransactions,
  getVisibleTasks
} from "@/lib/queries";

export default async function DashboardPage() {
  const session = await requireSession();
  await Promise.all([
    ensureDueContractExpenses(session.family.id, session.user.id),
    ensureDueRecurringTasks(session.family.id, session.user.id)
  ]);
  const [expenses, tasks, contracts, documents, categories, recurringTransactions] = await Promise.all([
    getVisibleExpenses(session.family.id, session.user.id),
    getVisibleTasks(session.family.id, session.user.id),
    getVisibleContracts(session.family.id, session.user.id),
    getVisibleDocuments(session.family.id, session.user.id),
    getVisibleCategories(session.family.id, session.user.id, "EXPENSE"),
    getRecurringTransactions(session.family.id, session.user.id)
  ]);

  const today = new Date();
  const greeting = getGreeting(today);
  const monthEntries = expenses.filter((entry) => isSameMonth(entry.date, today));
  const income = sumByKind(monthEntries, "INCOME");
  const spending = sumByKind(monthEntries, "EXPENSE");
  const saldo = income - spending;
  const recurringIntervals = buildRecurringIntervalMap(recurringTransactions);
  const finance = buildFinanceInsight(expenses, categories, today, recurringIntervals);
  const openTasks = tasks
    .filter((task) => task.status === "OPEN" || task.status === "IN_PROGRESS")
    .sort((a, b) => taskRank(b) - taskRank(a));
  const importantTasks = openTasks.filter(isImportantTask);
  const nextContracts = contracts
    .filter((contract) => contract.status === "ACTIVE")
    .map((contract) => ({ ...contract, nextCancellationDate: getContractNextCancellationDate(contract) }))
    .filter((contract) => contract.nextCancellationDate)
    .sort((a, b) => new Date(a.nextCancellationDate ?? 0).getTime() - new Date(b.nextCancellationDate ?? 0).getTime())
    .slice(0, 3);

  return (
    <div className="dashboard">
      <header className="dashboard-hero compact-hero">
        <div>
          <span className="eyebrow">{longDateFormatter.format(today)}</span>
          <h1>{greeting}, {session.user.name}</h1>
          <p>Alles Wichtige für {session.family.name}: Aufgaben, Finanzen, Verträge und Dokumente an einem Ort.</p>
        </div>
      </header>

      <section className="dashboard-stats" aria-label="Haushaltsübersicht">
        <DashboardStat label="Einnahmen" value={formatMoney(income)} detail="Dieser Monat" tone="green" />
        <DashboardStat label="Ausgaben" value={formatMoney(spending)} detail={`${monthEntries.length} Einträge`} tone="red" />
        <DashboardStat label="Saldo" value={formatMoney(saldo)} detail={saldo < 0 ? "Monat prüfen" : "Aktueller Stand"} tone={saldo < 0 ? "red" : "green"} />
        <DashboardStat label="Monatsende" value={formatMoney(finance.projectedMonth)} detail={finance.hasHistory ? "Wenn es so weitergeht" : "Verlauf baut sich auf"} tone={finance.projectionTone} />
        <DashboardStat label="Aufgaben" value={`${openTasks.length} offen`} detail={`${importantTasks.length} wichtig`} tone={importantTasks.length > 0 ? "amber" : "blue"} />
      </section>

      <div className="dashboard-grid">
        <section className="dashboard-card dashboard-card-large">
          <div className="card-head">
            <div>
              <span className="eyebrow">Finanzen</span>
              <h2>Dein Monat</h2>
            </div>
            <Link className="text-link" href={finance.monthHref}>Details</Link>
          </div>
          <div className="dashboard-mini-grid">
            <MiniMetric label="Bisher" value={formatMoney(finance.spendingToDate)} tone="red" />
            <MiniMetric label="Sonst bis heute" value={finance.hasHistory ? formatMoney(finance.usualByToday) : "-"} tone="green" />
            <MiniMetric label="Unterschied" value={finance.hasHistory ? formatSignedMoney(finance.deltaToNormal) : "Noch kein Vergleich"} tone={finance.deltaToNormal > 0 ? "red" : "green"} />
            <MiniMetric label="Monatsende" value={formatMoney(finance.projectedMonth)} tone={finance.projectionTone === "red" ? "red" : "green"} />
          </div>
          <div className="dashboard-list" aria-label="Ausgaben im Vergleich">
            {finance.comparisonRows.map((row) => (
              <div className="analysis-row" key={row.label}>
                <div>
                  <strong>{row.label}</strong>
                  <span className="muted">{row.detail}</span>
                </div>
                <div className="bar-wrap" aria-hidden="true">
                  <span style={{ width: `${row.width}%`, background: row.color }} />
                </div>
                <div className="amount-column compact-amount">
                  <strong>{formatMoney(row.amount)}</strong>
                </div>
              </div>
            ))}
          </div>
          <div>
            <h3 className="section-title">Achtung</h3>
            <div className="dashboard-list">
              {finance.attentionSignals.length === 0 ? <p className="empty-inline">Kein Handlungsbedarf im steuerbaren Verlauf.</p> : null}
              {finance.attentionSignals.map((signal) => (
                <div className="analysis-row" key={signal.name}>
                  <div>
                    {signal.href ? <Link className="text-link" href={signal.href}>{signal.name}</Link> : <strong>{signal.name}</strong>}
                    <span className="muted">{signal.detail}</span>
                  </div>
                  <div className="bar-wrap" aria-hidden="true">
                    <span style={{ width: `${signal.width}%`, background: signal.color }} />
                  </div>
                  <div className="amount-column compact-amount">
                    <strong className={signal.delta > 0 ? "negative" : "positive"}>{formatSignedMoney(signal.delta)}</strong>
                    <small>{formatMoney(signal.amount)}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="section-title">Entlastend</h3>
            <div className="dashboard-list">
              {finance.reliefSignals.length === 0 ? <p className="empty-inline">Keine deutliche Entlastung gegenüber normal.</p> : null}
              {finance.reliefSignals.map((signal) => (
                <div className="analysis-row signal-relief-row" key={signal.name}>
                  <div>
                    {signal.href ? <Link className="text-link" href={signal.href}>{signal.name}</Link> : <strong>{signal.name}</strong>}
                    <span className="muted">{signal.detail}</span>
                  </div>
                  <div className="bar-wrap" aria-hidden="true">
                    <span style={{ width: `${signal.width}%`, background: signal.color }} />
                  </div>
                  <div className="amount-column compact-amount">
                    <strong className="positive">{formatSignedMoney(signal.delta)}</strong>
                    <small>{formatMoney(signal.amount)}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="dashboard-card">
          <div className="card-head">
            <div>
              <span className="eyebrow">Aufgaben</span>
              <h2>Als Nächstes</h2>
            </div>
            <Link className="text-link" href="/aufgaben">Alle</Link>
          </div>
          <div className="dashboard-list">
            {openTasks.length === 0 ? <p className="empty-inline">Alles erledigt.</p> : null}
            {openTasks.slice(0, 4).map((task) => (
              <article className="task-item" key={task.id}>
                <form action={updateTaskStatus} className="dashboard-task-complete">
                  <input type="hidden" name="id" value={task.id} />
                  <input type="hidden" name="status" value="DONE" />
                  <button className={`task-check ${isImportantTask(task) ? "urgent" : ""}`} type="submit" aria-label={`${task.title} als erledigt markieren`} title="Erledigt markieren">
                    <span aria-hidden="true">✓</span>
                  </button>
                </form>
                <div>
                  <strong>{task.title}</strong>
                  <span className="item-meta">{task.assignee?.name ?? "Nicht zugewiesen"} · Fällig: {formatDate(task.dueDate)}</span>
                </div>
                <span className={`status-chip ${isImportantTask(task) ? "danger-chip" : "warning-chip"}`}>
                  {priorityLabels[task.priority]}
                </span>
              </article>
            ))}
          </div>
        </section>

        <section className="dashboard-card">
          <div className="card-head">
            <div>
              <span className="eyebrow">Verträge</span>
              <h2>Fristen</h2>
            </div>
            <Link className="text-link" href="/vertraege">Alle</Link>
          </div>
          <div className="dashboard-list">
            {nextContracts.length === 0 ? <p className="empty-inline">Keine Fristen hinterlegt.</p> : null}
            {nextContracts.map((contract) => (
              <article className="agenda-item" key={contract.id}>
                <span className="agenda-accent amber-accent" />
                <div>
                  <span className="item-meta">{formatDate(contract.nextCancellationDate)}</span>
                  <strong>{contract.provider}</strong>
                  <span className="item-meta">{contract.contractType} · {formatMoney(contract.costCents, contract.currency)}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="dashboard-card">
          <div className="card-head">
            <div>
              <span className="eyebrow">Dokumente</span>
              <h2>Zuletzt</h2>
            </div>
            <Link className="text-link" href="/dokumente">Alle</Link>
          </div>
          <div className="dashboard-list">
            {documents.length === 0 ? <p className="empty-inline">Noch keine Dokumente.</p> : null}
            {documents.slice(0, 3).map((document) => (
              <a className="document-item" href={document.url} key={document.id} target="_blank" rel="noreferrer">
                <span className="doc-icon">{document.referenceType === "EXTERNAL_URL" ? "URL" : "PDF"}</span>
                <span>
                  <strong>{document.title}</strong>
                  <span className="item-meta">{document.owner.name} · {formatDate(document.createdAt)}</span>
                </span>
              </a>
            ))}
          </div>
        </section>
      </div>

      {importantTasks.length > 0 ? (
        <section className="priority-strip">
          <strong>{importantTasks.length} wichtige Aufgaben</strong>
          <span>Wichtig bedeutet: überfällig, heute fällig, dringend markiert, bald fällig oder hoch priorisiert mit naher Deadline.</span>
          <Link className="button secondary" href="/aufgaben">Aufgaben prüfen</Link>
        </section>
      ) : null}
    </div>
  );
}

function DashboardStat({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "green" | "red" | "blue" | "amber" }) {
  return (
    <article className={`dashboard-stat ${tone}-stat`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function MiniMetric({ label, value, tone }: { label: string; value: string; tone: "green" | "red" }) {
  return (
    <div className={`mini-metric ${tone}-metric`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function isSameMonth(date: Date, compare: Date) {
  const value = new Date(date);
  return value.getMonth() === compare.getMonth() && value.getFullYear() === compare.getFullYear();
}

function sumByKind(entries: Awaited<ReturnType<typeof getVisibleExpenses>>, kind: "EXPENSE" | "INCOME") {
  return entries.filter((entry) => entry.kind === kind).reduce((sum, entry) => sum + entry.amountCents, 0);
}

const priorityLabels = {
  LOW: "Niedrig",
  MEDIUM: "Mittel",
  HIGH: "Hoch",
  URGENT: "Dringend"
};

const berlinTimeZone = "Europe/Berlin";
const longDateFormatter = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "long", timeZone: berlinTimeZone });

type ExpenseEntry = Awaited<ReturnType<typeof getVisibleExpenses>>[number];
type CategoryEntry = Awaited<ReturnType<typeof getVisibleCategories>>[number];
type RecurringTransactionEntry = Awaited<ReturnType<typeof getRecurringTransactions>>[number];

function buildFinanceInsight(expenses: ExpenseEntry[], categories: CategoryEntry[], today: Date, recurringIntervals: RecurringIntervalMap) {
  const currentMonthKey = getMonthKey(today);
  const monthHref = `/ausgaben?month=${currentMonthKey}`;
  const currentEntries = expenses.filter((entry) => (
    isSameMonth(entry.date, today) &&
    new Date(entry.date) <= endOfDay(today) &&
    isSteerableExpense(entry, recurringIntervals)
  ));
  const spendingToDate = sumByKind(currentEntries, "EXPENSE");
  const comparableMonths = buildComparableMonths(expenses, today, 6, recurringIntervals);
  const hasHistory = comparableMonths.length > 0;
  const usualByToday = hasHistory ? robustAverage(comparableMonths.map((month) => month.spendingToDate)) : 0;
  const usualFullMonth = hasHistory ? robustAverage(comparableMonths.map((month) => month.fullMonthSpending)) : 0;
  const projectedMonth = projectMonth(spendingToDate, today);
  const deltaToNormal = spendingToDate - usualByToday;
  const maxComparison = Math.max(spendingToDate, usualByToday, projectedMonth, usualFullMonth, 1);
  const isCurrentlyAboveNormal = hasHistory && deltaToNormal > Math.max(2000, usualByToday * 0.05);
  const projectionTone: "red" | "amber" | "blue" = isCurrentlyAboveNormal && projectedMonth > usualFullMonth * 1.15
    ? "red"
    : isCurrentlyAboveNormal && projectedMonth > usualFullMonth * 1.05
      ? "amber"
      : "blue";
  const signals = buildCategorySignals(expenses, categories, today, comparableMonths, monthHref, recurringIntervals);

  return {
    hasHistory,
    spendingToDate,
    usualByToday,
    usualFullMonth,
    projectedMonth,
    deltaToNormal,
    projectionTone,
    monthHref,
    comparisonRows: [
      {
        label: "Ausgaben bisher",
        detail: `${getBerlinDayOfMonth(today)}. Tag im Monat, ohne Einmal-, Jahres- und Quartalskosten`,
        amount: spendingToDate,
        color: "var(--accent)",
        width: percentOf(spendingToDate, maxComparison)
      },
      {
        label: "Sonst bis heute",
        detail: hasHistory ? `Typischer Stand aus ${comparableMonths.length} Monaten` : "Noch kein Vergleichsverlauf",
        amount: usualByToday,
        color: "var(--blue)",
        width: percentOf(usualByToday, maxComparison)
      },
      {
        label: "Wenn es so weitergeht",
        detail: hasHistory ? `Sonst im ganzen Monat: ${formatMoney(usualFullMonth)}` : "Wird mit mehr Daten genauer",
        amount: projectedMonth,
        color: projectionTone === "red" ? "var(--red)" : projectionTone === "amber" ? "var(--amber)" : "var(--green)",
        width: percentOf(projectedMonth, maxComparison)
      }
    ],
    attentionSignals: signals.attention,
    reliefSignals: signals.relief
  };
}

function buildComparableMonths(expenses: ExpenseEntry[], today: Date, count: number, recurringIntervals: RecurringIntervalMap) {
  return Array.from({ length: count }, (_, index) => shiftMonth(today, -(index + 1)))
    .map((monthDate) => {
      const monthEntries = expenses.filter((entry) => isSameMonth(entry.date, monthDate) && isSteerableExpense(entry, recurringIntervals));
      if (monthEntries.length === 0) return null;
      const cutoffDay = Math.min(getBerlinDayOfMonth(today), daysInMonth(monthDate));
      return {
        key: getMonthKey(monthDate),
        spendingToDate: sumByKind(monthEntries.filter((entry) => new Date(entry.date).getDate() <= cutoffDay), "EXPENSE"),
        fullMonthSpending: sumByKind(monthEntries, "EXPENSE")
      };
    })
    .filter((month): month is { key: string; spendingToDate: number; fullMonthSpending: number } => Boolean(month));
}

function buildCategorySignals(
  expenses: ExpenseEntry[],
  categories: CategoryEntry[],
  today: Date,
  comparableMonths: { key: string; spendingToDate: number; fullMonthSpending: number }[],
  monthHref: string,
  recurringIntervals: RecurringIntervalMap
) {
  if (comparableMonths.length === 0) return { attention: [], relief: [] };
  const categoryMeta = new Map(categories.map((category) => [category.id, category]));
  const currentEntries = expenses.filter((entry) => (
    entry.kind === "EXPENSE" &&
    isSameMonth(entry.date, today) &&
    new Date(entry.date) <= endOfDay(today) &&
    isSteerableExpense(entry, recurringIntervals)
  ));
  const currentByCategory = groupExpenseAmounts(currentEntries);
  const historicalByCategory = new Map<string, number[]>();
  for (const month of comparableMonths) {
    const monthDate = monthKeyToDate(month.key);
    const cutoffDay = Math.min(getBerlinDayOfMonth(today), daysInMonth(monthDate));
    const monthEntries = expenses.filter((entry) => (
      entry.kind === "EXPENSE" &&
      isSameMonth(entry.date, monthDate) &&
      new Date(entry.date).getDate() <= cutoffDay &&
      isSteerableExpense(entry, recurringIntervals)
    ));
    const grouped = groupExpenseAmounts(monthEntries);
    for (const key of new Set([...currentByCategory.keys(), ...grouped.keys()])) {
      const values = historicalByCategory.get(key) ?? [];
      values.push(grouped.get(key) ?? 0);
      historicalByCategory.set(key, values);
    }
  }

  const rows = [...new Set([...currentByCategory.keys(), ...historicalByCategory.keys()])]
    .map((key) => {
      const amount = currentByCategory.get(key) ?? 0;
      const usual = robustAverage(historicalByCategory.get(key) ?? []);
      const delta = amount - usual;
      const category = key === uncategorizedKey ? null : categoryMeta.get(key);
      return {
        name: category?.name ?? "Ohne Kategorie",
        color: category?.color ?? "#6b6f76",
        amount,
        usual,
        delta,
        href: category ? `${monthHref}&category=${category.id}` : monthHref,
        detail: usual > 0 ? `normal bis heute ${formatMoney(usual)}` : "sonst selten genutzt"
      };
    })
    .filter((row) => row.amount > 0 || row.usual > 0);

  return {
    attention: withSignalWidths(rows
      .filter((row) => isAttentionSignal(row.amount, row.usual, row.delta))
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 3)),
    relief: withSignalWidths(rows
      .filter((row) => isReliefSignal(row.usual, row.delta))
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 2))
  };
}

function groupExpenseAmounts(entries: ExpenseEntry[]) {
  const rows = new Map<string, number>();
  for (const entry of entries) {
    const key = entry.categoryId ?? uncategorizedKey;
    rows.set(key, (rows.get(key) ?? 0) + entry.amountCents);
  }
  return rows;
}

function projectMonth(spendingToDate: number, today: Date) {
  const elapsedDays = Math.max(1, today.getDate());
  return Math.round((spendingToDate / elapsedDays) * daysInMonth(today));
}

function shiftMonth(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function daysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthKeyToDate(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function getGreeting(date: Date) {
  const hour = getBerlinHour(date);
  if (hour >= 5 && hour < 11) return "Guten Morgen";
  if (hour >= 11 && hour < 18) return "Guten Tag";
  if (hour >= 18 && hour < 23) return "Guten Abend";
  return "Gute Nacht";
}

function getBerlinHour(date: Date) {
  const hour = new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    hour12: false,
    timeZone: berlinTimeZone
  }).formatToParts(date).find((part) => part.type === "hour")?.value;
  return Number(hour ?? "0");
}

function getBerlinDayOfMonth(date: Date) {
  const day = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    timeZone: berlinTimeZone
  }).formatToParts(date).find((part) => part.type === "day")?.value;
  return Number(day ?? date.getDate());
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function robustAverage(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length >= 5) return average(sorted.slice(1, -1));
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function withSignalWidths<T extends { amount: number; usual: number }>(rows: T[]) {
  const maxAmount = Math.max(...rows.map((row) => Math.max(row.amount, row.usual)), 1);
  return rows.map((row) => ({ ...row, width: percentOf(row.amount, maxAmount) }));
}

function isAttentionSignal(amount: number, usual: number, delta: number) {
  if (usual <= 0) return amount >= 5000;
  return delta >= signalThreshold(usual);
}

function isReliefSignal(usual: number, delta: number) {
  return usual >= 5000 && delta <= -signalThreshold(usual);
}

function signalThreshold(usual: number) {
  return Math.max(2500, Math.round(usual * 0.25));
}

function buildRecurringIntervalMap(recurringTransactions: RecurringTransactionEntry[]): RecurringIntervalMap {
  return new Map(recurringTransactions.map((transaction) => [transaction.id, transaction.pricePhases]));
}

function isSteerableExpense(entry: ExpenseEntry, recurringIntervals: RecurringIntervalMap) {
  if (entry.kind !== "EXPENSE") return true;
  const interval = linkedExpenseInterval(entry, recurringIntervals);
  return interval !== "ONCE" && interval !== "QUARTERLY" && interval !== "YEARLY";
}

function linkedExpenseInterval(entry: ExpenseEntry, recurringIntervals: RecurringIntervalMap): BillingInterval | null {
  const entryDate = new Date(entry.date);
  if (entry.contract) {
    return entry.contract.billingInterval;
  }
  if (entry.recurringTransactionId) {
    return pricePhaseInterval(recurringIntervals.get(entry.recurringTransactionId) ?? [], entryDate);
  }
  return null;
}

function pricePhaseInterval(phases: PricePhaseEntry[], date: Date): BillingInterval | null {
  return phases
    .filter((phase) => {
      const validFrom = new Date(phase.validFrom);
      const validTo = phase.validTo ? new Date(phase.validTo) : null;
      return validFrom.getTime() <= date.getTime() && (!validTo || date.getTime() <= validTo.getTime());
    })
    .sort((a, b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime())[0]?.billingInterval ?? null;
}

function percentOf(value: number, max: number) {
  return Math.max(value > 0 ? 4 : 0, Math.min(100, Math.round((value / max) * 100)));
}

function formatSignedMoney(amountCents: number) {
  if (amountCents === 0) return formatMoney(0);
  return `${amountCents > 0 ? "+" : "-"}${formatMoney(Math.abs(amountCents))}`;
}

const uncategorizedKey = "__uncategorized__";

type BillingInterval = "MONTHLY" | "QUARTERLY" | "YEARLY" | "ONCE" | "OTHER";
type PricePhaseEntry = {
  billingInterval: BillingInterval;
  validFrom: Date | string;
  validTo: Date | string | null;
};
type RecurringIntervalMap = Map<string, PricePhaseEntry[]>;
