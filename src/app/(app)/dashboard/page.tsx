import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { ensureDueContractExpenses } from "@/lib/contract-auto-expenses";
import { getContractNextCancellationDate } from "@/lib/contracts";
import { formatDate, formatMoney } from "@/lib/format";
import { isImportantTask, taskRank } from "@/lib/tasks";
import {
  getVisibleCategories,
  getVisibleContracts,
  getVisibleDocuments,
  getVisibleExpenses,
  getVisibleTasks
} from "@/lib/queries";

export default async function DashboardPage() {
  const session = await requireSession();
  await ensureDueContractExpenses(session.family.id, session.user.id);
  const [expenses, tasks, contracts, documents, categories] = await Promise.all([
    getVisibleExpenses(session.family.id, session.user.id),
    getVisibleTasks(session.family.id, session.user.id),
    getVisibleContracts(session.family.id, session.user.id),
    getVisibleDocuments(session.family.id, session.user.id),
    getVisibleCategories(session.family.id, session.user.id, "EXPENSE")
  ]);

  const today = new Date();
  const monthEntries = expenses.filter((entry) => isSameMonth(entry.date, today));
  const income = sumByKind(monthEntries, "INCOME");
  const spending = sumByKind(monthEntries, "EXPENSE");
  const saldo = income - spending;
  const finance = buildFinanceInsight(expenses, categories, today);
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
          <h1>Guten Abend, {session.user.name}</h1>
          <p>Alles Wichtige für {session.family.name}: Aufgaben, Finanzen, Verträge und Dokumente an einem Ort.</p>
        </div>
      </header>

      <section className="dashboard-stats" aria-label="Haushaltsübersicht">
        <DashboardStat label="Einnahmen" value={formatMoney(income)} detail="Dieser Monat" tone="green" />
        <DashboardStat label="Ausgaben" value={formatMoney(spending)} detail={`${monthEntries.length} Einträge`} tone="red" />
        <DashboardStat label="Saldo" value={formatMoney(saldo)} detail={saldo < 0 ? "Monat prüfen" : "Aktueller Stand"} tone={saldo < 0 ? "red" : "green"} />
        <DashboardStat label="Prognose" value={formatMoney(finance.projectedMonth)} detail={finance.hasHistory ? "Bei aktuellem Tempo" : "Verlauf baut sich auf"} tone={finance.projectionTone} />
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
            <MiniMetric label="Normal bis heute" value={finance.hasHistory ? formatMoney(finance.usualByToday) : "-"} tone="green" />
            <MiniMetric label="Abweichung" value={finance.hasHistory ? formatSignedMoney(finance.deltaToNormal) : "Noch kein Vergleich"} tone={finance.deltaToNormal > 0 ? "red" : "green"} />
            <MiniMetric label="Prognose" value={formatMoney(finance.projectedMonth)} tone={finance.projectionTone === "red" ? "red" : "green"} />
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
            <h3 className="section-title">Auffällig</h3>
            <div className="dashboard-list">
              {finance.categorySignals.length === 0 ? <p className="empty-inline">Noch kein auffälliger Verlauf.</p> : null}
              {finance.categorySignals.map((signal) => (
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
                <span className={`task-check ${isImportantTask(task) ? "urgent" : ""}`} />
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

const longDateFormatter = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "long" });

type ExpenseEntry = Awaited<ReturnType<typeof getVisibleExpenses>>[number];
type CategoryEntry = Awaited<ReturnType<typeof getVisibleCategories>>[number];

function buildFinanceInsight(expenses: ExpenseEntry[], categories: CategoryEntry[], today: Date) {
  const currentMonthKey = getMonthKey(today);
  const monthHref = `/ausgaben?month=${currentMonthKey}`;
  const currentEntries = expenses.filter((entry) => isSameMonth(entry.date, today) && new Date(entry.date) <= endOfDay(today));
  const spendingToDate = sumByKind(currentEntries, "EXPENSE");
  const comparableMonths = buildComparableMonths(expenses, today, 6);
  const hasHistory = comparableMonths.length > 0;
  const usualByToday = hasHistory ? average(comparableMonths.map((month) => month.spendingToDate)) : 0;
  const usualFullMonth = hasHistory ? average(comparableMonths.map((month) => month.fullMonthSpending)) : 0;
  const projectedMonth = projectMonth(spendingToDate, today);
  const deltaToNormal = spendingToDate - usualByToday;
  const maxComparison = Math.max(spendingToDate, usualByToday, projectedMonth, usualFullMonth, 1);
  const projectionTone: "red" | "amber" | "blue" = hasHistory && projectedMonth > usualFullMonth * 1.15
    ? "red"
    : hasHistory && projectedMonth > usualFullMonth * 1.05
      ? "amber"
      : "blue";

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
        label: "Bisher ausgegeben",
        detail: `${today.getDate()}. Tag im Monat`,
        amount: spendingToDate,
        color: "var(--accent)",
        width: percentOf(spendingToDate, maxComparison)
      },
      {
        label: "Normal bis heute",
        detail: hasHistory ? `Durchschnitt aus ${comparableMonths.length} Monaten` : "Noch kein Vergleichsverlauf",
        amount: usualByToday,
        color: "var(--blue)",
        width: percentOf(usualByToday, maxComparison)
      },
      {
        label: "Hochrechnung",
        detail: hasHistory ? `Normaler Monat: ${formatMoney(usualFullMonth)}` : "Wird mit mehr Daten genauer",
        amount: projectedMonth,
        color: projectionTone === "red" ? "var(--red)" : projectionTone === "amber" ? "var(--amber)" : "var(--green)",
        width: percentOf(projectedMonth, maxComparison)
      }
    ],
    categorySignals: buildCategorySignals(expenses, categories, today, comparableMonths, monthHref)
  };
}

