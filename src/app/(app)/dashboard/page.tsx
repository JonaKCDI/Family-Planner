import Link from "next/link";
import { updateTaskStatus } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { ensureDueContractExpenses } from "@/lib/contract-auto-expenses";
import { getContractNextCancellationDate } from "@/lib/contracts";
import { formatDate, formatMoney } from "@/lib/format";
import {
  addFuelDerivedFields,
  calculateFuelStatsFromDerived,
  formatDecimal,
  formatKilometers
} from "@/lib/mileage";
import { ensureDueRecurringTasks } from "@/lib/recurring-tasks";
import { daysUntil, isImportantTask, taskRank, taskUrgency } from "@/lib/tasks";
import {
  getFuelEntriesForCar,
  getVisibleCars,
  getVisibleCategories,
  getVisibleContracts,
  getVisibleDocuments,
  getVisibleExpenses,
  getRecurringTransactions,
  getVisibleTasks
} from "@/lib/queries";
import { Chip, MetricCard, SectionCard, StatusBadge } from "@/components/ui-system";

export default async function DashboardPage() {
  const session = await requireSession();
  await Promise.all([
    ensureDueContractExpenses(session.family.id, session.user.id),
    ensureDueRecurringTasks(session.family.id, session.user.id)
  ]);
  const [expenses, tasks, contracts, documents, categories, recurringTransactions, cars] = await Promise.all([
    getVisibleExpenses(session.family.id, session.user.id),
    getVisibleTasks(session.family.id, session.user.id),
    getVisibleContracts(session.family.id, session.user.id),
    getVisibleDocuments(session.family.id, session.user.id),
    getVisibleCategories(session.family.id, session.user.id, "EXPENSE"),
    getRecurringTransactions(session.family.id, session.user.id),
    getVisibleCars(session.family.id)
  ]);

  const today = new Date();
  const greeting = getGreeting(today);
  const monthEntries = expenses.filter((entry) => isSameMonth(entry.date, today));
  const income = sumByKind(monthEntries, "INCOME");
  const spending = sumByKind(monthEntries, "EXPENSE");
  const saldo = income - spending;
  const recurringIntervals = buildRecurringIntervalMap(recurringTransactions);
  const finance = buildFinanceInsight(expenses, categories, today, recurringIntervals);
  const monthBudget = categories.reduce((sum, category) => sum + category.monthlyBudgetCents, 0);
  const netConsumption = Math.max(0, spending - income);
  const remainingBudget = Math.max(0, monthBudget - netConsumption);
  const latestEntries = expenses.slice(0, 5);
  const openTasks = tasks
    .filter((task) => task.status === "OPEN" || task.status === "IN_PROGRESS")
    .sort((a, b) => taskRank(b) - taskRank(a));
  const importantTasks = openTasks.filter(isImportantTask);
  const dueTasks = openTasks.filter((task) => daysUntil(task.dueDate) <= 0);
  const nextContracts = contracts
    .filter((contract) => contract.status === "ACTIVE")
    .map((contract) => ({ ...contract, nextCancellationDate: getContractNextCancellationDate(contract) }))
    .filter((contract) => contract.nextCancellationDate)
    .sort((a, b) => new Date(a.nextCancellationDate ?? 0).getTime() - new Date(b.nextCancellationDate ?? 0).getTime())
    .slice(0, 3);
  const vehicleSummaries = await buildVehicleSummaries(session.family.id, cars.slice(0, 2));

  return (
    <div className="cockpit-page">
      <header className="cockpit-greeting">
        <span className="eyebrow">{longDateFormatter.format(today)}</span>
        <h1>{greeting}, {session.user.name}</h1>
        <p>Ein ruhiger Überblick für {session.family.name}: was fällig ist, was läuft und wo du kurz hinschauen solltest.</p>
      </header>

      <section className="cockpit-metrics" aria-label="Statusübersicht">
        <MetricCard label="Ausgaben" value={formatMoney(spending)} detail={monthBudget > 0 ? `${formatMoney(remainingBudget)} Budget frei` : `${monthEntries.length} Einträge`} tone={monthBudget > 0 && remainingBudget <= 0 ? "negative" : "warning"} />
        <MetricCard label="Monatsende" value={formatMoney(finance.projectedMonth)} detail={finance.hasHistory ? "Prognose aus Verlauf" : "Verlauf baut sich auf"} tone={finance.projectionTone === "red" ? "negative" : finance.projectionTone === "amber" ? "warning" : "neutral"} />
        <MetricCard label="Aufgaben" value={openTasks.length} detail={`${dueTasks.length} fällig · ${importantTasks.length} wichtig`} tone={dueTasks.length > 0 ? "negative" : importantTasks.length > 0 ? "warning" : "positive"} />
        <MetricCard label="Kündigung" value={nextContracts[0]?.nextCancellationDate ? formatDate(nextContracts[0].nextCancellationDate) : "-"} detail={nextContracts.length > 0 ? `${nextContracts.length} Fristen im Blick` : "Keine Frist hinterlegt"} tone={nextContracts.length > 0 ? "neutral" : "positive"} />
      </section>

      <section className="cockpit-grid">
        <SectionCard className="cockpit-section cockpit-next-tasks">
          <SectionHead eyebrow="Aufgaben" title="Als Nächstes" href="/aufgaben" />
          <div className="cockpit-list">
            {openTasks.length === 0 ? <p className="empty-inline">Alles erledigt.</p> : null}
            {openTasks.slice(0, 4).map((task) => {
              const urgency = taskUrgency(task);
              return (
                <article className={`cockpit-task ${urgency.className}`} key={task.id}>
                  <span className="cockpit-task-accent" aria-hidden="true" />
                  <div>
                    <strong>{task.title}</strong>
                    <span className="item-meta">{task.assignee?.name ?? "Nicht zugewiesen"} · {formatDate(task.dueDate)}</span>
                  </div>
                  <form action={updateTaskStatus} className="cockpit-task-status">
                    <input type="hidden" name="id" value={task.id} />
                    <input type="hidden" name="status" value="DONE" />
                    <button className="task-check" type="submit" aria-label={`${task.title} als erledigt markieren`} title="Erledigt markieren">
                      <span aria-hidden="true">✓</span>
                    </button>
                  </form>
                  <StatusBadge tone={isImportantTask(task) ? "negative" : "warning"}>{urgency.label}</StatusBadge>
                </article>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard className="cockpit-section cockpit-finance">
          <SectionHead eyebrow="Finanzen" title="Dein Monat" href={finance.monthHref} />
          <div className="cockpit-mini-grid">
            <MiniMetric label="Ausgaben" value={formatMoney(spending)} tone="red" />
            <MiniMetric label="Einnahmen" value={formatMoney(income)} tone="green" />
            <MiniMetric label="Saldo" value={formatMoney(saldo)} tone={saldo < 0 ? "red" : "green"} />
            <MiniMetric label="Budget frei" value={monthBudget > 0 ? formatMoney(remainingBudget) : "-"} tone={remainingBudget <= 0 && monthBudget > 0 ? "red" : "green"} />
          </div>
          <div className="cockpit-comparison" aria-label="Ausgaben im Vergleich">
            {finance.comparisonRows.map((row) => (
              <div className="cockpit-bar-row" key={row.label}>
                <div>
                  <strong>{row.label}</strong>
                  <span className="muted">{row.detail}</span>
                </div>
                <span className="cockpit-bar" aria-hidden="true"><span style={{ width: `${row.width}%`, background: row.color }} /></span>
                <strong>{formatMoney(row.amount)}</strong>
              </div>
            ))}
          </div>
          <div className="cockpit-subsection">
            <h3 className="section-title">Letzte Buchungen</h3>
            <div className="cockpit-list">
              {latestEntries.length === 0 ? <p className="empty-inline">Noch keine Buchungen.</p> : null}
              {latestEntries.map((entry) => (
                <Link className="cockpit-booking" href={finance.monthHref} key={entry.id}>
                  <span>
                    <strong>{entry.description || entry.category?.name || "Buchung"}</strong>
                    <small>{formatDate(entry.date)} · {entry.category?.name ?? "Ohne Kategorie"}</small>
                  </span>
                  <strong className={entry.kind === "INCOME" ? "positive" : "negative"}>
                    {entry.kind === "INCOME" ? "+" : "-"}{formatMoney(entry.amountCents)}
                  </strong>
                </Link>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard className="cockpit-section">
          <SectionHead eyebrow="Verträge" title="Kündigungsfristen" href="/vertraege" />
          <div className="cockpit-list">
            {nextContracts.length === 0 ? <p className="empty-inline">Keine Fristen hinterlegt.</p> : null}
            {nextContracts.map((contract) => (
              <Link className={`cockpit-contract ${contractUrgencyClass(contract.nextCancellationDate)}`} href="/vertraege" key={contract.id}>
                <span className="cockpit-contract-accent" aria-hidden="true" />
                <span>
                  <strong>{contract.provider}</strong>
                  <small>{contract.contractType} · {formatMoney(contract.costCents, contract.currency)}</small>
                </span>
                <StatusBadge tone={contractUrgencyTone(contract.nextCancellationDate)}>{formatDate(contract.nextCancellationDate)}</StatusBadge>
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard className="cockpit-section">
          <SectionHead eyebrow="Auto" title="Verbrauch" href="/kilometer" />
          <div className="cockpit-list">
            {vehicleSummaries.length === 0 ? <p className="empty-inline">Noch kein aktives Auto mit Tankdaten.</p> : null}
            {vehicleSummaries.map((vehicle) => (
              <Link className="cockpit-vehicle" href={`/kilometer?car=${vehicle.id}`} key={vehicle.id}>
                <span>
                  <strong>{vehicle.name}</strong>
                  <small>{vehicle.licensePlate || "Ohne Kennzeichen"}</small>
                </span>
                <span className="cockpit-vehicle-values">
                  <strong>{formatDecimal(vehicle.latestConsumption)} l/100 km</strong>
                  <small>{vehicle.latestDate ? `Letzter Tankstopp ${formatDate(vehicle.latestDate)}` : "Noch kein Tankstopp"}</small>
                  <small>Ø {formatDecimal(vehicle.averageConsumption)} l · {formatKilometers(vehicle.lastOdometerKm)} km</small>
                </span>
              </Link>
            ))}
          </div>
        </SectionCard>
      </section>

      {finance.attentionSignals.length > 0 || importantTasks.length > 0 ? (
        <section className="cockpit-priority-strip">
          <strong>Kurzer Fokus</strong>
          <span>
            {importantTasks.length > 0 ? `${importantTasks.length} wichtige Aufgaben` : null}
            {importantTasks.length > 0 && finance.attentionSignals.length > 0 ? " · " : null}
            {finance.attentionSignals.length > 0 ? `${finance.attentionSignals.length} Finanzsignale` : null}
          </span>
          <div className="badge-row">
            {finance.attentionSignals.slice(0, 2).map((signal) => (
              <Chip tone="warning" key={signal.name}>{signal.name}</Chip>
            ))}
          </div>
        </section>
      ) : null}

      <section className="cockpit-documents">
        <SectionHead eyebrow="Dokumente" title="Zuletzt" href="/dokumente" />
        <div className="cockpit-document-row">
          {documents.length === 0 ? <p className="empty-inline">Noch keine Dokumente.</p> : null}
          {documents.slice(0, 3).map((document) => (
            <a className="document-item" href={dashboardDocumentHref(document)} key={document.id} target={document.referenceType === "LOCAL_FILE" ? undefined : "_blank"} rel={document.referenceType === "LOCAL_FILE" ? undefined : "noreferrer"}>
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
  );
}

function dashboardDocumentHref(document: DocumentEntry) {
  if (document.referenceType === "LOCAL_FILE") return `/api/documents/file?id=${encodeURIComponent(document.id)}`;
  return document.url;
}

function SectionHead({ eyebrow, title, href }: { eyebrow: string; title: string; href: string }) {
  return (
    <div className="card-head cockpit-section-head">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      <Link className="text-link" href={href}>Alle</Link>
    </div>
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

async function buildVehicleSummaries(familyId: string, cars: CarEntry[]) {
  const rows = await Promise.all(cars.map(async (car) => {
    const entries = await getFuelEntriesForCar(familyId, car.id);
    const derived = addFuelDerivedFields(entries);
    const latest = [...derived].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.odometerKm - a.odometerKm)[0] ?? null;
    const stats = calculateFuelStatsFromDerived(derived);
    return {
      id: car.id,
      name: car.name,
      licensePlate: car.licensePlate,
      latestDate: latest?.date ?? null,
      latestConsumption: latest?.litersPer100Km ?? null,
      averageConsumption: stats.averageLitersPer100Km,
      lastOdometerKm: stats.lastOdometerKm
    };
  }));
  return rows.filter((row) => row.latestDate || row.lastOdometerKm);
}

function contractUrgencyTone(date: Date | string | null | undefined): "negative" | "warning" | "neutral" {
  const days = daysUntil(date);
  if (days <= 30) return "negative";
  if (days <= 90) return "warning";
  return "neutral";
}

function contractUrgencyClass(date: Date | string | null | undefined) {
  const tone = contractUrgencyTone(date);
  if (tone === "negative") return "contract-critical";
  if (tone === "warning") return "contract-warning";
  return "contract-calm";
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
type DocumentEntry = Awaited<ReturnType<typeof getVisibleDocuments>>[number];
type RecurringTransactionEntry = Awaited<ReturnType<typeof getRecurringTransactions>>[number];
type CarEntry = Awaited<ReturnType<typeof getVisibleCars>>[number];

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
