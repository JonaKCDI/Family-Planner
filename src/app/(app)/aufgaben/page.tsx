import { pauseRecurringTask, resumeRecurringTask } from "@/lib/actions";
import { CalendarDays, Flag, Lock, Pencil, RotateCcw, UserRound } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { formatDate, toDateInputValue } from "@/lib/format";
import { getFamilyMembers, getVisibleDocumentRoots, getVisibleRecurringTasks, getVisibleTasks } from "@/lib/queries";
import { ensureDueRecurringTasks } from "@/lib/recurring-tasks";
import { daysUntil, getRecurringTaskIntervalLabel, taskRank, taskUrgency } from "@/lib/tasks";
import { ActionModal } from "@/components/action-modal";
import { RecurringTaskEditForm, TaskEditForm } from "@/components/task-edit-form";
import { TaskInlineCheck } from "@/components/task-inline-check";
import { TaskSummaryStrip } from "@/components/task-summary-strip";
import { TaskSortControl, TaskToolbar } from "@/components/task-toolbar";
import { Chip, EmptyState, PageHeader } from "@/components/ui";

type TasksPageProps = {
  searchParams: Promise<TaskPageParams>;
};

type TaskPageParams = {
  q?: string;
  view?: string;
  priority?: string;
  person?: string;
  recurring?: string;
  sort?: string;
};

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const session = await requireSession();
  await ensureDueRecurringTasks(session.family.id, session.user.id);
  const params = await searchParams;
  const query = normalizeSearch(params.q);
  const view = getTaskView(params.view);
  const filters = getTaskFilters(params);
  const sort = getTaskSort(params.sort);
  const [tasks, recurringTasks, members, documentRoots] = await Promise.all([
    getVisibleTasks(session.family.id, session.user.id),
    getVisibleRecurringTasks(session.family.id, session.user.id),
    getFamilyMembers(session.family.id),
    getVisibleDocumentRoots(session.family.id, session.user.id, session.role)
  ]);
  const searchedTasks = tasks
    .filter((task) => !query || matchesTask(task, query))
    .filter((task) => matchesTaskFilters(task, filters));
  const sortedTasks = sortTasks(searchedTasks, sort);
  const activeTasks = sortedTasks.filter((task) => task.status === "IN_PROGRESS" || task.status === "OPEN");
  const completedTasks = sortedTasks.filter((task) => task.status === "DONE" || task.status === "ARCHIVED");
  const plannedTasks = sortRecurringTasks(
    recurringTasks
      .filter((task) => task.nextDueDate && matchesRecurringTask(task, query))
      .filter((task) => matchesRecurringTaskFilters(task, filters)),
    sort
  );
  const activeFilterCount = countActiveTaskFilters(params);
  const overdueTasks = activeTasks.filter((task) => daysUntil(task.dueDate) < 0);
  const todayTasks = activeTasks.filter((task) => daysUntil(task.dueDate) === 0);
  const visibleActiveTasks = view === "today"
    ? todayTasks
    : view === "overdue"
      ? overdueTasks
      : activeTasks;

  return (
    <>
      <div className="task-page-head">
        <PageHeader title="Aufgaben" />
        <TaskToolbar params={normalizeTaskParams(params)} members={members} activeFilterCount={activeFilterCount} />
      </div>

      {activeFilterCount > 0 || query ? (
        <div className="active-filter-row task-active-filters" aria-label="Aktive Aufgabenfilter">
          {query ? <a className="filter-chip" href={buildTasksHref(params, { q: undefined })}><span>Suche: {params.q}</span><strong aria-hidden="true">×</strong></a> : null}
          {filters.priority ? <a className="filter-chip" href={buildTasksHref(params, { priority: undefined })}><span>{priorityLabels[filters.priority]}</span><strong aria-hidden="true">×</strong></a> : null}
          {filters.person ? <a className="filter-chip" href={buildTasksHref(params, { person: undefined })}><span>{filterPersonLabel(filters.person, members)}</span><strong aria-hidden="true">×</strong></a> : null}
          {filters.recurring ? <a className="filter-chip" href={buildTasksHref(params, { recurring: undefined })}><span>Wiederkehrend</span><strong aria-hidden="true">×</strong></a> : null}
          {sort !== "importance" ? <a className="filter-chip" href={buildTasksHref(params, { sort: undefined })}><span>{sortLabels[sort]}</span><strong aria-hidden="true">×</strong></a> : null}
          <a className="filter-chip clear-all" href="/aufgaben">Alle löschen</a>
        </div>
      ) : null}

      <TaskSummaryStrip
        key={view}
        view={view}
        items={[
          { count: activeTasks.length, href: buildTasksHref(params, { view: view === "active" ? "all" : "active" }), label: "offen", view: "active" },
          { count: overdueTasks.length, href: buildTasksHref(params, { view: view === "overdue" ? "all" : "overdue" }), label: "überfällig", view: "overdue" },
          { count: todayTasks.length, href: buildTasksHref(params, { view: view === "today" ? "all" : "today" }), label: "heute", view: "today" },
          { count: plannedTasks.length, href: buildTasksHref(params, { view: view === "planned" ? "all" : "planned" }), label: "geplant", view: "planned" }
        ]}
      />
      {(view === "active" || view === "today" || view === "overdue" || view === "all") ? (
      <section className="task-list-section spacing-top">
        <div className="section-head">
          <div>
            <h2 className="section-title">{view === "today" ? "Heute fällig" : view === "overdue" ? "Überfällig" : view === "all" ? "Alle Aufgaben" : "Priorisierte Aufgaben"}</h2>
          </div>
          <TaskSortControl params={normalizeTaskParams(params)} />
        </div>
        <div className="task-priority-list">
          {visibleActiveTasks.length === 0 ? <EmptyState>{query ? "Keine passenden offenen Aufgaben." : "Keine offenen Aufgaben."}</EmptyState> : null}
          {visibleActiveTasks.map((task) => <TaskCard task={task} members={members} documentRoots={documentRoots} key={task.id} />)}
        </div>
      </section>
      ) : null}

      {(view === "planned" || view === "all") ? (
      <section className="task-list-section spacing-top">
        <div className="section-head">
          <div>
            <h2 className="section-title">Geplante Aufgaben</h2>
          </div>
          <TaskSortControl params={normalizeTaskParams(params)} />
        </div>
        <div className="task-priority-list">
          {plannedTasks.length === 0 ? <EmptyState>{query ? "Keine passenden geplanten Aufgaben." : "Keine geplanten Aufgaben."}</EmptyState> : null}
          {plannedTasks.map((task) => <PlannedTaskCard task={task} members={members} key={task.id} />)}
        </div>
      </section>
      ) : null}

      {(view === "done" || view === "all") ? (
      <section className="task-list-section spacing-top task-done-section">
        <div className="section-head">
          <div>
            <h2 className="section-title">Erledigte Aufgaben</h2>
          </div>
          <TaskSortControl params={normalizeTaskParams(params)} />
        </div>
        <div className="task-priority-list">
          {completedTasks.length === 0 ? <EmptyState>{query ? "Keine passenden erledigten Aufgaben." : "Noch keine erledigten Aufgaben."}</EmptyState> : null}
          {completedTasks.map((task) => <TaskCard task={task} members={members} documentRoots={documentRoots} completed key={task.id} />)}
        </div>
      </section>
      ) : null}
    </>
  );
}

