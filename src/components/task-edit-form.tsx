"use client";

import { useState } from "react";
import { ArrowLeft, ChevronRight, Repeat2 } from "lucide-react";
import { updateRecurringTask, updateTask } from "@/lib/actions";
import { AutosaveForm } from "@/components/autosave-form";
import { DocumentFilePicker } from "@/components/document-file-picker";

type MemberOption = {
  id: string;
  userId: string;
  user: { name: string };
};

type DocumentRootOption = {
  id: string;
  name: string;
};

type ScopeValue = "FAMILY" | "PRIVATE";
type PriorityValue = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type RecurringStatusValue = "ACTIVE" | "PAUSED" | "ARCHIVED";
type IntervalUnitValue = "DAY" | "WEEK" | "MONTH" | "YEAR";

type TaskEditFormProps = {
  task: {
    id: string;
    title: string;
    dueDate: string;
    assignedToUserId: string;
    priority: PriorityValue;
    description: string;
    scope: ScopeValue;
    recurrenceLabel: string | null;
    recurrence: {
      id: string;
      title: string;
      startDate: string;
      endDate: string;
      assignedToUserId: string;
      priority: PriorityValue;
      description: string;
      scope: ScopeValue;
      intervalCount: string;
      intervalUnit: IntervalUnitValue;
      leadTimeDays: string;
      status: RecurringStatusValue;
    } | null;
  };
  members: MemberOption[];
  documentRoots: DocumentRootOption[];
};

type RecurringTaskEditFormProps = {
  task: {
    id: string;
    title: string;
    nextDueDate: string;
    startDate: string;
    endDate: string;
    assignedToUserId: string;
    priority: PriorityValue;
    description: string;
    scope: ScopeValue;
    intervalCount: string;
    intervalUnit: IntervalUnitValue;
    leadTimeDays: string;
    status: RecurringStatusValue;
    recurrenceLabel: string;
  };
  members: MemberOption[];
};

type RecurringSeriesEditData = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  assignedToUserId: string;
  priority: PriorityValue;
  description: string;
  scope: ScopeValue;
  intervalCount: string;
  intervalUnit: IntervalUnitValue;
  leadTimeDays: string;
  status: RecurringStatusValue;
  recurrenceLabel: string;
};

export function TaskEditForm({ task, members, documentRoots }: TaskEditFormProps) {
  const [panel, setPanel] = useState<"main" | "options" | "repeat">("main");

  if (panel === "repeat" && task.recurrence) {
    return (
      <RecurringSeriesForm
        task={{
          ...task.recurrence,
          recurrenceLabel: task.recurrenceLabel ?? "Wiederholung"
        }}
        onBack={() => setPanel("main")}
      />
    );
  }

  return (
    <AutosaveForm action={updateTask} className="form form-grid modal-form task-create-form task-edit-form" data-task-view={panel === "main" ? "details" : panel}>
      {panel !== "main" ? <TaskEditSubhead title={panel === "options" ? "Weitere Optionen" : "Wiederholung"} onBack={() => setPanel("main")} /> : null}
      <input type="hidden" name="id" value={task.id} />
      <fieldset className="fieldset modal-form-section full-span task-create-core" hidden={panel !== "main"}>
        <legend>Aufgabe</legend>
        <label className="full-span">Titel<input name="title" defaultValue={task.title} required /></label>
        <label>Fällig am<input name="dueDate" type="date" defaultValue={task.dueDate} /></label>
        <AssigneeSelect members={members} defaultValue={task.assignedToUserId} />
        <PrioritySelect defaultValue={task.priority} />
        <label className="full-span">Notiz<textarea name="description" defaultValue={task.description} /></label>
      </fieldset>
      <fieldset className="fieldset modal-form-section full-span task-create-options-page" hidden={panel !== "options"}>
        <legend>Weitere Optionen</legend>
        <div className="form-grid">
          <ScopeSelect defaultValue={task.scope} />
          <label>Dokumenttitel<input name="documentTitle" placeholder="Anleitung, Foto, Nachweis ..." /></label>
          <label>HTTPS-Link<input name="documentUrl" type="url" placeholder="https://..." /></label>
          <DocumentFilePicker roots={documentRoots} />
        </div>
      </fieldset>
      <fieldset className="fieldset modal-form-section full-span task-create-options-page" hidden={panel !== "repeat"}>
        <legend>Wiederholung</legend>
        <div className="task-edit-message">
          {task.recurrenceLabel ?? "Diese Aufgabe ist nicht als Serie geplant."}
        </div>
      </fieldset>
      <button className="task-options-link full-span" type="button" hidden={panel !== "main"} onClick={() => setPanel("options")}>
        <span>Weitere Optionen</span>
        <ChevronRight size={18} aria-hidden="true" />
      </button>
      <button className="task-recurring-link full-span" type="button" hidden={panel !== "main"} onClick={() => setPanel("repeat")}>
        <Repeat2 size={18} aria-hidden="true" />
        <span>{task.recurrenceLabel ?? "Als wiederkehrende Aufgabe planen"}</span>
        <ChevronRight size={18} aria-hidden="true" />
      </button>
      <div className="modal-submit-row full-span">
        <button className="button" type="submit">Speichern</button>
      </div>
    </AutosaveForm>
  );
}

