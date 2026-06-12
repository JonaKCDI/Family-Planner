import {
  archiveExpenseLabel,
  createCategory,
  createExpenseLabel,
  createRecurringTransaction,
  deleteCategory,
  deleteExpenseLabel,
  exportExpensesToSynologyExcel,
  importExpensesFromSynologyExcel,
  importExpensesFromUploadedXlsx,
  mergeExpenseCategories,
  mergeExpenseLabels,
  pauseRecurringTransaction,
  softDeleteRecurringTransaction,
  unarchiveExpenseLabel,
  updateCategory,
  updateExpenseLabel,
  updateRecurringTransaction
} from "@/lib/actions";
import { formatDate, formatMoney, toDateInputValue } from "@/lib/format";
import type { getExpenseLabels, getRecurringTransactions, getVisibleCategories } from "@/lib/queries";
import { AutosaveForm } from "@/components/autosave-form";
import { ExcelProgressPanel } from "@/components/excel-progress-panel";
import { InlineEditPanel } from "@/components/inline-edit-panel";
import { SearchableSelect } from "@/components/searchable-select";
import { EmptyState } from "@/components/ui";

type CategoryLike = Awaited<ReturnType<typeof getVisibleCategories>>[number];
type LabelLike = Awaited<ReturnType<typeof getExpenseLabels>>[number];
type RecurringTransactionLike = Awaited<ReturnType<typeof getRecurringTransactions>>[number];

type ExpenseSetupPanelProps = {
  exportYear: number;
  categories: CategoryLike[];
  labels: LabelLike[];
  allLabels: LabelLike[];
  recurringTransactions: RecurringTransactionLike[];
  includeSeries?: boolean;
  returnTo?: string;
};

