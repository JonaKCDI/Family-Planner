import type { ReactNode } from "react";
import Link from "next/link";
import { BanknoteArrowUp, CalendarCheck, CarFront, FileText, ReceiptText, Scale, Tag, TrendingUp, WalletCards } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureDueContractExpenses } from "@/lib/contract-auto-expenses";
import { getContractNextCancellationDate } from "@/lib/contracts";
import { buildBudgetAlerts, buildCategoryRows, buildLabelRows, budgetCadenceLabel, recentlyUsedLabelKeys, summarizeCategoryBudgets, sumByKind } from "@/lib/expense-analytics";
import { forecastCurrentMonthEnd } from "@/lib/expense-forecast";
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
  getVisibleCars,
  getVisibleCategories,
  getVisibleContracts,
  getVisibleDocuments,
  getVisibleExpenseSummaries,
  getExpenseLabels,
  getVisibleTasks
} from "@/lib/queries";
import { TaskInlineCheck } from "@/components/task-inline-check";
import { EmptyState, PageHeader, SectionCard, StatusBadge } from "@/components/ui";

export default async function DashboardPage() {
  const session = await requireSession();
  await Promise.all([
    ensureDueContractExpenses(session.family.id, session.user.id),
    ensureDueRecurringTasks(session.family.id, session.user.id)
  ]);
  const [expenses, tasks, contracts, documents, categories, labels, cars] = await Promise.all([
    getVisibleExpenseSummaries(session.family.id, session.user.id),
    getVisibleTasks(session.family.id, session.user.id),
    getVisibleContracts(session.family.id, session.user.id),
    getVisibleDocuments(session.family.id, session.user.id, 4),
    getVisibleCategories(session.family.id, session.user.id, "EXPENSE"),
    getExpenseLabels(session.family.id, session.user.id),
    getVisibleCars(session.family.id)
  ]);

  const today = new Date();
  const greeting = getGreeting(today);
  const monthEntries = expenses.filter((entry) => isSameMonth(entry.date, today));
  const recentMonthEntries = monthEntries.slice(0, 4);
  const latestUsedLabel = expenses.find((entry) => entry.label)?.label ?? null;
  const latestLabel = latestUsedLabel
    ? labels.find((label) => label.id === latestUsedLabel.id) ?? latestUsedLabel
    : null;
  const budgetHistoryEntries = expenses.filter((entry) => entry.currency === "EUR");
  const budgetMonthEntries = monthEntries.filter((entry) => entry.currency === "EUR");
  const dashboardBudgetRange = {
    mode: "month" as const,
    from: new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1)),
    to: new Date(Date.UTC(today.getFullYear(), today.getMonth() + 1, 0))
  };
  const latestLabelMonthEntries = latestLabel
    ? budgetMonthEntries.filter((entry) => entry.label?.id === latestLabel.id)
    : [];
  const latestLabelMonthSpend = sumByKind(latestLabelMonthEntries, "EXPENSE");
  const latestLabelAllEntries = latestLabel
    ? budgetHistoryEntries.filter((entry) => entry.label?.id === latestLabel.id)
    : [];
  const latestLabelAllSpend = sumByKind(latestLabelAllEntries, "EXPENSE");
  const latestLabelBudgetRow = latestLabel
    ? buildLabelRows(latestLabelMonthEntries, labels, dashboardBudgetRange, budgetHistoryEntries).find((row) => row.id === latestLabel.id)
    : null;
  const latestLabelMonthNet = latestLabelBudgetRow?.budgetPeriod === "ALL_TIME"
    ? Math.max(0, sumByKind(latestLabelMonthEntries, "EXPENSE") - sumByKind(latestLabelMonthEntries, "INCOME"))
    : latestLabelBudgetRow?.budgetConsumption ?? 0;
  const latestLabelBudget = latestLabelBudgetRow?.budget ?? 0;
  const latestLabelBudgetRemaining = latestLabelBudgetRow?.remaining ?? 0;
  const income = sumByKind(monthEntries, "INCOME");
  const spending = sumByKind(monthEntries, "EXPENSE");
  const saldo = income - spending;
  const monthHref = `/ausgaben?month=${getMonthKey(today)}`;
  const budgetCategoryRows = buildCategoryRows(budgetMonthEntries, categories, 0, dashboardBudgetRange);
  const { budget: monthBudget, consumption: netConsumption, remaining: budgetRemaining } = summarizeCategoryBudgets(budgetCategoryRows);
  const monthEndForecast = forecastCurrentMonthEnd(expenses, categories, today);
  const projectedBudgetRemaining = monthBudget - monthEndForecast.projectedMonth;
  const recentlyUsedLabels = recentlyUsedLabelKeys(budgetHistoryEntries, today);
  const budgetAlerts = [
    ...buildBudgetAlerts(budgetCategoryRows, "category"),
    ...buildBudgetAlerts(buildLabelRows(budgetMonthEntries, labels, dashboardBudgetRange, budgetHistoryEntries)
      .filter((row) => recentlyUsedLabels.has(row.id ?? row.name)), "label")
  ].sort((a, b) => {
    if (a.status !== b.status) return a.status === "over" ? -1 : 1;
    return b.budgetUsage - a.budgetUsage || b.netConsumption - a.netConsumption || a.name.localeCompare(b.name, "de");
  });
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
    .slice(0, 4);
  const vehicleSummaries = await buildVehicleSummaries(session.family.id, cars.slice(0, 3));

  return (
    <div className="cockpit-page">
      <div className="task-page-head cockpit-page-head">
        <PageHeader
          title="Cockpit"
          description={`${greeting}, ${session.user.name}. ${longDateFormatter.format(today)} · ${session.family.name}`}
        />
      </div>

      <section className="finance-summary-panel cockpit-metrics" aria-label="Statusübersicht">
        <CockpitMetric
          icon={<Scale size={17} />}
          label="Saldo"
          value={formatSignedMoney(saldo)}
          detail={saldo < 0 ? "Mehr ausgegeben als eingenommen" : "Einnahmen decken den Monat"}
          tone={saldo < 0 ? "negative" : "positive"}
        />
        <CockpitMetric
          icon={<ReceiptText size={17} />}
          label="Ausgaben"
          value={formatMoney(spending)}
          detail={monthBudget > 0 ? formatBudgetDetail(budgetRemaining) : `${monthEntries.length} Einträge`}
          tone={monthBudget > 0 && budgetRemaining < 0 ? "negative" : "spending"}
        />
        <CockpitMetric
          icon={<CalendarCheck size={17} />}
          label="Aufgaben"
          value={String(openTasks.length)}
          detail={`${dueTasks.length} fällig · ${importantTasks.length} wichtig`}
          tone={dueTasks.length > 0 ? "negative" : importantTasks.length > 0 ? "spending" : "positive"}
        />
        <CockpitMetric
          icon={<WalletCards size={17} />}
          label="Fristen"
          value={nextContracts[0]?.nextCancellationDate ? formatDate(nextContracts[0].nextCancellationDate) : "-"}
          detail={nextContracts.length > 0 ? `${nextContracts.length} Kündigungen im Blick` : "Keine Frist hinterlegt"}
          tone={nextContracts.length > 0 ? "neutral" : "positive"}
        />
      </section>

      <section className="cockpit-grid">
        <SectionCard className="cockpit-section cockpit-next-tasks">
          <SectionHead eyebrow="Aufgaben" title="Als Nächstes" href="/aufgaben" />
          <div className="cockpit-task-list">
            {openTasks.length === 0 ? <EmptyState>Alles erledigt.</EmptyState> : null}
            {openTasks.slice(0, 5).map((task, index) => {
              const urgency = taskUrgency(task);
              const assignee = task.assignee?.name ?? "Nicht zugewiesen";
              return (
                <article className={`cockpit-task-row task-row-trigger ${urgency.className} ${index >= 4 ? "cockpit-desktop-extra" : ""}`} key={task.id}>
                  <div className="cockpit-task-check">
                    <TaskInlineCheck taskId={task.id} done={false} />
                  </div>
                  <span className="cockpit-task-copy">
                    <strong>{task.title}</strong>
                    <span className="cockpit-task-meta">
                      <span className="cockpit-task-owner">
                        <span className="task-avatar" aria-hidden="true">{initialFor(assignee)}</span>
                        <small>{assignee}</small>
                      </span>
                      <time dateTime={task.dueDate?.toISOString()}>{formatDate(task.dueDate)}</time>
                      <span className="cockpit-task-status">{urgency.className !== "task-calm" ? urgency.label : priorityLabels[task.priority]}</span>
                    </span>
                  </span>
                </article>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard className="cockpit-section cockpit-finance">
          <SectionHead eyebrow="Finanzen" title="Dein Monat" href={monthHref} />
          <div className="cockpit-finance-content">
          <div className="finance-summary-panel cockpit-finance-summary" aria-label="Monatswerte">
            <FinanceSummaryMetric icon={<BanknoteArrowUp size={17} />} label="Einnahmen" value={formatMoney(income)} detail="Geldzufluss im Monat" tone="income" />
            <FinanceSummaryMetric icon={<ReceiptText size={17} />} label="Ausgaben" value={formatMoney(spending)} detail={`${monthEntries.length} Einträge im Monat`} tone="spending" />
            <FinanceSummaryMetric icon={<Scale size={17} />} label="Saldo" value={formatSignedMoney(saldo)} detail={saldo < 0 ? "Mehr ausgegeben" : "Monat im Plus"} tone={saldo < 0 ? "negative" : "positive"} />
            <FinanceSummaryMetric icon={<WalletCards size={17} />} label={monthBudget > 0 ? budgetRemaining < 0 ? "Über Budget" : "Budget übrig" : "Budget"} value={monthBudget > 0 ? formatMoney(Math.abs(budgetRemaining)) : "-"} detail={monthBudget > 0 ? `${formatMoney(netConsumption)} von ${formatMoney(monthBudget)} genutzt` : "Monatsbudget in Finanzen"} tone={budgetRemaining < 0 && monthBudget > 0 ? "negative" : "neutral"} />
          </div>
          {latestLabel ? (
            <Link className={`cockpit-label-budget finance-summary-metric ${latestLabelBudget > 0 && latestLabelBudgetRemaining < 0 ? "tone-negative" : latestLabelBudget > 0 ? "tone-positive" : "tone-neutral"}`} href={`/ausgaben?month=${getMonthKey(today)}&view=labels`}>
              <div className="finance-summary-card-head">
                <span className="cockpit-label-budget-heading"><small>Zuletzt genutzt · {budgetCadenceLabel(latestLabelBudgetRow?.budgetPeriod ?? "ALL_TIME")}</small><strong>{latestLabel.name}</strong></span>
                <i aria-hidden="true"><Tag size={17} /></i>
              </div>
              <strong className="cockpit-label-budget-value">{latestLabelBudget > 0 ? formatBudgetDetail(latestLabelBudgetRemaining) : formatMoney(latestLabelMonthSpend)}</strong>
              <small>{latestLabelBudget > 0
                ? `${formatMoney(latestLabelMonthSpend)} diesen Monat · ${formatMoney(latestLabelAllSpend)} gesamt · Budget ${formatMoney(latestLabelBudget)}`
                : `${formatMoney(latestLabelMonthSpend)} diesen Monat · kein Budget festgelegt`}</small>
              {latestLabelBudget > 0 ? (
                <span className="cockpit-label-budget-track" aria-label={`${Math.min(100, Math.round((latestLabelBudgetRow?.budgetConsumption ?? latestLabelMonthNet) / latestLabelBudget * 100))} Prozent des Labelbudgets genutzt`}>
                  <span style={{ width: `${Math.min(100, Math.max(0, (latestLabelBudgetRow?.budgetConsumption ?? latestLabelMonthNet) / latestLabelBudget * 100))}%` }} />
                </span>
              ) : null}
            </Link>
          ) : null}
          <Link className={`cockpit-month-forecast ${monthBudget > 0 && projectedBudgetRemaining < 0 ? "forecast-over" : monthBudget > 0 && monthEndForecast.projectedMonth >= monthBudget * .8 ? "forecast-near" : ""}`} href="/ausgaben/planung">
            <span className="cockpit-month-forecast-icon" aria-hidden="true"><TrendingUp size={18} /></span>
            <span className="cockpit-month-forecast-copy">
              <strong>Monatsende prognostiziert</strong>
              <small>{monthEndForecast.hasEstimate
                ? monthEndForecast.method === "historical-remainder"
                  ? `${formatMoney(monthEndForecast.spentToDate)} bisher · typischer Rest aus ${monthEndForecast.historyMonths} ${monthEndForecast.historyMonths === 1 ? "Monat" : "Monaten"}`
                  : "Hochrechnung aus den bisherigen Tagen"
                : "Noch nicht genug Daten für eine Prognose"}</small>
            </span>
            <span className="cockpit-month-forecast-value">
              <strong>{monthEndForecast.hasEstimate ? formatMoney(monthEndForecast.projectedMonth) : "–"}</strong>
              <small>{monthEndForecast.hasEstimate && monthBudget > 0 ? projectedBudgetRemaining < 0 ? `${formatMoney(Math.abs(projectedBudgetRemaining))} über Budget` : `${formatMoney(projectedBudgetRemaining)} Budget frei` : "Prognose öffnen"}</small>
            </span>
          </Link>
          {budgetAlerts.length > 0 ? (
            <section className="cockpit-budget-alerts" aria-label="Budgetwarnungen">
              <div className="cockpit-budget-alerts-head">
                <strong>Budgets im Blick</strong>
                <span>{budgetAlerts.length} {budgetAlerts.length === 1 ? "Hinweis" : "Hinweise"}</span>
              </div>
              {budgetAlerts.slice(0, 4).map((alert) => {
                const overBudget = alert.status === "over";
                const destination = `/ausgaben?month=${getMonthKey(today)}&view=${alert.dimension === "category" ? "budgets" : "labels"}`;
                return (
                  <Link className={`cockpit-budget-alert ${overBudget ? "budget-over" : "budget-near"}`} href={destination} key={`${alert.dimension}-${alert.id ?? alert.name}`}>
                    <span className="cockpit-budget-alert-dot" style={{ background: alert.color }} aria-hidden="true" />
                    <span className="cockpit-budget-alert-copy">
                      <strong>{alert.name}</strong>
                      <small>{alert.dimension === "category" ? "Kategorie" : "Label"} · {budgetCadenceLabel(alert.budgetPeriod ?? "MONTHLY")} · {alert.budgetUsage.toFixed(0)} % genutzt</small>
                      <span className="cockpit-bar" aria-hidden="true"><span style={{ width: `${Math.max(4, alert.budgetUsage)}%`, background: overBudget ? "var(--red)" : "#c9821c" }} /></span>
                    </span>
                    <strong>{overBudget ? `${formatMoney(Math.abs(alert.remaining))} über` : alert.remaining === 0 ? "ausgeschöpft" : `${formatMoney(alert.remaining)} frei`}</strong>
                  </Link>
                );
              })}
            </section>
          ) : null}
          <section className="cockpit-recent-bookings desktop-only" aria-label="Letzte Buchungen">
            <div className="cockpit-recent-bookings-head">
              <strong>Letzte Buchungen</strong>
              <span>{recentMonthEntries.length} im Monat</span>
            </div>
            {recentMonthEntries.length === 0 ? <p className="cockpit-recent-empty">Noch keine Buchungen in diesem Monat.</p> : (
              <div className="cockpit-recent-booking-list">
                {recentMonthEntries.map((entry) => (
                  <Link className="cockpit-recent-booking" href={monthHref} key={entry.id}>
                    <span className="cockpit-recent-booking-copy">
                      <strong>{entry.description}</strong>
                      <small>{formatDate(entry.date)}{entry.store ? ` · ${entry.store}` : ""}</small>
                    </span>
                    <strong className={entry.kind === "INCOME" ? "booking-income" : "booking-expense"}>
                      {formatSignedMoney(entry.kind === "INCOME" ? entry.amountCents : -entry.amountCents)}
                    </strong>
                  </Link>
                ))}
              </div>
            )}
          </section>
          </div>
        </SectionCard>

        <SectionCard className="cockpit-section">
          <SectionHead eyebrow="Verträge" title="Kündigungsfristen" href="/vertraege" />
          <div className="cockpit-list">
            {nextContracts.length === 0 ? <EmptyState>Keine Fristen hinterlegt.</EmptyState> : null}
            {nextContracts.map((contract, index) => (
              <Link className={`cockpit-contract ${contractUrgencyClass(contract.nextCancellationDate)} ${index >= 3 ? "cockpit-desktop-extra" : ""}`} href="/vertraege" key={contract.id}>
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
            {vehicleSummaries.length === 0 ? <EmptyState>Noch kein aktives Auto mit Tankdaten.</EmptyState> : null}
            {vehicleSummaries.map((vehicle, index) => (
              <Link className={`cockpit-vehicle ${index >= 2 ? "cockpit-desktop-extra" : ""}`} href={`/kilometer?car=${vehicle.id}`} key={vehicle.id}>
                <span className="cockpit-row-icon" aria-hidden="true"><CarFront size={17} /></span>
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

      <section className="cockpit-documents">
        <SectionHead eyebrow="Dokumente" title="Zuletzt" href="/dokumente" />
        <div className="cockpit-document-row">
          {documents.length === 0 ? <EmptyState>Noch keine Dokumente.</EmptyState> : null}
          {documents.slice(0, 4).map((document, index) => (
            <a className={`document-item ${index >= 3 ? "cockpit-desktop-extra" : ""}`} href={dashboardDocumentHref(document)} key={document.id} target={document.referenceType === "LOCAL_FILE" ? undefined : "_blank"} rel={document.referenceType === "LOCAL_FILE" ? undefined : "noreferrer"}>
              <span className="doc-icon" aria-hidden="true"><FileText size={17} /></span>
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
      <h2><span>{eyebrow}</span>{title}</h2>
      <Link className="text-link" href={href}>Alle</Link>
    </div>
  );
}

function CockpitMetric({
  icon,
  label,
  value,
  detail,
  tone
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: "positive" | "negative" | "neutral" | "spending";
}) {
  return (
    <div className={`finance-summary-metric cockpit-metric tone-${tone}`}>
      <div className="finance-summary-card-head">
        <span>{label}</span>
        <i aria-hidden="true">{icon}</i>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function FinanceSummaryMetric({
  icon,
  label,
  value,
  detail,
  tone
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: "income" | "spending" | "positive" | "negative" | "neutral";
}) {
  return (
    <div className={`finance-summary-metric tone-${tone}`}>
      <div className="finance-summary-card-head">
        <span>{label}</span>
        <i aria-hidden="true">{icon}</i>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function initialFor(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

async function buildVehicleSummaries(familyId: string, cars: CarEntry[]) {
  const rows = await Promise.all(cars.map(async (car) => {
    const entries = await db.fuelEntry.findMany({
      where: { familyId, carId: car.id },
      select: { id: true, date: true, odometerKm: true, litersMilli: true, costCents: true, note: true }
    });
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

const priorityLabels = {
  LOW: "Niedrig",
  MEDIUM: "Mittel",
  HIGH: "Hoch",
  URGENT: "Dringend"
};

const berlinTimeZone = "Europe/Berlin";
const longDateFormatter = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "long", timeZone: berlinTimeZone });

type DocumentEntry = Awaited<ReturnType<typeof getVisibleDocuments>>[number];
type CarEntry = Awaited<ReturnType<typeof getVisibleCars>>[number];

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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

function formatSignedMoney(amountCents: number) {
  if (amountCents === 0) return formatMoney(0);
  return `${amountCents > 0 ? "+" : "-"}${formatMoney(Math.abs(amountCents))}`;
}

function formatBudgetDetail(remainingCents: number) {
  if (remainingCents < 0) return `${formatMoney(Math.abs(remainingCents))} über Budget`;
  return `${formatMoney(remainingCents)} Budget frei`;
}
