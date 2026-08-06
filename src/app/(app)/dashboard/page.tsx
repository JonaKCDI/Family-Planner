import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, BanknoteArrowUp, CalendarCheck, CarFront, FileText, ReceiptText, Scale, WalletCards } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { ensureDueContractExpenses } from "@/lib/contract-auto-expenses";
import { getContractNextCancellationDate } from "@/lib/contracts";
import { sumByKind } from "@/lib/expense-analytics";
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
  getVisibleTasks
} from "@/lib/queries";
import { TaskInlineCheck } from "@/components/task-inline-check";
import { Chip, EmptyState, PageHeader, SectionCard, StatusBadge } from "@/components/ui";

export default async function DashboardPage() {
  const session = await requireSession();
  await Promise.all([
    ensureDueContractExpenses(session.family.id, session.user.id),
    ensureDueRecurringTasks(session.family.id, session.user.id)
  ]);
  const [expenses, tasks, contracts, documents, categories, cars] = await Promise.all([
    getVisibleExpenses(session.family.id, session.user.id),
    getVisibleTasks(session.family.id, session.user.id),
    getVisibleContracts(session.family.id, session.user.id),
    getVisibleDocuments(session.family.id, session.user.id),
    getVisibleCategories(session.family.id, session.user.id, "EXPENSE"),
    getVisibleCars(session.family.id)
  ]);

  const today = new Date();
  const greeting = getGreeting(today);
  const monthEntries = expenses.filter((entry) => isSameMonth(entry.date, today));
  const income = sumByKind(monthEntries, "INCOME");
  const spending = sumByKind(monthEntries, "EXPENSE");
  const saldo = income - spending;
  const monthHref = `/ausgaben?month=${getMonthKey(today)}`;
  const monthBudget = categories.reduce((sum, category) => sum + category.monthlyBudgetCents, 0);
  const netConsumption = Math.max(0, spending - income);
  const budgetRemaining = monthBudget - netConsumption;
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
            {openTasks.slice(0, 4).map((task) => {
              const urgency = taskUrgency(task);
              const assignee = task.assignee?.name ?? "Nicht zugewiesen";
              return (
                <article className={`cockpit-task-row task-row-trigger ${urgency.className}`} key={task.id}>
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
          <div className="finance-summary-panel cockpit-finance-summary" aria-label="Monatswerte">
            <FinanceSummaryMetric icon={<BanknoteArrowUp size={17} />} label="Einnahmen" value={formatMoney(income)} detail="Geldzufluss im Monat" tone="income" />
            <FinanceSummaryMetric icon={<ReceiptText size={17} />} label="Ausgaben" value={formatMoney(spending)} detail={`${monthEntries.length} Einträge im Monat`} tone="spending" />
            <FinanceSummaryMetric icon={<Scale size={17} />} label="Saldo" value={formatSignedMoney(saldo)} detail={saldo < 0 ? "Mehr ausgegeben" : "Monat im Plus"} tone={saldo < 0 ? "negative" : "positive"} />
            <FinanceSummaryMetric icon={<WalletCards size={17} />} label={monthBudget > 0 ? "Budget übrig" : "Budget"} value={monthBudget > 0 ? formatMoney(budgetRemaining) : "-"} detail={monthBudget > 0 ? `${formatMoney(netConsumption)} netto verbraucht` : "Monatsbudget in Finanzen"} tone={budgetRemaining < 0 && monthBudget > 0 ? "negative" : "neutral"} />
          </div>
          <div className="cockpit-finance-actions" aria-label="Finanzsprungziele">
            <Link href="/ausgaben">Übersicht <ArrowRight size={15} aria-hidden="true" /></Link>
            <Link href="/ausgaben?view=categories">Analyse <ArrowRight size={15} aria-hidden="true" /></Link>
            <Link href="/ausgaben/planung">Planung <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
        </SectionCard>

        <SectionCard className="cockpit-section">
          <SectionHead eyebrow="Verträge" title="Kündigungsfristen" href="/vertraege" />
          <div className="cockpit-list">
            {nextContracts.length === 0 ? <EmptyState>Keine Fristen hinterlegt.</EmptyState> : null}
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
            {vehicleSummaries.length === 0 ? <EmptyState>Noch kein aktives Auto mit Tankdaten.</EmptyState> : null}
            {vehicleSummaries.map((vehicle) => (
              <Link className="cockpit-vehicle" href={`/kilometer?car=${vehicle.id}`} key={vehicle.id}>
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

      {importantTasks.length > 0 ? (
        <section className="cockpit-priority-strip">
          <strong>Kurzer Fokus</strong>
          <span>{importantTasks.length} wichtige Aufgaben</span>
          <div className="badge-row">
            {importantTasks.slice(0, 2).map((task) => (
              <Chip tone={daysUntil(task.dueDate) <= 0 ? "negative" : "warning"} key={task.id}>{task.title}</Chip>
            ))}
          </div>
        </section>
      ) : null}

      <section className="cockpit-documents">
        <SectionHead eyebrow="Dokumente" title="Zuletzt" href="/dokumente" />
        <div className="cockpit-document-row">
          {documents.length === 0 ? <EmptyState>Noch keine Dokumente.</EmptyState> : null}
          {documents.slice(0, 3).map((document) => (
            <a className="document-item" href={dashboardDocumentHref(document)} key={document.id} target={document.referenceType === "LOCAL_FILE" ? undefined : "_blank"} rel={document.referenceType === "LOCAL_FILE" ? undefined : "noreferrer"}>
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
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
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