function buildComparableMonths(expenses: ExpenseEntry[], today: Date, count: number) {
  return Array.from({ length: count }, (_, index) => shiftMonth(today, -(index + 1)))
    .map((monthDate) => {
      const monthEntries = expenses.filter((entry) => isSameMonth(entry.date, monthDate));
      if (monthEntries.length === 0) return null;
      const cutoffDay = Math.min(today.getDate(), daysInMonth(monthDate));
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
  monthHref: string
) {
  if (comparableMonths.length === 0) return [];
  const categoryMeta = new Map(categories.map((category) => [category.id, category]));
  const currentEntries = expenses.filter((entry) => entry.kind === "EXPENSE" && isSameMonth(entry.date, today) && new Date(entry.date) <= endOfDay(today));
  const currentByCategory = groupExpenseAmounts(currentEntries);
  const historicalByCategory = new Map<string, number[]>();
  for (const month of comparableMonths) {
    const monthDate = monthKeyToDate(month.key);
    const cutoffDay = Math.min(today.getDate(), daysInMonth(monthDate));
    const monthEntries = expenses.filter((entry) => (
      entry.kind === "EXPENSE" &&
      isSameMonth(entry.date, monthDate) &&
      new Date(entry.date).getDate() <= cutoffDay
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
      const usual = average(historicalByCategory.get(key) ?? []);
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
    .filter((row) => row.amount > 0 || row.usual > 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);
  const maxAmount = Math.max(...rows.map((row) => Math.max(row.amount, row.usual)), 1);
  return rows.map((row) => ({ ...row, width: percentOf(row.amount, maxAmount) }));
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

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function percentOf(value: number, max: number) {
  return Math.max(value > 0 ? 4 : 0, Math.min(100, Math.round((value / max) * 100)));
}

function formatSignedMoney(amountCents: number) {
  if (amountCents === 0) return formatMoney(0);
  return `${amountCents > 0 ? "+" : "-"}${formatMoney(Math.abs(amountCents))}`;
}

const uncategorizedKey = "__uncategorized__";