function getTaskView(value: unknown): "active" | "today" | "overdue" | "planned" | "done" | "all" {
  if (value === "today" || value === "overdue" || value === "planned" || value === "done" || value === "all") return value;
  return "active";
}

function buildTasksHref(params: TaskPageParams, next: Partial<TaskPageParams>) {
  const search = new URLSearchParams();
  const merged = { ...params, ...next };
  if (merged.q) search.set("q", merged.q);
  if (getTaskView(merged.view) !== "active") search.set("view", getTaskView(merged.view));
  if (isTaskPriority(merged.priority)) search.set("priority", merged.priority);
  if (merged.person) search.set("person", merged.person);
  if (merged.recurring === "recurring") search.set("recurring", merged.recurring);
  if (getTaskSort(merged.sort) !== "importance") search.set("sort", getTaskSort(merged.sort));
  const query = search.toString();
  return query ? `/aufgaben?${query}` : "/aufgaben";
}

function normalizeTaskParams(params: TaskPageParams) {
  const normalized: TaskPageParams = {};
  if (params.q) normalized.q = params.q;
  const view = getTaskView(params.view);
  if (view !== "active") normalized.view = view;
  if (isTaskPriority(params.priority)) normalized.priority = params.priority;
  if (params.person) normalized.person = params.person;
  if (params.recurring === "recurring") normalized.recurring = params.recurring;
  const sort = getTaskSort(params.sort);
  if (sort !== "importance") normalized.sort = sort;
  return normalized;
}

function getTaskFilters(params: TaskPageParams) {
  return {
    priority: isTaskPriority(params.priority) ? params.priority : null,
    person: params.person || null,
    recurring: params.recurring === "recurring"
  };
}

