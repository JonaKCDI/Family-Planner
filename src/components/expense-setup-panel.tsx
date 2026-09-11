import { quickCreateExpenseCategory, quickCreateExpenseLabel } from "@/lib/actions";
import { PaymentMethodField } from "@/components/payment-method-field";
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
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { ExcelProgressPanel } from "@/components/excel-progress-panel";
import { FinanceSetupEdit } from "@/components/finance-setup-edit";
import { Archive, ArchiveRestore, ChevronDown, Pause, Plus, Trash2 } from "lucide-react";
import { SearchableSelect } from "@/components/searchable-select";
import { CategoryIcon } from "@/components/category-icon";
import { CategoryIconPicker } from "@/components/category-icon-picker";
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

export function ExpenseSetupPanel({ exportYear, categories, labels, allLabels, recurringTransactions, includeSeries = false, returnTo = "/ausgaben/setup" }: ExpenseSetupPanelProps) {
  return (
    <div className="expense-setup-layout">
      <section className="setup-card setup-card-primary" id="excel-sicherung">
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
              <input type="hidden" name="returnTo" value={returnTo} />
              <input name="xlsxFile" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
              <button className="button secondary" type="submit" data-excel-progress="Excel-Datei wird importiert ...">Excel hochladen</button>
            </form>
            <div className="setup-action-row">
              <form action={importExpensesFromSynologyExcel}>
                <input type="hidden" name="returnTo" value={returnTo} />
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

      <details className="setup-card" id="finanz-anlegen" open>
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
            <CategoryIconPicker /><label className="checkbox-field"><input type="checkbox" name="excludeFromForecast" />Aus Prognose ausschließen (z. B. Auslagen)</label>
            <button className="button secondary" type="submit">Kategorie speichern</button>
          </form>
        </div>
      </details>

      <details className="setup-card" id="kategorien-bearbeiten">
        <summary>
          <span>
            <strong>Kategorien bearbeiten</strong>
            <small>Budget, Farbe, Icon und Name anpassen</small>
          </span>
        </summary>
        <div className="category-editor-list">
          {categories.map((category) => (
            <div className="label-management-row category-management-row" key={category.id}>
              <div>
                <strong><span className="category-icon-swatch" style={{ background: category.color }}><CategoryIcon icon={category.icon} size={16} /></span>{category.name}</strong>
                <span className="muted">Monatsbudget: {formatMoney(category.monthlyBudgetCents)}{category.excludeFromForecast ? " · Ohne Prognose" : ""}</span>
              </div>
              <div className="label-management-actions">
                <FinanceSetupEdit title={`${category.name} bearbeiten`}>
                  <AutosaveForm action={updateCategory} className="form compact label-inline-form" statusKey={`expense-category-${category.id}`}>
                    <input type="hidden" name="id" value={category.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <label>Name<input name="name" defaultValue={category.name} required /></label>
                    <label>Monatsbudget in EUR<input name="monthlyBudget" inputMode="decimal" defaultValue={formatEuroInput(category.monthlyBudgetCents)} /></label>
                    <label>Farbe<input name="color" type="color" defaultValue={category.color} /></label>
                    <CategoryIconPicker defaultValue={category.icon} /><input type="hidden" name="forecastExclusionPresent" value="1" /><label className="checkbox-field"><input type="checkbox" name="excludeFromForecast" defaultChecked={category.excludeFromForecast} />Aus Prognose ausschließen (z. B. Auslagen)</label>
                    <input type="hidden" name="scope" value="PRIVATE" />
                    <button className="button secondary autosave-submit" type="submit">Speichern</button>
                  </AutosaveForm>
                </FinanceSetupEdit>
                <form action={deleteCategory}>
                  <input type="hidden" name="id" value={category.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <ConfirmSubmitButton className="icon-button finance-setup-icon danger-subtle" title="Kategorie löschen?" message="Die Kategorie wird nur gelöscht, wenn sie nicht mehr verwendet wird."><Trash2 size={18} aria-hidden="true" /><span className="sr-only">Kategorie löschen</span></ConfirmSubmitButton>
                </form>
              </div>
            </div>
          ))}
        </div>
      </details>

      <details className="setup-card" id="labels-verwalten">
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
                <FinanceSetupEdit title={`${label.name} bearbeiten`}>
                  <AutosaveForm action={updateExpenseLabel} className="form compact label-inline-form" statusKey={`expense-label-${label.id}`}>
                    <input type="hidden" name="id" value={label.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <label>Name<input name="name" defaultValue={label.name} required /></label>
                    <label>Budget in EUR<input name="budget" inputMode="decimal" defaultValue={formatEuroInput(label.budgetCents)} /></label>
                    <label>Farbe<input name="color" type="color" defaultValue={label.color} /></label>
                    <button className="button secondary autosave-submit" type="submit">Speichern</button>
                  </AutosaveForm>
                </FinanceSetupEdit>
                <form action={label.archivedAt ? unarchiveExpenseLabel : archiveExpenseLabel}>
                  <input type="hidden" name="id" value={label.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <button className="icon-button finance-setup-icon" type="submit" aria-label={label.archivedAt ? "Wieder aktivieren" : "Archivieren"} title={label.archivedAt ? "Wieder aktivieren" : "Archivieren"}>{label.archivedAt ? <ArchiveRestore size={18} /> : <Archive size={18} />}</button>
                </form>
                <form action={deleteExpenseLabel}>
                  <input type="hidden" name="id" value={label.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <ConfirmSubmitButton className="icon-button finance-setup-icon danger-subtle" title="Label löschen?" message="Das Label wird nur gelöscht, wenn es nicht mehr verwendet wird."><Trash2 size={18} aria-hidden="true" /><span className="sr-only">Label löschen</span></ConfirmSubmitButton>
                </form>
              </div>
            </div>
          ))}
        </div>
      </details>

      <details className="setup-card" id="daten-zusammenfuehren">
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

      {includeSeries ? <RecurringTransactionsPanel recurringTransactions={recurringTransactions} categories={categories} labels={labels} /> : null}
    </div>
  );
}

export function RecurringTransactionsPanel({ recurringTransactions, categories, labels }: { recurringTransactions: RecurringTransactionLike[]; categories: CategoryLike[]; labels: LabelLike[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const categoryOptions = categories.map((category) => ({ id: category.id, name: category.name, color: category.color, icon: category.icon }));
  const labelOptions = labels.map((label) => ({ id: label.id, name: label.name, color: label.color }));
  return (
    <div className="recurring-layout finance-series-menu" id="serien-verwalten">
      <details className="setup-card setup-card-primary finance-series-create">
        <summary><span className="finance-series-create-icon"><Plus size={19} aria-hidden="true" /></span><span>Neue Serie</span><ChevronDown className="finance-series-create-chevron" size={17} aria-hidden="true" /></summary>
        <form action={createRecurringTransaction} className="form form-grid compact">
          <label>Titel<input name="title" placeholder="Gehalt, Miete, Sparrate ..." required /></label>
          <label>Art<select name="kind" defaultValue="EXPENSE"><option value="EXPENSE">Ausgabe</option><option value="INCOME">Einnahme</option></select></label>
          <label>Betrag in EUR<input name="amount" inputMode="decimal" placeholder="42,50" required /></label>
          <label>Intervall<select name="billingInterval" defaultValue="MONTHLY"><option value="MONTHLY">Monatlich</option><option value="QUARTERLY">Quartalsweise</option><option value="YEARLY">Jährlich</option></select></label>
          <label>Startdatum<input name="startDate" type="date" defaultValue={today} required /></label>
          <label>Enddatum optional<input name="endDate" type="date" /></label>
          <PaymentMethodField />
          <label>Geschäft / Anbieter<input name="store" placeholder="Arbeitgeber, Vermieter, Bank ..." /></label>
          <SearchableSelect name="categoryId" label="Kategorie" options={categoryOptions} emptyLabel="Keine Kategorie" placeholder="Kategorie suchen oder auswählen" quickAddLabel="+ Neue Kategorie hinzufügen" quickAddAction={quickCreateExpenseCategory} />
          <SearchableSelect name="labelId" label="Label / Projekt" options={labelOptions} emptyLabel="Kein Label" placeholder="Label suchen oder auswählen" quickAddLabel="+ Neues Label hinzufügen" quickAddAction={quickCreateExpenseLabel} />
          <input type="hidden" name="status" value="ACTIVE" />
          <label className="full-span">Beschreibung<input name="description" placeholder="Optionaler Hinweis für erzeugte Buchungen" /></label>
          <button className="button secondary full-span" type="submit">Serie speichern</button>
        </form>
      </details>

      <section className="setup-card">
        <div className="finance-series-heading"><h2 className="section-title">Meine Serien</h2><span>{recurringTransactions.length}</span></div>
        <div className="category-editor-list">
          {recurringTransactions.length === 0 ? <EmptyState>Noch keine Serien vorhanden.</EmptyState> : null}
          {recurringTransactions.map((series) => {
            const currentPhase = series.pricePhases.at(-1);
            return (
              <div className="category-editor finance-series-row" key={series.id}>
                <div className="finance-series-summary">
                  <span className="category-icon-swatch" style={{ background: series.category?.color ?? "#6b6f76" }}><CategoryIcon icon={series.category?.icon} size={18} /></span>
                  <span className="finance-series-copy"><strong>{series.title}</strong><small>{series.status === "ACTIVE" ? (currentPhase ? recurringIntervalLabels[currentPhase.billingInterval] : "Aktiv") : "Pausiert"} · {series.kind === "INCOME" ? "Einnahme" : "Ausgabe"}</small></span>
                  <span className="finance-series-amount">{currentPhase ? formatMoney(currentPhase.amountCents, currentPhase.currency) : "–"}</span>
                </div><div className="finance-series-actions"><FinanceSetupEdit title={`${series.title} bearbeiten`}><AutosaveForm action={updateRecurringTransaction} className="form form-grid compact" statusKey={`recurring-transaction-${series.id}`}>
                  <input type="hidden" name="id" value={series.id} />
                  <label>Titel<input name="title" defaultValue={series.title} required /></label>
                  <label>Art<select name="kind" defaultValue={series.kind}><option value="EXPENSE">Ausgabe</option><option value="INCOME">Einnahme</option></select></label>
                  <label>Betrag in EUR<input name="amount" inputMode="decimal" defaultValue={formatEuroInput(currentPhase?.amountCents ?? 0)} required /></label>
                  <details className="full-span finance-series-options"><summary>Preis und Laufzeit</summary><div className="form-grid">
                  <label>Gültig ab<input name="priceValidFrom" type="date" defaultValue={toDateInputValue(currentPhase?.validFrom ?? series.startDate)} required /></label>
                  <label>Preisänderung<select name="priceChangeMode" defaultValue="NEW_PHASE"><option value="NEW_PHASE">Neue Preisphase ab Gültig-ab</option><option value="CORRECT_CURRENT">Aktuelle Phase korrigieren</option></select></label>
                  <label>Intervall<select name="billingInterval" defaultValue={currentPhase?.billingInterval ?? "MONTHLY"}><option value="MONTHLY">Monatlich</option><option value="QUARTERLY">Quartalsweise</option><option value="YEARLY">Jährlich</option></select></label>
                  <label>Startdatum<input name="startDate" type="date" defaultValue={toDateInputValue(series.startDate)} required /></label>
                  <label>Enddatum optional<input name="endDate" type="date" defaultValue={toDateInputValue(series.endDate)} /></label>
                  <label>Status<select name="status" defaultValue={series.status}><option value="ACTIVE">Aktiv</option><option value="PAUSED">Pausiert</option></select></label>
                  </div></details>
                  <details className="full-span finance-series-options"><summary>Zuordnung und weitere Angaben</summary><div className="form-grid">
                  <PaymentMethodField defaultValue={series.paymentMethod} />
                  <label>Geschäft / Anbieter<input name="store" defaultValue={series.store} /></label>
                  <SearchableSelect name="categoryId" label="Kategorie" options={categoryOptions} defaultValue={series.categoryId} emptyLabel="Keine Kategorie" placeholder="Kategorie suchen oder auswählen" quickAddLabel="+ Neue Kategorie hinzufügen" quickAddAction={quickCreateExpenseCategory} />
                  <SearchableSelect name="labelId" label="Label / Projekt" options={labelOptions} defaultValue={series.labelId} emptyLabel="Kein Label" placeholder="Label suchen oder auswählen" quickAddLabel="+ Neues Label hinzufügen" quickAddAction={quickCreateExpenseLabel} />
                  <label className="checkbox-field full-span"><input name="updateGeneratedExpenses" type="checkbox" /> Bereits erzeugte Auto-Buchungen ab Gültig-ab aktualisieren</label>
                  <label className="full-span">Beschreibung<input name="description" defaultValue={series.description} /></label>
                  </div></details>
                  <details className="full-span finance-series-options"><summary>Preisentwicklung</summary><div className="price-history">
                    {series.pricePhases.map((phase) => (
                      <span className="badge" key={phase.id}>
                        {formatMoney(phase.amountCents, phase.currency)} · {recurringIntervalLabels[phase.billingInterval]} · ab {formatDate(phase.validFrom)}{phase.validTo ? ` bis ${formatDate(phase.validTo)}` : ""}
                      </span>
                    ))}
                  </div></details>
                  <button className="button secondary full-span autosave-submit" type="submit">Speichern</button>
                </AutosaveForm></FinanceSetupEdit><div className="category-editor-actions">
                  {series.status === "ACTIVE" && <form action={pauseRecurringTransaction}>
                    <input type="hidden" name="id" value={series.id} />
                    <button className="icon-button finance-setup-icon" type="submit" aria-label="Serie pausieren" title="Serie pausieren"><Pause size={18} /></button>
                  </form>}
                  <form action={softDeleteRecurringTransaction}>
                    <input type="hidden" name="id" value={series.id} />
                    <ConfirmSubmitButton className="icon-button finance-setup-icon danger-subtle" title="Serie entfernen?" message="Die Serie wird beendet und erzeugt keine neuen Buchungen mehr."><Trash2 size={18} aria-hidden="true" /><span className="sr-only">Serie entfernen</span></ConfirmSubmitButton>
                  </form>
                </div></div></div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function ExpenseExcelSetupPanel({ exportYear, returnTo = "/ausgaben/setup/sicherung" }: { exportYear: number; returnTo?: string }) {
  return (
    <section className="setup-card setup-card-primary" id="excel-sicherung">
      <div className="setup-card-head">
        <div>
          <h2 className="section-title">Excel-Sicherung</h2>
        </div>
      </div>
      <ExcelProgressPanel>
        <div className="excel-actions">
          <a className="button secondary" href={`/api/expenses/export?year=${exportYear}`} data-excel-progress={`Excel ${exportYear} wird vorbereitet ...`}>Excel {exportYear} herunterladen</a>
          <form action={importExpensesFromUploadedXlsx} className="upload-form">
            <input type="hidden" name="returnTo" value={returnTo} />
            <input name="xlsxFile" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
            <button className="button secondary" type="submit" data-excel-progress="Excel-Datei wird importiert ...">Excel hochladen</button>
          </form>
          <div className="setup-action-row">
            <form action={importExpensesFromSynologyExcel}>
              <input type="hidden" name="returnTo" value={returnTo} />
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
  );
}

export function ExpenseCreateSetupPanel({ returnTo = "/ausgaben/setup/anlegen" }: { returnTo?: string }) {
  return (
    <section className="setup-card setup-card-primary" id="finanz-anlegen">
      <div className="setup-card-head">
        <div>
          <h2 className="section-title">Neue Struktur anlegen</h2>
        </div>
      </div>
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
          <CategoryIconPicker /><label className="checkbox-field"><input type="checkbox" name="excludeFromForecast" />Aus Prognose ausschließen (z. B. Auslagen)</label>
          <button className="button secondary" type="submit">Kategorie speichern</button>
        </form>
      </div>
    </section>
  );
}

export function ExpenseCategorySetupPanel({ categories, returnTo = "/ausgaben/setup/kategorien" }: { categories: CategoryLike[]; returnTo?: string }) {
  return (
    <section className="setup-card" id="kategorien-bearbeiten">
      <div className="setup-card-head">
        <div>
          <h2 className="section-title">Kategorien bearbeiten</h2>
        </div>
      </div>
      <div className="category-editor-list">
        {categories.map((category) => (
          <div className="label-management-row category-management-row" key={category.id}>
            <div>
              <strong><span className="category-icon-swatch" style={{ background: category.color }}><CategoryIcon icon={category.icon} size={16} /></span>{category.name}</strong>
              <span className="muted">Monatsbudget: {formatMoney(category.monthlyBudgetCents)}{category.excludeFromForecast ? " · Ohne Prognose" : ""}</span>
            </div>
            <div className="label-management-actions">
              <FinanceSetupEdit title={`${category.name} bearbeiten`}>
                <AutosaveForm action={updateCategory} className="form compact label-inline-form" statusKey={`expense-category-${category.id}`}>
                  <input type="hidden" name="id" value={category.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <label>Name<input name="name" defaultValue={category.name} required /></label>
                  <label>Monatsbudget in EUR<input name="monthlyBudget" inputMode="decimal" defaultValue={formatEuroInput(category.monthlyBudgetCents)} /></label>
                  <label>Farbe<input name="color" type="color" defaultValue={category.color} /></label>
                  <CategoryIconPicker defaultValue={category.icon} /><input type="hidden" name="forecastExclusionPresent" value="1" /><label className="checkbox-field"><input type="checkbox" name="excludeFromForecast" defaultChecked={category.excludeFromForecast} />Aus Prognose ausschließen (z. B. Auslagen)</label>
                  <input type="hidden" name="scope" value="PRIVATE" />
                  <button className="button secondary autosave-submit" type="submit">Speichern</button>
                </AutosaveForm>
              </FinanceSetupEdit>
              <form action={deleteCategory}>
                <input type="hidden" name="id" value={category.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <ConfirmSubmitButton className="icon-button finance-setup-icon danger-subtle" title="Kategorie löschen?" message="Die Kategorie wird nur gelöscht, wenn sie nicht mehr verwendet wird."><Trash2 size={18} aria-hidden="true" /><span className="sr-only">Kategorie löschen</span></ConfirmSubmitButton>
              </form>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ExpenseLabelSetupPanel({ allLabels, returnTo = "/ausgaben/setup/labels" }: { allLabels: LabelLike[]; returnTo?: string }) {
  return (
    <section className="setup-card" id="labels-verwalten">
      <div className="setup-card-head">
        <div>
          <h2 className="section-title">Labels verwalten</h2>
        </div>
      </div>
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
              <FinanceSetupEdit title={`${label.name} bearbeiten`}>
                <AutosaveForm action={updateExpenseLabel} className="form compact label-inline-form" statusKey={`expense-label-${label.id}`}>
                  <input type="hidden" name="id" value={label.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <label>Name<input name="name" defaultValue={label.name} required /></label>
                  <label>Budget in EUR<input name="budget" inputMode="decimal" defaultValue={formatEuroInput(label.budgetCents)} /></label>
                  <label>Farbe<input name="color" type="color" defaultValue={label.color} /></label>
                  <button className="button secondary autosave-submit" type="submit">Speichern</button>
                </AutosaveForm>
              </FinanceSetupEdit>
              <form action={label.archivedAt ? unarchiveExpenseLabel : archiveExpenseLabel}>
                <input type="hidden" name="id" value={label.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <button className="icon-button finance-setup-icon" type="submit" aria-label={label.archivedAt ? "Wieder aktivieren" : "Archivieren"} title={label.archivedAt ? "Wieder aktivieren" : "Archivieren"}>{label.archivedAt ? <ArchiveRestore size={18} /> : <Archive size={18} />}</button>
              </form>
              <form action={deleteExpenseLabel}>
                <input type="hidden" name="id" value={label.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <ConfirmSubmitButton className="icon-button finance-setup-icon danger-subtle" title="Label löschen?" message="Das Label wird nur gelöscht, wenn es nicht mehr verwendet wird."><Trash2 size={18} aria-hidden="true" /><span className="sr-only">Label löschen</span></ConfirmSubmitButton>
              </form>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ExpenseMergeSetupPanel({ categories, allLabels, returnTo = "/ausgaben/setup/zusammenfuehren" }: { categories: CategoryLike[]; allLabels: LabelLike[]; returnTo?: string }) {
  return (
    <section className="setup-card" id="daten-zusammenfuehren">
      <div className="setup-card-head">
        <div>
          <h2 className="section-title">Zusammenführen</h2>
        </div>
      </div>
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
    </section>
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
