import { archiveRecurringTask, pauseRecurringTask, resumeRecurringTask, updateRecurringTask, updateTask } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { formatDate, toDateInputValue } from "@/lib/format";
import { getFamilyMembers, getVisibleRecurringTasks, getVisibleTasks } from "@/lib/queries";
import { ensureDueRecurringTasks } from "@/lib/recurring-tasks";
import { daysUntil, getRecurringTaskIntervalLabel, taskRank, taskUrgency } from "@/lib/tasks";
import { ActionModal } from "@/components/action-modal";
import { AutosaveForm } from "@/components/autosave-form";
import { TaskStatusControl } from "@/components/task-status-control";
import { EmptyState, PageHeader, ScopeSelect } from "@/components/ui";

type TasksPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const session = await requireSession();
  await ensureDueRecurringTasks(session.family.id, session.user.id);
  const params = await searchParams;
  const query = normalizeSearch(params.q);
  const [tasks, recurringTasks, members] = await Promise.all([
    getVisibleTasks(session.family.id, session.user.id),
    getVisibleRecurringTasks(session.family.id, session.user.id),
    getFamilyMembers(session.family.id)
  ]);
  const searchedTasks = query ? tasks.filter((task) => matchesTask(task, query)) : tasks;
  const sortedTasks = [...searchedTasks].sort((a, b) => taskRank(b) - taskRank(a));
  const activeTasks = sortedTasks.filter((task) => task.status === "IN_PROGRESS" || task.status === "OPEN");
  const completedTasks = sortedTasks.filter((task) => task.status === "DONE" || task.status === "ARCHIVED");
  const plannedTasks = recurringTasks.filter((task) => task.nextDueDate && matchesRecurringTask(task, query));

  return (
    <>
      <PageHeader title="Aufgaben" />

      <form className="search-bar">
        <label>
          <span>Aufgaben durchsuchen</span>
          <input name="q" type="search" defaultValue={params.q ?? ""} placeholder="Titel, Beschreibung, Person ..." />
        </label>
        <button className="button secondary" type="submit">Suchen</button>
        {query ? <a className="button secondary" href="/aufgaben">Zurücksetzen</a> : null}
      </form>

      <section className="stats">
        <div className="stat"><span>In Arbeit</span><strong>{activeTasks.filter((task) => task.status === "IN_PROGRESS").length}</strong></div>
        <div className="stat"><span>Offen</span><strong>{activeTasks.filter((task) => task.status === "OPEN").length}</strong></div>
        <div className="stat"><span>Heute / überfällig</span><strong>{activeTasks.filter((task) => daysUntil(task.dueDate) <= 0).length}</strong></div>
        <div className="stat"><span>Geplant</span><strong>{plannedTasks.length}</strong></div>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <h2 className="section-title">Priorisierte Aufgaben</h2>
          </div>
        </div>
        <div className="task-priority-list">
          {activeTasks.length === 0 ? <EmptyState>{query ? "Keine passenden offenen Aufgaben." : "Keine offenen Aufgaben."}</EmptyState> : null}
          {activeTasks.map((task) => <TaskCard task={task} members={members} key={task.id} />)}
        </div>
      </section>

      <section className="panel spacing-top">
        <div className="section-head">
          <div>
            <h2 className="section-title">Geplante Aufgaben</h2>
          </div>
        </div>
        <div className="task-priority-list">
          {plannedTasks.length === 0 ? <EmptyState>{query ? "Keine passenden geplanten Aufgaben." : "Keine geplanten Aufgaben."}</EmptyState> : null}
          {plannedTasks.map((task) => <PlannedTaskCard task={task} members={members} key={task.id} />)}
        </div>
      </section>

      <details className="panel spacing-top">
        <summary className="section-title">Erledigte Aufgaben</summary>
        <div className="task-priority-list">
          {completedTasks.length === 0 ? <EmptyState>{query ? "Keine passenden erledigten Aufgaben." : "Noch keine erledigten Aufgaben."}</EmptyState> : null}
          {completedTasks.map((task) => <TaskCard task={task} members={members} completed key={task.id} />)}
        </div>
      </details>
    </>
  );
}