function matchesTaskFilters(task: TaskLike, filters: ReturnType<typeof getTaskFilters>) {
  if (filters.priority && task.priority !== filters.priority) return false;
  if (filters.person === "unassigned" && task.assignedToUserId) return false;
  if (filters.person && filters.person !== "unassigned" && task.assignedToUserId !== filters.person) return false;
  if (filters.recurring && !task.recurringTask) return false;
  return true;
}

function matchesRecurringTaskFilters(task: RecurringTaskLike, filters: ReturnType<typeof getTaskFilters>) {
  if (filters.priority && task.priority !== filters.priority) return false;
  if (filters.person === "unassigned" && task.assignedToUserId) return false;
  if (filters.person && filters.person !== "unassigned" && task.assignedToUserId !== filters.person) return false;
  return true;
}

function getTaskSort(value: unknown): "importance" | "date-asc" | "date-desc" {
  if (value === "date-asc" || value === "date-desc") return value;
  return "importance";
}

function sortTasks(tasks: TaskLike[], sort: ReturnType<typeof getTaskSort>) {
  return [...tasks].sort((a, b) => {
    if (sort === "date-asc") return compareDates(a.dueDate, b.dueDate, "asc") || taskRank(b) - taskRank(a);
    if (sort === "date-desc") return compareDates(a.dueDate, b.dueDate, "desc") || taskRank(b) - taskRank(a);
    return taskRank(b) - taskRank(a);
  });
}

function sortRecurringTasks(tasks: RecurringTaskLike[], sort: ReturnType<typeof getTaskSort>) {
  return [...tasks].sort((a, b) => {
    if (sort === "date-desc") return compareDates(a.nextDueDate, b.nextDueDate, "desc");
    return compareDates(a.nextDueDate, b.nextDueDate, "asc");
  });
}

function compareDates(a: Date | string | null, b: Date | string | null, direction: "asc" | "desc") {
  const aTime = a ? new Date(a).getTime() : Number.POSITIVE_INFINITY;
  const bTime = b ? new Date(b).getTime() : Number.POSITIVE_INFINITY;
  return direction === "asc" ? aTime - bTime : bTime - aTime;
}

function countActiveTaskFilters(params: TaskPageParams) {
  return [
    isTaskPriority(params.priority),
    Boolean(params.person),
    params.recurring === "recurring",
    getTaskSort(params.sort) !== "importance"
  ].filter(Boolean).length;
}

function filterPersonLabel(value: string, members: MemberLike[]) {
  if (value === "unassigned") return "Nicht zugewiesen";
  return members.find((member) => member.userId === value)?.user.name ?? "Person";
}

function isTaskPriority(value: unknown): value is keyof typeof priorityLabels {
  return value === "LOW" || value === "MEDIUM" || value === "HIGH" || value === "URGENT";
}

function TaskRow({ task, urgency }: { task: TaskLike; urgency?: ReturnType<typeof taskUrgency> }) {
  const assignee = task.assignee?.name ?? "Nicht zugewiesen";
  const dueDateLabel = task.dueDate ? formatDate(task.dueDate) : "Ohne Datum";
  const sideLabel = urgency && urgency.className !== "task-calm" ? urgency.label : priorityLabels[task.priority];
  return (
    <span className="task-row">
      <span className={`task-checkmark ${task.status === "DONE" || task.status === "ARCHIVED" ? "is-done" : ""}`} aria-hidden="true" />
      <span className="task-row-main">
        <strong>{task.title}</strong>
        <span className="task-row-person">
          <InitialAvatar name={assignee} />
          <small>{assignee}</small>
        </span>
      </span>
      <span className="task-row-side">
        <time dateTime={task.dueDate?.toISOString()}>{dueDateLabel}</time>
        <span>{sideLabel}</span>
      </span>
    </span>
  );
}

function PlannedTaskRow({ task }: { task: RecurringTaskLike }) {
  const assignee = task.assignee?.name ?? "Nicht zugewiesen";
  const nextDueDateLabel = task.nextDueDate ? formatDate(task.nextDueDate) : "Ohne Datum";
  return (
    <span className="task-row">
      <span className="task-checkmark is-planned" aria-hidden="true" />
      <span className="task-row-main">
        <strong>{task.title}</strong>
        <span className="task-row-person">
          <InitialAvatar name={assignee} />
          <small>{assignee}</small>
        </span>
      </span>
      <span className="task-row-side">
        <time dateTime={task.nextDueDate?.toISOString()}>{nextDueDateLabel}</time>
        <span>Geplant</span>
      </span>
    </span>
  );
}

function InitialAvatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return <span className="task-avatar" aria-label={name}>{initial}</span>;
}

function TaskEditModal({ task, members, documentRoots }: { task: TaskLike; members: MemberLike[]; documentRoots: DocumentRootLike[] }) {
  return (
    <ActionModal
      title="Aufgabe bearbeiten"
      trigger={<Pencil size={18} aria-hidden="true" />}
      triggerLabel="Aufgabe bearbeiten"
      triggerClassName="task-detail-edit-button"
      panelClassName="task-edit-dialog"
      sheetVariant="create"
      wide
      modalId={`task-${task.id}-edit`}
    >
      <TaskEditForm
        task={{
          id: task.id,
          title: task.title,
          dueDate: toDateInputValue(task.dueDate),
          assignedToUserId: task.assignedToUserId ?? "",
          priority: task.priority,
          description: task.description ?? "",
          scope: task.scope,
          recurrenceLabel: task.recurringTask ? `${task.recurringTask.title} · ${getRecurringTaskIntervalLabel(task.recurringTask)}` : null,
          recurrence: task.recurringTask ? {
            id: task.recurringTask.id,
            title: task.recurringTask.title,
            startDate: toDateInputValue(task.recurringTask.startDate),
            endDate: toDateInputValue(task.recurringTask.endDate),
            assignedToUserId: task.recurringTask.assignedToUserId ?? "",
            priority: task.recurringTask.priority,
            description: task.recurringTask.description ?? "",
            scope: task.recurringTask.scope,
            intervalCount: String(recurringTaskEditInterval(task.recurringTask).count),
            intervalUnit: recurringTaskEditInterval(task.recurringTask).unit,
            leadTimeDays: String(task.recurringTask.leadTimeDays),
            status: task.recurringTask.status
          } : null
        }}
        members={members}
        documentRoots={documentRoots}
      />
    </ActionModal>
  );
}

function RecurringTaskEditModal({ task, members }: { task: RecurringTaskLike; members: MemberLike[] }) {
  const editInterval = recurringTaskEditInterval(task);
  return (
    <ActionModal
      title="Wiederkehrende Aufgabe bearbeiten"
      trigger={<Pencil size={18} aria-hidden="true" />}
      triggerLabel="Geplante Aufgabe bearbeiten"
      triggerClassName="task-detail-edit-button"
      panelClassName="task-edit-dialog"
      sheetVariant="create"
      wide
      modalId={`recurring-task-${task.id}-edit`}
    >
      <RecurringTaskEditForm
        task={{
          id: task.id,
          title: task.title,
          nextDueDate: toDateInputValue(task.nextDueDate),
          startDate: toDateInputValue(task.startDate),
          endDate: toDateInputValue(task.endDate),
          assignedToUserId: task.assignedToUserId ?? "",
          priority: task.priority,
          description: task.description ?? "",
          scope: task.scope,
          intervalCount: String(editInterval.count),
          intervalUnit: editInterval.unit,
          leadTimeDays: String(task.leadTimeDays),
          status: task.status,
          recurrenceLabel: getRecurringTaskIntervalLabel(task)
        }}
        members={members}
      />
    </ActionModal>
  );
}