export function ExpenseSetupPanel({ exportYear, categories, labels, allLabels, recurringTransactions, includeSeries = false, returnTo = "/ausgaben?modal=ausgaben-setup" }: ExpenseSetupPanelProps) {
  return (
    <div className="expense-setup-layout">
      <section className="setup-card setup-card-primary">
        <div className="setup-card-head">
          <div>
            <h2 className="section-title">Excel-Sicherung</h2>
            <p className="muted">Export und Import für das aktuell ausgewählte Jahr {exportYear}.</p>
          </div>
        </div>
        <ExcelProgressPanel>
          <div className="excel-actions">
            <a className="button secondary" href={`/api/expenses/export?year=${exportYear}`} data-excel-progress={`Excel ${exportYear} wird vorbereitet ...`}>Excel {exportYear} herunterladen</a>
            <form action={importExpensesFromUploadedXlsx} className="upload-form">
              <input name="xlsxFile" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
              <button className="button secondary" type="submit" data-excel-progress="Excel-Datei wird importiert ...">Excel hochladen</button>
            </form>
            <div className="setup-action-row">
              <form action={importExpensesFromSynologyExcel}>
                <input type="hidden" name="year" value={exportYear} />
                <button className="button secondary" type="submit" data-excel-progress="Synology-Import läuft ...">Synology importieren</button>
              </form>
              <form action={exportExpensesToSynologyExcel}>
                <input type="hidden" name="year" value={exportYear} />
                <button className="button secondary" type="submit" data-excel-progress="Synology-Export läuft ...">Synology exportieren</button>
              </form>
            </div>
          </div>
        </ExcelProgressPanel>
      </section>

      <details className="setup-card" open>
        <summary>
          <span>
            <strong>Anlegen</strong>
            <small>Neue Labels und Kategorien</small>
          </span>
        </summary>
        <div className="setup-two-column">
          <form action={createExpenseLabel} className="form compact" id="label-erfassen">
            <input type="hidden" name="returnTo" value={returnTo} />
            <strong>Label hinzufügen</strong>
            <label>Name<input name="name" placeholder="Dienstreise Berlin, Gartenprojekt ..." required /></label>
            <label>Budget in EUR<input name="budget" inputMode="decimal" placeholder="500,00" /></label>
            <label>Farbe<input name="color" type="color" defaultValue="#16776f" /></label>
            <button className="button secondary" type="submit">Label speichern</button>
          </form>
          <form action={createCategory} className="form compact" id="kategorie-erfassen">
            <input type="hidden" name="returnTo" value={returnTo} />
            <strong>Kategorie hinzufügen</strong>
            <input type="hidden" name="type" value="EXPENSE" />
            <label>Name<input name="name" placeholder="Schule, Urlaub, Kindergeld ..." required /></label>
            <label>Monatsbudget in EUR<input name="monthlyBudget" inputMode="decimal" placeholder="250,00" /></label>
            <label>Farbe<input name="color" type="color" defaultValue="#2f6fed" /></label>
            <button className="button secondary" type="submit">Kategorie speichern</button>
          </form>
        </div>
      </details>

      <details className="setup-card">
        <summary>
          <span>
            <strong>Labels verwalten</strong>
            <small>Aktive Labels nach letzter Nutzung, archivierte am Ende</small>
          </span>
        </summary>
        <div className="label-management-list">
          {allLabels.length === 0 ? <EmptyState>Noch keine Labels vorhanden.</EmptyState> : null}
          {allLabels.map((label) => (
            <div className={label.archivedAt ? "label-management-row archived" : "label-management-row"} key={label.id}>
              <div>
                <strong>{label.name}</strong>
                <span className="muted">
                  {label.archivedAt ? "Archiviert" : "Aktiv"}{" · "}{label.budgetCents > 0 ? `Budget: ${formatMoney(label.budgetCents)}` : "Ohne Budget"}{" · "}{label.lastUsedAt ? `Zuletzt genutzt: ${formatDate(label.lastUsedAt)}` : "Noch nicht genutzt"}
                </span>
              </div>
              <div className="label-management-actions">
                <InlineEditPanel trigger="Bearbeiten">
                  <AutosaveForm action={updateExpenseLabel} className="form compact label-inline-form" statusKey={`expense-label-${label.id}`}>
                    <input type="hidden" name="id" value={label.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <label>Name<input name="name" defaultValue={label.name} required /></label>
                    <label>Budget in EUR<input name="budget" inputMode="decimal" defaultValue={formatEuroInput(label.budgetCents)} /></label>
                    <label>Farbe<input name="color" type="color" defaultValue={label.color} /></label>
                    <button className="button secondary autosave-submit" type="submit">Speichern</button>
                  </AutosaveForm>
                </InlineEditPanel>
                <form action={label.archivedAt ? unarchiveExpenseLabel : archiveExpenseLabel}>
                  <input type="hidden" name="id" value={label.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <button className="button secondary" type="submit">{label.archivedAt ? "Wieder aktivieren" : "Archivieren"}</button>
                </form>
                <form action={deleteExpenseLabel}>
                  <input type="hidden" name="id" value={label.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <button className="button secondary danger-subtle" type="submit">Löschen</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </details>

      <details className="setup-card">
        <summary>
          <span>
            <strong>Zusammenführen</strong>
            <small>Typo-Daten in das richtige Ziel schieben</small>
          </span>
        </summary>
        <div className="merge-tools">
          <form action={mergeExpenseLabels} className="form compact">
            <input type="hidden" name="returnTo" value={returnTo} />
            <strong>Labels</strong>
            <label>Von<select name="sourceLabelId" required defaultValue=""><option value="" disabled>Typo wählen</option>{allLabels.map((label) => <option value={label.id} key={label.id}>{label.name}{label.archivedAt ? " (archiviert)" : ""}</option>)}</select></label>
            <label>Nach<select name="targetLabelId" required defaultValue=""><option value="" disabled>Ziel wählen</option>{allLabels.map((label) => <option value={label.id} key={label.id}>{label.name}{label.archivedAt ? " (archiviert)" : ""}</option>)}</select></label>
            <button className="button secondary" type="submit" disabled={allLabels.length < 2}>Labels zusammenführen</button>
          </form>
          <form action={mergeExpenseCategories} className="form compact">
            <input type="hidden" name="returnTo" value={returnTo} />
            <strong>Kategorien</strong>
            <label>Von<select name="sourceCategoryId" required defaultValue=""><option value="" disabled>Typo wählen</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
            <label>Nach<select name="targetCategoryId" required defaultValue=""><option value="" disabled>Ziel wählen</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
            <button className="button secondary" type="submit" disabled={categories.length < 2}>Kategorien zusammenführen</button>
          </form>
        </div>
      </details>

      <details className="setup-card">
        <summary>
          <span>
            <strong>Kategorien bearbeiten</strong>
            <small>Budget, Farbe und Name anpassen</small>
          </span>
        </summary>
        <div className="category-editor-list">
          {categories.map((category) => (
            <div className="label-management-row category-management-row" key={category.id}>
              <div>
                <strong><span className="color-dot" style={{ background: category.color }} />{category.name}</strong>
                <span className="muted">Monatsbudget: {formatMoney(category.monthlyBudgetCents)}</span>
              </div>
              <div className="label-management-actions">
                <InlineEditPanel trigger="Bearbeiten">
                  <AutosaveForm action={updateCategory} className="form compact label-inline-form" statusKey={`expense-category-${category.id}`}>
                    <input type="hidden" name="id" value={category.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <label>Name<input name="name" defaultValue={category.name} required /></label>
                    <label>Monatsbudget in EUR<input name="monthlyBudget" inputMode="decimal" defaultValue={formatEuroInput(category.monthlyBudgetCents)} /></label>
                    <label>Farbe<input name="color" type="color" defaultValue={category.color} /></label>
                    <input type="hidden" name="scope" value="PRIVATE" />
                    <button className="button secondary autosave-submit" type="submit">Speichern</button>
                  </AutosaveForm>
                </InlineEditPanel>
                <form action={deleteCategory}>
                  <input type="hidden" name="id" value={category.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <button className="button secondary danger-subtle" type="submit">Kategorie löschen</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </details>

      {includeSeries ? <RecurringTransactionsPanel recurringTransactions={recurringTransactions} categories={categories} labels={labels} /> : null}
    </div>
  );
}

export function RecurringTransactionsPanel({ recurringTransactions, categories, labels }: { recurringTransactions: RecurringTransactionLike[]; categories: CategoryLike[]; labels: LabelLike[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const categoryOptions = categories.map((category) => ({ id: category.id, name: category.name, color: category.color }));
  const labelOptions = labels.map((label) => ({ id: label.id, name: label.name, color: label.color }));
  return (
    <div className="recurring-layout">
      <section className="setup-card setup-card-primary">
        <div className="setup-card-head">
          <div>
            <h2 className="section-title">Neue Serie</h2>
            <p className="muted">Regelmäßige private Einnahmen oder Ausgaben automatisch buchen.</p>
          </div>
        </div>
        <form action={createRecurringTransaction} className="form form-grid compact">
          <label>Titel<input name="title" placeholder="Gehalt, Miete, Sparrate ..." required /></label>
          <label>Art<select name="kind" defaultValue="EXPENSE"><option value="EXPENSE">Ausgabe</option><option value="INCOME">Einnahme</option></select></label>
          <label>Betrag in EUR<input name="amount" inputMode="decimal" placeholder="42,50" required /></label>
          <label>Intervall<select name="billingInterval" defaultValue="MONTHLY"><option value="MONTHLY">Monatlich</option><option value="QUARTERLY">Quartalsweise</option><option value="YEARLY">Jährlich</option></select></label>
          <label>Startdatum<input name="startDate" type="date" defaultValue={today} required /></label>
          <label>Enddatum optional<input name="endDate" type="date" /></label>
          <PaymentMethodSelect />
          <label>Laden / Quelle<input name="store" placeholder="Arbeitgeber, Vermieter, Bank ..." /></label>
          <SearchableSelect name="categoryId" label="Kategorie" options={categoryOptions} emptyLabel="Keine Kategorie" placeholder="Kategorie suchen oder auswählen" />
          <SearchableSelect name="labelId" label="Label / Projekt" options={labelOptions} emptyLabel="Kein Label" placeholder="Label suchen oder auswählen" />
          <input type="hidden" name="status" value="ACTIVE" />
          <label className="full-span">Beschreibung<input name="description" placeholder="Optionaler Hinweis für erzeugte Buchungen" /></label>
          <button className="button secondary full-span" type="submit">Serie speichern</button>
        </form>
      </section>

      <section className="setup-card">
        <h2 className="section-title">Bestehende Serien</h2>
        <div className="category-editor-list">
          {recurringTransactions.length === 0 ? <EmptyState>Noch keine Serien vorhanden.</EmptyState> : null}
          {recurringTransactions.map((series) => {
            const currentPhase = series.pricePhases.at(-1);
            return (
              <details className="category-editor" key={series.id}>
                <summary>
                  <span className="color-dot" style={{ background: series.category?.color ?? "#6b6f76" }} />
                  <span>{series.title}<small>{series.status === "ACTIVE" ? "Aktiv" : "Pausiert"} · {series.kind === "INCOME" ? "Einnahme" : "Ausgabe"}</small></span>
                  <strong>{currentPhase ? formatMoney(currentPhase.amountCents, currentPhase.currency) : "-"}</strong>
                </summary>
                <AutosaveForm action={updateRecurringTransaction} className="form form-grid compact" statusKey={`recurring-transaction-${series.id}`}>
                  <input type="hidden" name="id" value={series.id} />
                  <label>Titel<input name="title" defaultValue={series.title} required /></label>
                  <label>Art<select name="kind" defaultValue={series.kind}><option value="EXPENSE">Ausgabe</option><option value="INCOME">Einnahme</option></select></label>
                  <label>Betrag in EUR<input name="amount" inputMode="decimal" defaultValue={formatEuroInput(currentPhase?.amountCents ?? 0)} required /></label>
                  <label>Gültig ab<input name="priceValidFrom" type="date" defaultValue={toDateInputValue(currentPhase?.validFrom ?? series.startDate)} required /></label>
                  <label>Preisänderung<select name="priceChangeMode" defaultValue="NEW_PHASE"><option value="NEW_PHASE">Neue Preisphase ab Gültig-ab</option><option value="CORRECT_CURRENT">Aktuelle Phase korrigieren</option></select></label>
                  <p className="muted full-span">Die Preisphase ändert die Vorlage für zukünftige automatische Buchungen. Die Checkbox unten ändert zusätzlich bereits erzeugte Auto-Buchungen im betroffenen Zeitraum.</p>
                  <label>Intervall<select name="billingInterval" defaultValue={currentPhase?.billingInterval ?? "MONTHLY"}><option value="MONTHLY">Monatlich</option><option value="QUARTERLY">Quartalsweise</option><option value="YEARLY">Jährlich</option></select></label>
                  <label>Startdatum<input name="startDate" type="date" defaultValue={toDateInputValue(series.startDate)} required /></label>
                  <label>Enddatum optional<input name="endDate" type="date" defaultValue={toDateInputValue(series.endDate)} /></label>
                  <label>Status<select name="status" defaultValue={series.status}><option value="ACTIVE">Aktiv</option><option value="PAUSED">Pausiert</option></select></label>
                  <PaymentMethodSelect defaultValue={series.paymentMethod} />
                  <label>Laden / Quelle<input name="store" defaultValue={series.store} /></label>
                  <SearchableSelect name="categoryId" label="Kategorie" options={categoryOptions} defaultValue={series.categoryId} emptyLabel="Keine Kategorie" placeholder="Kategorie suchen oder auswählen" />
                  <SearchableSelect name="labelId" label="Label / Projekt" options={labelOptions} defaultValue={series.labelId} emptyLabel="Kein Label" placeholder="Label suchen oder auswählen" />
                  <label className="checkbox-field full-span"><input name="updateGeneratedExpenses" type="checkbox" /> Bereits erzeugte Auto-Buchungen ab Gültig-ab aktualisieren</label>
                  <label className="full-span">Beschreibung<input name="description" defaultValue={series.description} /></label>
                  <div className="full-span price-history">
                    <strong>Preisentwicklung</strong>
                    {series.pricePhases.map((phase) => (
                      <span className="badge" key={phase.id}>
                        {formatMoney(phase.amountCents, phase.currency)} · {recurringIntervalLabels[phase.billingInterval]} · ab {formatDate(phase.validFrom)}{phase.validTo ? ` bis ${formatDate(phase.validTo)}` : ""}
                      </span>
                    ))}
                  </div>
                  <button className="button secondary full-span autosave-submit" type="submit">Speichern</button>
                </AutosaveForm>
                <div className="category-editor-actions">
                  <form action={pauseRecurringTransaction}>
                    <input type="hidden" name="id" value={series.id} />
                    <button className="button secondary" type="submit">Pausieren</button>
                  </form>
                  <form action={softDeleteRecurringTransaction}>
                    <input type="hidden" name="id" value={series.id} />
                    <button className="button secondary danger-subtle" type="submit">Entfernen</button>
                  </form>
                </div>
              </details>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function PaymentMethodSelect({ defaultValue = "Nicht angegeben" }: { defaultValue?: string }) {
  const value = defaultValue || "Nicht angegeben";
  const options = ["Nicht angegeben", "Karte", "Bar", "Überweisung", "Lastschrift", "PayPal", "Apple Pay"];
  const visibleOptions = options.includes(value) ? options : [value, ...options];
  return (
    <label>
      Bezahlart
      <select name="paymentMethod" defaultValue={value}>
        {visibleOptions.map((option) => <option value={option} key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function formatEuroInput(amountCents: number) {
  if (amountCents === 0) return "";
  return (amountCents / 100).toFixed(2).replace(".", ",");
}

const recurringIntervalLabels = {
  MONTHLY: "monatlich",
  QUARTERLY: "quartalsweise",
  YEARLY: "jährlich",
  ONCE: "einmalig",
  OTHER: "individuell"
};
