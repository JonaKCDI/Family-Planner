import { archiveRecurringTask, pauseRecurringTask, resumeRecurringTask, updateRecurringTask, updateTask } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { formatDate, toDateInputValue } from "@/lib/format";
import { getFamilyMembers, getVisibleRecurringTasks, getVisibleTasks } from "@/lib/queries";
import { ensureDueRecurringTasks } from "@/lib/recurring-tasks";
import { daysUntil, getRecurringTaskIntervalLabel, taskRank, taskUrgency } from "@/lib/tasks";
import { ActionModal } from "@/components/action-modal";
import { AutosaveForm } from "@/components/autosave-form";
import { TaskStatusControl } from "@/components/task-status-control";
import { TaskToolbar } from "@/components/task-toolbar";
import { EmptyState, PageHeader, ScopeSelect } from "@/components/ui";
import { Chip, ExpandableListItem, StatusBadge } from "@/components/ui-system";

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
  const [tasks, recurringTasks, members] = await Promise.all([
    getVisibleTasks(session.family.id, session.user.id),
    getVisibleRecurringTasks(session.family.id, session.user.id),
    getFamilyMembers(session.family.id)
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

      <section className="stats">
        <div className="stat"><span>In Arbeit</span><strong>{activeTasks.filter((task) => task.status === "IN_PROGRESS").length}</strong></div>
        <div className="stat"><span>Offen</span><strong>{activeTasks.filter((task) => task.status === "OPEN").length}</strong></div>
        <div className="stat"><span>Heute / überfällig</span><strong>{activeTasks.filter((task) => daysUntil(task.dueDate) <= 0).length}</strong></div>
        <div className="stat"><span>Geplant</span><strong>{plannedTasks.length}</strong></div>
      </section>

      <nav className="section-switcher" aria-label="Aufgabenansicht">
        <a className={view === "active" ? "active" : ""} href={buildTasksHref(params, { view: "active" })}>Aktiv</a>
        <a className={view === "planned" ? "active" : ""} href={buildTasksHref(params, { view: "planned" })}>Geplant</a>
        <a className={view === "done" ? "active" : ""} href={buildTasksHref(params, { view: "done" })}>Erledigt</a>
        <a className={view === "all" ? "active" : ""} href={buildTasksHref(params, { view: "all" })}>Alle</a>
      </nav>

      {(view === "active" || view === "all") ? (
      <section className="panel spacing-top">
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
      ) : null}

      {(view === "planned" || view === "all") ? (
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
      ) : null}

      {(view === "done" || view === "all") ? (
      <section className="panel spacing-top">
        <div className="section-head">
          <div>
            <h2 className="section-title">Erledigte Aufgaben</h2>
          </div>
        </div>
        <div className="task-priority-list">
          {completedTasks.length === 0 ? <EmptyState>{query ? "Keine passenden erledigten Aufgaben." : "Noch keine erledigten Aufgaben."}</EmptyState> : null}
          {completedTasks.map((task) => <TaskCard task={task} members={members} completed key={task.id} />)}
        </div>
      </section>
      ) : null}
    </>
  );
}

