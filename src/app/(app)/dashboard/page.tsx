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
  const budget = categories.reduce((sum, category) => sum + category.monthlyBudgetCents, 0);
  const budgetLeft = budget - spending;
  const saldo = income - spending;
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
        <DashboardStat label="Saldo" value={formatMoney(saldo)} detail={saldo < 0 ? "Unter Plan prüfen" : "Aktueller Stand"} tone={saldo < 0 ? "red" : "green"} />
        <DashboardStat label="Budget" value={formatMoney(budgetLeft)} detail={`${formatMoney(budget)} geplant`} tone={budgetLeft < 0 ? "red" : "blue"} />
        <DashboardStat label="Aufgaben" value={`${openTasks.length} offen`} detail={`${importantTasks.length} wichtig`} tone={importantTasks.length > 0 ? "amber" : "blue"} />
      </section>

      <div className="dashboard-grid">
        <section className="dashboard-card dashboard-card-large">
          <div className="card-head">
            <div>
              <span className="eyebrow">Finanzen</span>
              <h2>Monatsüberblick</h2>
            </div>
            <Link className="text-link" href="/ausgaben">Details</Link>
          </div>
          <div className="finance-bars" aria-hidden="true">
            {buildFinanceBars(monthEntries).map((bar) => (
              <span className={`finance-bar ${bar.kind === "INCOME" ? "income-bar" : "expense-bar"}`} style={{ height: `${bar.height}%` }} key={bar.key} />
            ))}
          </div>
          <div className="dashboard-mini-grid">
            <MiniMetric label="Einnahmen" value={formatMoney(income)} tone="green" />
            <MiniMetric label="Ausgaben" value={formatMoney(spending)} tone="red" />
            <MiniMetric label="Saldo" value={formatMoney(saldo)} tone={saldo < 0 ? "red" : "green"} />
            <MiniMetric label="Budget frei" value={formatMoney(budgetLeft)} tone={budgetLeft < 0 ? "red" : "green"} />
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

function buildFinanceBars(entries: Awaited<ReturnType<typeof getVisibleExpenses>>) {
  const recent = entries.slice(0, 12);
  if (recent.length === 0) {
    return Array.from({ length: 12 }, (_, index) => ({ key: `empty-${index}`, height: 18 + (index % 4) * 10, kind: "EXPENSE" as const }));
  }
  const max = Math.max(...recent.map((entry) => entry.amountCents), 1);
  return recent.reverse().map((entry) => ({
    key: entry.id,
    kind: entry.kind,
    height: Math.max(18, Math.round((entry.amountCents / max) * 100))
  }));
}

const priorityLabels = {
  LOW: "Niedrig",
  MEDIUM: "Mittel",
  HIGH: "Hoch",
  URGENT: "Dringend"
};

const longDateFormatter = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "long" });