function TaskCard({ task, members, completed = false }: { task: TaskLike; members: MemberLike[]; completed?: boolean }) {
  const urgency = taskUrgency(task);
  return (
    <article className={`priority-task ${completed ? "task-completed" : urgency.className}`}>
      <span className="priority-task-accent" />
      <div className="priority-task-body">
        <div>
          <div className="task-title-row">
            <strong>{task.title}</strong>
          </div>
          <span className="muted">
            {task.assignee?.name ?? "Nicht zugewiesen"} · Fällig: {formatDate(task.dueDate)} · {priorityLabels[task.priority]}
          </span>
          {task.description ? <p>{task.description}</p> : null}
          <div className="badge-row">
            <span className="badge">{task.scope === "FAMILY" ? "Familie" : "Privat"}</span>
            {task.recurringTask ? <span className="badge">Wiederholt</span> : null}
            {!completed ? <span className={`status-chip ${urgency.chipClass}`}>{urgency.label}</span> : null}
          </div>
        </div>
        <div className="task-actions">
          <TaskStatusControl taskId={task.id} initialStatus={task.status} />
          <ActionModal title="Aufgabe bearbeiten" trigger="Bearbeiten" modalId={`task-${task.id}`}>
            <AutosaveForm action={updateTask} className="form form-grid modal-form">
              <input type="hidden" name="id" value={task.id} />
              <label>Titel<input name="title" defaultValue={task.title} required /></label>
              <label>
                Zuweisen an
                <select name="assignedToUserId" defaultValue={task.assignedToUserId ?? ""}>
                  <option value="">Nicht zugewiesen</option>
                  {members.map((member) => <option value={member.userId} key={member.id}>{member.user.name}</option>)}
                </select>
              </label>
              <label>Deadline<input name="dueDate" type="date" defaultValue={toDateInputValue(task.dueDate)} /></label>
              <label>
                Priorität
                <select name="priority" defaultValue={task.priority}>
                  <option value="LOW">Niedrig</option>
                  <option value="MEDIUM">Mittel</option>
                  <option value="HIGH">Hoch</option>
                  <option value="URGENT">Dringend</option>
                </select>
              </label>
              <label>Beschreibung<textarea name="description" defaultValue={task.description ?? ""} /></label>
              <ScopeSelect defaultValue={task.scope} />
              <button className="button full-span autosave-submit" type="submit">Speichern</button>
            </AutosaveForm>
          </ActionModal>
        </div>
      </div>
    </article>
  );
}