function getTaskView(value: unknown): "active" | "planned" | "done" | "all" {
  if (value === "planned" || value === "done" || value === "all") return value;
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

function TaskCard({ task, members, completed = false }: { task: TaskLike; members: MemberLike[]; completed?: boolean }) {
  const urgency = taskUrgency(task);
  return (
    <ExpandableListItem
      className={`task-expand-item ${completed ? "task-completed" : urgency.className}`}
      summary={task.title}
      meta={`${task.assignee?.name ?? "Nicht zugewiesen"} · ${formatDate(task.dueDate)} · ${priorityLabels[task.priority]}`}
      value={<StatusBadge tone={completed ? "positive" : urgency.chipClass === "danger-chip" ? "negative" : urgency.chipClass === "warning-chip" ? "warning" : "neutral"}>{completed ? taskStatusTone(task.status).label : urgency.label}</StatusBadge>}
    >
      <div className="task-expanded-content">
        <div className="task-expanded-copy">
          <p>{task.description || "Keine Beschreibung hinterlegt."}</p>
          <div className="badge-row">
            <Chip>{task.scope === "FAMILY" ? "Familie" : "Privat"}</Chip>
            <Chip>{taskStatusTone(task.status).label}</Chip>
            {task.recurringTask ? <Chip tone="neutral">{task.recurringTask.title}</Chip> : null}
          </div>
        </div>
        <div className="task-actions">
          <TaskStatusControl taskId={task.id} initialStatus={task.status} />
          <ActionModal title="Aufgabe bearbeiten" trigger="Bearbeiten" modalId={`task-${task.id}`}>
            <AutosaveForm action={updateTask} className="form form-grid modal-form">
              <input type="hidden" name="id" value={task.id} />
              <nav className="modal-section-tabs full-span" aria-label="Formularbereiche">
                <a href={`#task-${task.id}-details`}>Details</a>
                <a href={`#task-${task.id}-options`}>Weitere Optionen</a>
              </nav>
              <fieldset className="fieldset modal-form-section full-span" id={`task-${task.id}-details`}>
                <legend>Details</legend>
                <div className="form-grid">
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
                  <label className="full-span">Beschreibung<textarea name="description" defaultValue={task.description ?? ""} /></label>
                </div>
              </fieldset>
              <fieldset className="fieldset modal-form-section full-span" id={`task-${task.id}-options`}>
                <legend>Weitere Optionen</legend>
                <div className="form-grid">
                  <ScopeSelect defaultValue={task.scope} />
                  <div className="form-note full-span">
                    {task.recurringTask ? `Wiederholung: ${task.recurringTask.title}` : "Keine Wiederholung verknüpft."}
                  </div>
                </div>
              </fieldset>
              <button className="button full-span autosave-submit" type="submit">Speichern</button>
            </AutosaveForm>
          </ActionModal>
        </div>
      </div>
    </ExpandableListItem>
  );
}

function PlannedTaskCard({ task, members }: { task: RecurringTaskLike; members: MemberLike[] }) {
  const editInterval = recurringTaskEditInterval(task);

  return (
    <ExpandableListItem
      className={`task-expand-item ${task.status === "PAUSED" ? "task-completed" : "task-calm"}`}
      summary={task.title}
      meta={`${task.assignee?.name ?? "Nicht zugewiesen"} · ${formatDate(task.nextDueDate)} · ${getRecurringTaskIntervalLabel(task)}`}
      value={<StatusBadge tone={task.status === "PAUSED" ? "neutral" : "positive"}>{task.status === "PAUSED" ? "Pausiert" : "Geplant"}</StatusBadge>}
    >
      <div className="task-expanded-content">
        <div className="task-expanded-copy">
          <p>{task.description || "Keine Beschreibung hinterlegt."}</p>
          <div className="badge-row">
            <Chip>{task.scope === "FAMILY" ? "Familie" : "Privat"}</Chip>
            <Chip>{getRecurringTaskIntervalLabel(task)}</Chip>
            <Chip tone="neutral">{priorityLabels[task.priority]}</Chip>
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
              <nav className="modal-section-tabs full-span" aria-label="Formularbereiche">
                <a href={`#recurring-task-${task.id}-details`}>Details</a>
                <a href={`#recurring-task-${task.id}-options`}>Weitere Optionen</a>
              </nav>
              <fieldset className="fieldset modal-form-section full-span" id={`recurring-task-${task.id}-details`}>
                <legend>Details</legend>
                <div className="form-grid">
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
                  <label>
                    Priorität
                    <select name="priority" defaultValue={task.priority}>
                      <option value="LOW">Niedrig</option>
                      <option value="MEDIUM">Mittel</option>
                      <option value="HIGH">Hoch</option>
                      <option value="URGENT">Dringend</option>
                    </select>
                  </label>
                  <label className="full-span">Beschreibung<textarea name="description" defaultValue={task.description ?? ""} /></label>
                </div>
              </fieldset>
              <fieldset className="fieldset modal-form-section full-span" id={`recurring-task-${task.id}-options`}>
                <legend>Weitere Optionen</legend>
                <div className="form-grid">
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
                    Status
                    <select name="status" defaultValue={task.status}>
                      <option value="ACTIVE">Aktiv</option>
                      <option value="PAUSED">Pausiert</option>
                      <option value="ARCHIVED">Archiviert</option>
                    </select>
                  </label>
                  <ScopeSelect defaultValue={task.scope} />
                </div>
              </fieldset>
              <button className="button full-span autosave-submit" type="submit">Speichern</button>
            </AutosaveForm>
            <form action={archiveRecurringTask} className="form compact spacing-top">
              <input type="hidden" name="id" value={task.id} />
              <button className="button secondary" type="submit">Archivieren</button>
            </form>
          </ActionModal>
        </div>
      </div>
    </ExpandableListItem>
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

const sortLabels = {
  importance: "Wichtigkeit",
  "date-asc": "Datum aufsteigend",
  "date-desc": "Datum absteigend"
};

type TaskLike = Awaited<ReturnType<typeof getVisibleTasks>>[number];
type RecurringTaskLike = Awaited<ReturnType<typeof getVisibleRecurringTasks>>[number];
type MemberLike = Awaited<ReturnType<typeof getFamilyMembers>>[number];