export function RecurringTaskEditForm({ task, members }: RecurringTaskEditFormProps) {
  const [panel, setPanel] = useState<"main" | "options" | "repeat">("main");

  if (panel === "repeat") {
    return <RecurringSeriesForm task={task} onBack={() => setPanel("main")} />;
  }

  return (
    <AutosaveForm action={updateRecurringTask} className="form form-grid modal-form task-create-form task-edit-form" data-task-view={panel === "main" ? "details" : panel}>
      {panel !== "main" ? <TaskEditSubhead title={panel === "options" ? "Weitere Optionen" : "Wiederholung"} onBack={() => setPanel("main")} /> : null}
      <input type="hidden" name="id" value={task.id} />
      <input type="hidden" name="startDate" value={task.startDate} />
      <input type="hidden" name="endDate" value={task.endDate} />
      <input type="hidden" name="intervalCount" value={task.intervalCount} />
      <input type="hidden" name="intervalUnit" value={task.intervalUnit} />
      <input type="hidden" name="leadTimeDays" value={task.leadTimeDays} />
      <fieldset className="fieldset modal-form-section full-span task-create-core" hidden={panel !== "main"}>
        <legend>Aufgabe</legend>
        <label className="full-span">Titel<input name="title" defaultValue={task.title} required /></label>
        <label>Fällig am<input type="date" defaultValue={task.nextDueDate} readOnly /></label>
        <AssigneeSelect members={members} defaultValue={task.assignedToUserId} />
        <PrioritySelect defaultValue={task.priority} />
        <label className="full-span">Notiz<textarea name="description" defaultValue={task.description} /></label>
      </fieldset>
      <fieldset className="fieldset modal-form-section full-span task-create-options-page" hidden={panel !== "options"}>
        <legend>Weitere Optionen</legend>
        <div className="form-grid">
          <label>Status<select name="status" defaultValue={task.status}><option value="ACTIVE">Aktiv</option><option value="PAUSED">Pausiert</option><option value="ARCHIVED">Archiviert</option></select></label>
          <ScopeSelect defaultValue={task.scope} />
        </div>
      </fieldset>
      {panel === "main" ? (
        <>
          <button className="task-options-link full-span" type="button" onClick={() => setPanel("options")}>
            <span>Weitere Optionen</span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <button className="task-recurring-link full-span" type="button" onClick={() => setPanel("repeat")}>
            <Repeat2 size={18} aria-hidden="true" />
            <span>{task.recurrenceLabel}</span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </>
      ) : null}
      <div className="modal-submit-row full-span">
        <button className="button" type="submit">Speichern</button>
      </div>
    </AutosaveForm>
  );
}