function PlannedTaskCard({ task, members }: { task: RecurringTaskLike; members: MemberLike[] }) {
  const editInterval = recurringTaskEditInterval(task);

  return (
    <article className={`priority-task ${task.status === "PAUSED" ? "task-completed" : "task-calm"}`}>
      <span className="priority-task-accent" />
      <div className="priority-task-body">
        <div>
          <div className="task-title-row">
            <strong>{task.title}</strong>
          </div>
          <span className="muted">
            {task.assignee?.name ?? "Nicht zugewiesen"} · Nächste Aufgabe: {formatDate(task.nextDueDate)} · {getRecurringTaskIntervalLabel(task)}
          </span>
          {task.description ? <p>{task.description}</p> : null}
          <div className="badge-row">
            <span className="badge">{task.scope === "FAMILY" ? "Familie" : "Privat"}</span>
            <span className={`status-chip ${task.status === "PAUSED" ? "status-done" : "calm-chip"}`}>
              {task.status === "PAUSED" ? "Pausiert" : "Geplant"}
            </span>
          </div>
        </div>
        <div className="task-actions">
          {task.status === "PAUSED" ? (
            <form action={resumeRecurringTask}>
              <input type="hidden" name="id" value={task.id} />
              <button className="button secondary" type="submit">Fortsetzen</button>
            </form>
          ) : (
            <form action={pauseRecurringTask}>
              <input type="hidden" name="id" value={task.id} />
              <button className="button secondary" type="submit">Pausieren</button>
            </form>
          )}
          <ActionModal title="Geplante Aufgabe bearbeiten" trigger="Bearbeiten" modalId={`recurring-task-${task.id}`}>
            <AutosaveForm action={updateRecurringTask} className="form form-grid modal-form">
              <input type="hidden" name="id" value={task.id} />
              <label>Titel<input name="title" defaultValue={task.title} required /></label>
              <label>
                Zuweisen an
                <select name="assignedToUserId" defaultValue={task.assignedToUserId ?? ""}>
                  <option value="">Nicht zugewiesen</option>
                  {members.map((member) => <option value={member.userId} key={member.id}>{member.user.name}</option>)}
                </select>
              </label>
              <label>Startdatum<input name="startDate" type="date" defaultValue={toDateInputValue(task.startDate)} required /></label>
              <label>Enddatum optional<input name="endDate" type="date" defaultValue={toDateInputValue(task.endDate)} /></label>
              <label>Alle<input name="intervalCount" type="number" min="1" max={editInterval.unit === "WEEK" ? 52 : 365} defaultValue={editInterval.count} required /></label>
              <label>
                Einheit
                <select name="intervalUnit" defaultValue={editInterval.unit}>
                  <option value="DAY">Tage</option>
                  <option value="WEEK">Wochen</option>
                  <option value="MONTH">Monate</option>
                  <option value="YEAR">Jahre</option>
                </select>
              </label>
              <label>
                Priorität
                <select name="priority" defaultValue={task.priority}>
                  <option value="LOW">Niedrig</option>
                  <option value="MEDIUM">Mittel</option>
                  <option value="HIGH">Hoch</option>
                  <option value="URGENT">Dringend</option>
                </select>
              </label>
              <label>
                Status
                <select name="status" defaultValue={task.status}>
                  <option value="ACTIVE">Aktiv</option>
                  <option value="PAUSED">Pausiert</option>
                  <option value="ARCHIVED">Archiviert</option>
                </select>
              </label>
              <label>Beschreibung<textarea name="description" defaultValue={task.description ?? ""} /></label>
              <ScopeSelect defaultValue={task.scope} />
              <button className="button full-span autosave-submit" type="submit">Speichern</button>
            </AutosaveForm>
            <form action={archiveRecurringTask} className="form compact spacing-top">
              <input type="hidden" name="id" value={task.id} />
              <button className="button secondary" type="submit">Archivieren</button>
            </form>
          </ActionModal>
        </div>
      </div>
    </article>
  );
}

function recurringTaskEditInterval(task: Pick<RecurringTaskLike, "intervalCount" | "intervalUnit">) {
  if (task.intervalUnit === "DAY" && task.intervalCount >= 7 && task.intervalCount % 7 === 0) {
    return { count: task.intervalCount / 7, unit: "WEEK" };
  }
  return { count: task.intervalCount, unit: task.intervalUnit };
}

function taskStatusTone(status: TaskLike["status"]) {
  if (status === "IN_PROGRESS") return { label: "In Arbeit", className: "status-progress" };
  if (status === "DONE" || status === "ARCHIVED") return { label: "Erledigt", className: "status-done" };
  return { label: "Offen", className: "status-open" };
}

function matchesTask(task: TaskLike, query: string) {
  return [
    task.title,
    task.description,
    task.assignee?.name,
    task.owner.name,
    task.recurringTask?.title,
    priorityLabels[task.priority],
    taskStatusTone(task.status).label
  ].some((value) => normalizeSearch(value).includes(query));
}

function matchesRecurringTask(task: RecurringTaskLike, query: string) {
  if (!query) return true;
  return [
    task.title,
    task.description,
    task.assignee?.name,
    task.owner.name,
    getRecurringTaskIntervalLabel(task),
    task.status === "PAUSED" ? "Pausiert" : "Geplant"
  ].some((value) => normalizeSearch(value).includes(query));
}

function normalizeSearch(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

const priorityLabels = {
  LOW: "Niedrig",
  MEDIUM: "Mittel",
  HIGH: "Hoch",
  URGENT: "Dringend"
};

type TaskLike = Awaited<ReturnType<typeof getVisibleTasks>>[number];
type RecurringTaskLike = Awaited<ReturnType<typeof getVisibleRecurringTasks>>[number];
type MemberLike = Awaited<ReturnType<typeof getFamilyMembers>>[number];