function TaskCard({ task, members, documentRoots, completed = false }: { task: TaskLike; members: MemberLike[]; documentRoots: DocumentRootLike[]; completed?: boolean }) {
  const urgency = taskUrgency(task);
  const done = task.status === "DONE" || task.status === "ARCHIVED";
  return (
    <div className="task-row-shell">
      <ActionModal
        title="Aufgabendetails"
        trigger={<TaskRow task={task} urgency={urgency} />}
        triggerClassName={`task-row-trigger ${completed ? "task-completed" : urgency.className}`}
        modalId={`task-${task.id}`}
      >
        <div className="task-expanded-content task-detail-sheet">
          <div className="task-detail-read">
            <div className="task-detail-head">
              <div className="task-detail-check">
                <TaskInlineCheck taskId={task.id} done={done} />
              </div>
              <div className="task-detail-title-block">
                <h3>{task.title}</h3>
                {urgency.className !== "task-calm" ? <span className={`task-detail-urgency ${urgency.className}`}>{urgency.label}</span> : null}
              </div>
              <TaskEditModal task={task} members={members} documentRoots={documentRoots} />
            </div>
            <dl className="task-detail-meta">
              <div><UserRound size={18} aria-hidden="true" /><dt>Zuständig</dt><dd>{task.assignee ? <><InitialAvatar name={task.assignee.name} /> {task.assignee.name}</> : "Nicht zugewiesen"}</dd></div>
              <div><CalendarDays size={18} aria-hidden="true" /><dt>Fällig</dt><dd>{task.dueDate ? formatDate(task.dueDate) : "Ohne Datum"}</dd></div>
              <div><Flag size={18} aria-hidden="true" /><dt>Priorität</dt><dd>{priorityLabels[task.priority]}</dd></div>
              <div><Lock size={18} aria-hidden="true" /><dt>Sichtbarkeit</dt><dd>{task.scope === "FAMILY" ? "Familie" : "Privat"}</dd></div>
              {task.recurringTask ? <div><RotateCcw size={18} aria-hidden="true" /><dt>Serie</dt><dd>{task.recurringTask.title} · {getRecurringTaskIntervalLabel(task.recurringTask)}</dd></div> : null}
            </dl>
            {task.description ? <div className="task-detail-note"><span>Notiz</span><p>{task.description}</p></div> : null}
            <div className="task-detail-footnote">
              <span>Erstellt von {task.owner.name}</span>
              <time>Aktualisiert {formatDate(task.updatedAt)}</time>
            </div>
          </div>
        </div>
      </ActionModal>
      <div className="task-check-form">
        <TaskInlineCheck taskId={task.id} done={done} />
      </div>
    </div>
  );
}

function PlannedTaskCard({ task, members }: { task: RecurringTaskLike; members: MemberLike[] }) {
  return (
    <ActionModal
      title="Geplante Aufgabe"
      trigger={<PlannedTaskRow task={task} />}
      triggerClassName={`task-row-trigger ${task.status === "PAUSED" ? "task-completed" : "task-calm"}`}
      modalId={`recurring-task-${task.id}`}
    >
      <div className="task-expanded-content task-detail-sheet">
        <div className="task-detail-read">
          <div className="task-detail-head task-detail-head-plain">
            <div className="task-detail-title-block">
              <div className={`task-detail-status ${task.status === "PAUSED" ? "task-warning" : "task-calm"}`}>
                <RotateCcw size={15} aria-hidden="true" />
              <span>{task.status === "PAUSED" ? "Pausiert" : "Aktiv"}</span>
              </div>
              <h3>{task.title}</h3>
            </div>
            <RecurringTaskEditModal task={task} members={members} />
          </div>
          <dl className="task-detail-meta">
            <div><UserRound size={18} aria-hidden="true" /><dt>Zuständig</dt><dd>{task.assignee ? <><InitialAvatar name={task.assignee.name} /> {task.assignee.name}</> : "Nicht zugewiesen"}</dd></div>
            <div><CalendarDays size={18} aria-hidden="true" /><dt>Nächste Fälligkeit</dt><dd>{task.nextDueDate ? formatDate(task.nextDueDate) : "Ohne Datum"}</dd></div>
            <div><RotateCcw size={18} aria-hidden="true" /><dt>Wiederholung</dt><dd>{getRecurringTaskIntervalLabel(task)}</dd></div>
            <div><Flag size={18} aria-hidden="true" /><dt>Priorität</dt><dd>{priorityLabels[task.priority]}</dd></div>
            <div><Lock size={18} aria-hidden="true" /><dt>Sichtbarkeit</dt><dd>{task.scope === "FAMILY" ? "Familie" : "Privat"}</dd></div>
          </dl>
          {task.description ? <div className="task-detail-note"><span>Notiz</span><p>{task.description}</p></div> : null}
          <div className="task-detail-footnote">
            <span>Erstellt von {task.owner.name}</span>
            <time>Aktualisiert {formatDate(task.updatedAt)}</time>
          </div>
          <div className="task-actions task-detail-actions">
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
          </div>
        </div>
      </div>
    </ActionModal>
  );
}

function recurringTaskEditInterval(task: Pick<RecurringTaskLike, "intervalCount" | "intervalUnit">): { count: number; unit: "DAY" | "WEEK" | "MONTH" | "YEAR" } {
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

const sortLabels = {
  importance: "Wichtigkeit",
  "date-asc": "Datum aufsteigend",
  "date-desc": "Datum absteigend"
};

type TaskLike = Awaited<ReturnType<typeof getVisibleTasks>>[number];
type RecurringTaskLike = Awaited<ReturnType<typeof getVisibleRecurringTasks>>[number];
type MemberLike = Awaited<ReturnType<typeof getFamilyMembers>>[number];
type DocumentRootLike = Awaited<ReturnType<typeof getVisibleDocumentRoots>>[number];