function RecurringSeriesForm({ task, onBack }: { task: RecurringSeriesEditData; onBack: () => void }) {
  const initialPreset = getRecurringPreset(task.intervalCount, task.intervalUnit);
  const [recurrencePreset, setRecurrencePreset] = useState(initialPreset);
  const [customIntervalUnit, setCustomIntervalUnit] = useState<IntervalUnitValue>(task.intervalUnit);
  const customIntervalMax = customIntervalUnit === "WEEK" ? 52 : 365;

  return (
    <AutosaveForm action={updateRecurringTask} className="form form-grid modal-form task-create-form task-edit-form" data-task-view="repeat">
      <TaskEditSubhead title="Wiederholung" onBack={onBack} />
      <input type="hidden" name="id" value={task.id} />
      <input type="hidden" name="title" value={task.title} />
      <input type="hidden" name="assignedToUserId" value={task.assignedToUserId} />
      <input type="hidden" name="priority" value={task.priority} />
      <input type="hidden" name="description" value={task.description} />
      <input type="hidden" name="scope" value={task.scope} />
      <input type="hidden" name="status" value={task.status} />
      <fieldset className="fieldset modal-form-section full-span task-repeat-section">
        <legend>Wiederholung</legend>
        <div className="task-repeat-grid">
          <label>
            Wiederholt sich
            <select name="recurrencePreset" value={recurrencePreset} onChange={(event) => setRecurrencePreset(event.currentTarget.value)}>
              <option value="DAILY">Täglich</option>
              <option value="WEEKLY">Wöchentlich</option>
              <option value="MONTHLY">Monatlich</option>
              <option value="YEARLY">Jährlich</option>
              <option value="CUSTOM">Individuell</option>
            </select>
          </label>
          {recurrencePreset === "CUSTOM" ? (
            <>
              <label>Alle<input name="intervalCount" type="number" min="1" max={customIntervalMax} defaultValue={task.intervalCount} required /></label>
              <label>
                Einheit
                <select name="intervalUnit" value={customIntervalUnit} onChange={(event) => setCustomIntervalUnit(event.currentTarget.value as IntervalUnitValue)}>
                  <option value="DAY">Tage</option>
                  <option value="WEEK">Wochen</option>
                  <option value="MONTH">Monate</option>
                  <option value="YEAR">Jahre</option>
                </select>
              </label>
            </>
          ) : null}
          {recurrencePreset !== "CUSTOM" ? <input name="intervalCount" type="hidden" value="1" /> : null}
          {recurrencePreset !== "CUSTOM" ? <input name="intervalUnit" type="hidden" value={recurrencePreset === "YEARLY" ? "YEAR" : recurrencePreset === "MONTHLY" ? "MONTH" : recurrencePreset === "WEEKLY" ? "WEEK" : "DAY"} /> : null}
          <label>Startdatum<input name="startDate" type="date" defaultValue={task.startDate} required /></label>
          <label>Enddatum optional<input name="endDate" type="date" defaultValue={task.endDate} /></label>
          <label>Aufgabe anzeigen<select name="leadTimeDays" defaultValue={task.leadTimeDays}><option value="0">Am Fälligkeitstag</option><option value="1">1 Tag vorher</option><option value="2">2 Tage vorher</option><option value="3">3 Tage vorher</option><option value="7">7 Tage vorher</option></select></label>
        </div>
      </fieldset>
      <div className="modal-submit-row full-span">
        <button className="button" type="submit">Speichern</button>
      </div>
    </AutosaveForm>
  );
}

function getRecurringPreset(intervalCount: string, intervalUnit: IntervalUnitValue) {
  if (intervalCount === "1" && intervalUnit === "DAY") return "DAILY";
  if (intervalCount === "1" && intervalUnit === "WEEK") return "WEEKLY";
  if (intervalCount === "1" && intervalUnit === "MONTH") return "MONTHLY";
  if (intervalCount === "1" && intervalUnit === "YEAR") return "YEARLY";
  return "CUSTOM";
}

function TaskEditSubhead({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="task-create-subhead full-span">
      <button className="icon-button" type="button" aria-label="Zurück" title="Zurück" onClick={onBack}>
        <ArrowLeft size={18} aria-hidden="true" />
      </button>
      <div><strong>{title}</strong></div>
      <span aria-hidden="true" />
    </div>
  );
}

function AssigneeSelect({ members, defaultValue }: { members: MemberOption[]; defaultValue: string }) {
  return (
    <label>
      Zuständig
      <select name="assignedToUserId" defaultValue={defaultValue}>
        <option value="">Nicht zugewiesen</option>
        {members.map((member) => <option value={member.userId} key={member.id}>{member.user.name}</option>)}
      </select>
    </label>
  );
}

function PrioritySelect({ defaultValue }: { defaultValue: PriorityValue }) {
  return (
    <label>
      Priorität
      <select name="priority" defaultValue={defaultValue}>
        <option value="LOW">Niedrig</option>
        <option value="MEDIUM">Mittel</option>
        <option value="HIGH">Hoch</option>
        <option value="URGENT">Dringend</option>
      </select>
    </label>
  );
}

function ScopeSelect({ defaultValue }: { defaultValue: ScopeValue }) {
  return (
    <label>
      Sichtbarkeit
      <select name="scope" defaultValue={defaultValue}>
        <option value="FAMILY">Familie</option>
        <option value="PRIVATE">Privat</option>
      </select>
    </label>
  );
}
