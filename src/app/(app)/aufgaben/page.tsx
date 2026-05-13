import { createTask, updateTaskStatus } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getFamilyMembers, getVisibleTasks } from "@/lib/queries";
import { EmptyState, PageHeader, ScopeSelect } from "@/components/ui";

export default async function TasksPage() {
  const session = await requireSession();
  const [tasks, members] = await Promise.all([
    getVisibleTasks(session.family.id, session.user.id),
    getFamilyMembers(session.family.id)
  ]);

  return (
    <>
      <PageHeader title="Aufgaben" description="Actionliste für dich und die Familie mit Priorität, Deadline und Status." />
      <div className="grid two">
        <section className="panel" id="aufgabe-erfassen">
          <h2 className="section-title">Aufgabe erfassen</h2>
          <form action={createTask} className="form">
            <label>
              Titel
              <input name="title" required />
            </label>
            <label>
              Beschreibung
              <textarea name="description" />
            </label>
            <label>
              Zuweisen an
              <select name="assignedToUserId" defaultValue="">
                <option value="">Nicht zugewiesen</option>
                {members.map((member) => (
                  <option value={member.userId} key={member.id}>{member.user.name}</option>
                ))}
              </select>
            </label>
            <label>
              Deadline
              <input name="dueDate" type="date" />
            </label>
            <label>
              Priorität
              <select name="priority" defaultValue="MEDIUM">
                <option value="LOW">Niedrig</option>
                <option value="MEDIUM">Mittel</option>
                <option value="HIGH">Hoch</option>
                <option value="URGENT">Dringend</option>
              </select>
            </label>
            <ScopeSelect />
            <button className="button" type="submit">Speichern</button>
          </form>
        </section>
        <section className="panel">
          <h2 className="section-title">Offene und laufende Aufgaben</h2>
          <div className="list">
            {tasks.length === 0 ? <EmptyState>Noch keine Aufgaben erfasst.</EmptyState> : null}
            {tasks.map((task) => (
              <article className="card" key={task.id}>
                <div className="row">
                  <div>
                    <strong>{task.title}</strong>
                    <span className="muted">
                      {task.assignee?.name ?? "Nicht zugewiesen"} · Fällig: {formatDate(task.dueDate)} · {task.priority}
                    </span>
                    {task.description ? <p>{task.description}</p> : null}
                    <span className="badge">{task.scope === "FAMILY" ? "Familie" : "Privat"}</span>
                  </div>
                  <form action={updateTaskStatus} className="form">
                    <input type="hidden" name="id" value={task.id} />
                    <select name="status" defaultValue={task.status}>
                      <option value="OPEN">Offen</option>
                      <option value="IN_PROGRESS">In Arbeit</option>
                      <option value="DONE">Erledigt</option>
                      <option value="ARCHIVED">Archiv</option>
                    </select>
                    <button className="button secondary" type="submit">Aktualisieren</button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
