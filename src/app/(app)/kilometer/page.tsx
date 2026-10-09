import {
  archiveCar,
  createCar,
  deleteFuelEntry,
  exportFuelToSynologyExcel,
  importFuelFromSynologyExcel,
  importFuelFromUploadedXlsx,
  unarchiveCar,
  updateCar,
  updateFuelExpenseSettings
} from "@/lib/actions";
import Link from "next/link";
import { CalendarCheck, Droplets, Fuel, Pencil, Route, Trash2 } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";
import {
  addFuelDerivedFields,
  calculateFuelStatsFromDerived,
  compareFuelMetric,
  formatDecimal,
  formatEuroInputFromCents,
  formatKilometers,
  formatLiters,
  formatLitersInput
} from "@/lib/mileage";
import { buildMonthSelectOptions, formatMonthKeyLabel, splitMonthKey } from "@/lib/month-options";
import { isFamilyAdmin } from "@/lib/permissions";
import { getDocumentsForLinkedEntities, getExpenseLabels, getFuelEntriesForCar, getFuelExpenseSettings, getVisibleCars, getVisibleCategories, getVisibleDocumentRoots } from "@/lib/queries";
import { ActionModal } from "@/components/action-modal";
import { AutosaveForm } from "@/components/autosave-form";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { ExcelProgressPanel } from "@/components/excel-progress-panel";
import { MileageToolbar } from "@/components/mileage-toolbar";
import { MileageCarPicker } from "@/components/mileage-car-picker";
import { PeriodNavLink } from "@/components/period-nav-link";
import { SearchableSelect } from "@/components/searchable-select";
import { FuelEntryEditForm } from "@/components/fuel-entry-edit-form";
import { EmptyState, PageHeader } from "@/components/ui";
import { DesktopDetail, DesktopFacts, DesktopWorkspace, desktopSelectedRecord } from "@/components/desktop-workspace";

type MileagePageParams = {
  selected?: string | null;
  car?: string | null;
  month?: string | null;
  year?: string | null;
  from?: string | null;
  to?: string | null;
  q?: string | null;
  view?: string | null;
};

type MileagePageProps = {
  searchParams: Promise<MileagePageParams>;
};

export default async function MileagePage({ searchParams }: MileagePageProps) {
  const session = await requireSession();
  const params = cleanMileageParams(await searchParams);
  const isAdmin = isFamilyAdmin(session.role);
  const [activeCars, allCars, categories, labels, fuelExpenseSettings, documentRoots] = await Promise.all([
    getVisibleCars(session.family.id),
    getVisibleCars(session.family.id, { includeArchived: true }),
    getVisibleCategories(session.family.id, session.user.id, "EXPENSE"),
    getExpenseLabels(session.family.id, session.user.id),
    getFuelExpenseSettings(session.family.id, session.user.id),
    getVisibleDocumentRoots(session.family.id, session.user.id, session.role)
  ]);
  const selectedCar = activeCars.find((car) => car.id === params.car)
    ?? activeCars.find((car) => car.id === session.user.lastSelectedCarId)
    ?? activeCars[0]
    ?? null;
  const entries = selectedCar ? await getFuelEntriesForCar(session.family.id, selectedCar.id) : [];
  const derivedEntries = addFuelDerivedFields(entries);
  const fuelExpenseIds = entries.flatMap((entry) => entry.expense?.generatedByFuelEntry ? [entry.expense.id] : []);
  const fuelDocuments = await getDocumentsForLinkedEntities(session.family.id, session.user.id, "EXPENSE", fuelExpenseIds);
  const fuelDocumentsByExpenseId = new Map(fuelDocuments.map((document) => [document.linkedEntityId ?? "", document]));
  const fuelExpensesByEntryId = new Map(entries.flatMap((entry) => entry.expense ? [[entry.id, entry.expense] as const] : []));
  const query = normalizeSearch(params.q);
  const currentMonthKey = getMonthKey();
  const years = [...new Set([new Date().getFullYear(), ...entries.map((entry) => new Date(entry.date).getFullYear())])].sort((a, b) => b - a);
  const range = getRange(params, currentMonthKey);
  const selectedMonth = range.mode === "month" ? splitMonthKey(range.key) : null;
  const currentMonth = splitMonthKey(currentMonthKey);
  const monthOptions = buildMonthSelectOptions();
  const filterYear = String(selectedMonth?.year ?? params.year ?? currentMonth?.year ?? years[0] ?? new Date().getFullYear());
  const selectedEntries = derivedEntries
    .filter((entry) => isInRange(entry.date, range.from, range.to))
    .filter((entry) => !query || normalizeSearch(entry.note).includes(query) || String(entry.odometerKm).includes(query));
  const view = getMileageView(params.view);
  const stats = calculateFuelStatsFromDerived(selectedEntries);
  const allTimeStats = view === "overview" ? calculateFuelStatsFromDerived(derivedEntries) : null;
  const monthlyRows = buildMonthlyRows(selectedEntries);
  const recentEntries = selectedEntries.slice(0, 6);
  const returnTo = getMileageHref(params, {});
  const activeFilterChips = buildMileageActiveFilterChips(params, range);

  const comparison = buildMileageComparison(derivedEntries, range, query);
  const desktopSelectedFuel = desktopSelectedRecord(selectedEntries, params.selected ?? undefined);
  const desktopMileageWorkspace = selectedCar && (view === "overview" || view === "entries") ? <DesktopWorkspace
    className="desktop-mileage-workspace"
    ariaLabel="Tankstopps und Details"
    title="Tankstopps"
    description={`${selectedCar.name} · ${formatDate(range.from)} bis ${formatDate(range.to)}`}
    rows={selectedEntries.map((entry) => ({ id: entry.id, title: `${formatDate(entry.date)} · ${formatKilometers(entry.odometerKm)} km`, subtitle: `${formatLiters(entry.litersMilli)} l · ${formatDecimal(entry.litersPer100Km)} l/100 km`, meta: formatMoney(entry.costCents) }))}
    selectedId={desktopSelectedFuel?.id}
    pathname="/kilometer"
    params={params}
    detail={desktopSelectedFuel ? <DesktopDetail title={selectedCar.name} eyebrow="Tankstopp" actions={<>
      <FuelEntryEditModal entry={desktopSelectedFuel} expense={fuelExpensesByEntryId.get(desktopSelectedFuel.id)} linkedDocument={fuelDocumentsByExpenseId.get(fuelExpensesByEntryId.get(desktopSelectedFuel.id)?.id ?? "")} selectedCarId={selectedCar.id} selectedCarName={selectedCar.name} returnTo={returnTo} categories={categories} labels={labels} documentRoots={documentRoots} settings={fuelExpenseSettings} desktop />
      <FuelEntryDeleteButton entryId={desktopSelectedFuel.id} selectedCarId={selectedCar.id} returnTo={returnTo} />
    </>}>
      <strong>{formatMoney(desktopSelectedFuel.costCents)}</strong>
      <DesktopFacts items={[
        { label: "Datum", value: formatDate(desktopSelectedFuel.date) },
        { label: "Kilometerstand", value: `${formatKilometers(desktopSelectedFuel.odometerKm)} km` },
        { label: "Getankt", value: `${formatLiters(desktopSelectedFuel.litersMilli)} l` },
        { label: "Verbrauch", value: `${formatDecimal(desktopSelectedFuel.litersPer100Km)} l/100 km` },
        { label: "Gefahren", value: desktopSelectedFuel.drivenKm === null ? "–" : `${formatKilometers(desktopSelectedFuel.drivenKm)} km` },
        { label: "Preis pro Liter", value: `${formatMoney(Math.round(desktopSelectedFuel.pricePerLiterCents ?? 0))}/l` }
      ]} />
      {desktopSelectedFuel.note && <p className="desktop-detail-note">{desktopSelectedFuel.note}</p>}
    </DesktopDetail> : null}
  /> : null;
  return (
    <>
      <div className="task-page-head finance-page-head mileage-page-head">
        <PageHeader title="Auto" />
        <MileageToolbar
          params={params}
          selectedMonth={selectedMonth}
          filterYear={filterYear}
          years={years}
          monthOptions={monthOptions}
          resultCount={selectedEntries.length}
          activeFilterCount={activeFilterChips.length}
        />
      </div>

      <nav className="finance-primary-tabs mileage-primary-tabs" aria-label="Auto-Bereich">
        <Link className={view === "overview" ? "active" : ""} href={getMileageHref(params, { view: "overview" })} scroll={false}>Übersicht</Link>
        <Link className={view === "entries" ? "active" : ""} href={getMileageHref(params, { view: "entries" })} scroll={false}>Tankstopps</Link>
        <Link className={view === "analysis" ? "active" : ""} href={getMileageHref(params, { view: "analysis" })} scroll={false}>Analyse</Link>
      </nav>

      <section className="filter-system" aria-label="Kilometerfilter">
        {selectedCar ? (
          <>
            <div className="period-navigator mileage-navigator">
              <MileagePeriodNavigator params={params} range={range} currentMonthKey={currentMonthKey} />
            </div>
            <div className="overview-actions secondary-filter-actions mileage-secondary-actions">
              <CarPicker cars={activeCars} selectedCarId={selectedCar.id} params={params} />
              <ActionModal title="Kilometer-Setup" trigger="Setup" modalId="kilometer-setup" triggerClassName="button secondary mileage-setup-action" panelClassName="mileage-setup-sheet" wide>
                <MileageSetupPanel
                  selectedCar={selectedCar}
                  activeCars={activeCars}
                  allCars={allCars}
                  categories={categories}
                  labels={labels}
                  fuelExpenseSettings={fuelExpenseSettings}
                  isAdmin={isAdmin}
                />
              </ActionModal>
            </div>
            {activeFilterChips.length > 0 ? (
              <div className="active-filter-row" aria-label="Aktive Filter">
                {activeFilterChips.map((chip) => (
                  <a className="filter-chip" href={getMileageHref(params, chip.clear)} key={chip.label}>
                    <span>{chip.label}</span>
                    <strong aria-hidden="true">×</strong>
                  </a>
                ))}
                <a className="filter-chip clear-all" href={getMileageHref(params, { q: undefined, from: undefined, to: undefined, month: undefined, year: undefined })}>Alle löschen</a>
              </div>
            ) : null}
          </>
        ) : (
          <div className="overview-actions secondary-filter-actions mileage-secondary-actions">
            <ActionModal title="Kilometer-Setup" trigger="Setup" modalId="kilometer-setup" panelClassName="mileage-setup-sheet" wide>
              <MileageSetupPanel
                selectedCar={selectedCar}
                activeCars={activeCars}
                allCars={allCars}
                categories={categories}
                labels={labels}
                fuelExpenseSettings={fuelExpenseSettings}
                isAdmin={isAdmin}
              />
            </ActionModal>
          </div>
        )}
      </section>

      {!selectedCar ? (
        <EmptyState>Noch kein aktives Auto vorhanden. Admins können im Setup ein Auto anlegen oder eine Verbrauchsdatei importieren.</EmptyState>
      ) : (
        <>
          {view === "overview" ? (
            <section className="finance-overview-page mileage-overview-page spacing-top">
              <MileageSummaryPanel comparison={comparison} stats={stats} />
              {desktopMileageWorkspace}

              <section className="panel finance-overview-snapshot mileage-overview-snapshot">
                <div className="section-head compact-section-head">
                  <div>
                    <h2 className="section-title">Letzte Tankstopps</h2>
                    <p className="muted">{formatDate(range.from)} bis {formatDate(range.to)}</p>
                  </div>
                  <Link className="button secondary" href={getMileageHref(params, { view: "entries" })} scroll={false}>Alle</Link>
                </div>
                <FuelEntryList entries={recentEntries} selectedCarId={selectedCar.id} selectedCarName={selectedCar.name} returnTo={returnTo} categories={categories} labels={labels} documentRoots={documentRoots} settings={fuelExpenseSettings} expensesByEntryId={fuelExpensesByEntryId} documentsByExpenseId={fuelDocumentsByExpenseId} />
              </section>

              {allTimeStats ? <section className="mileage-all-time-section" aria-label="Gesamt seit Beginn">
                <div className="section-head compact-section-head"><h2 className="section-title">Gesamt seit Beginn</h2></div>
                <MileageSummaryPanel comparison={null} stats={allTimeStats} />
              </section> : null}

              <Link className="finance-inline-analysis-link" href={getMileageHref(params, { view: "analysis" })} scroll={false}>Verbrauchsanalyse ansehen <span aria-hidden="true">→</span></Link>
            </section>
          ) : null}

          {view === "entries" ? (
            <section className="panel expense-section mileage-entry-section spacing-top">
              <div className="expense-section-summary">
                <div>
                  <h2 className="section-title">Tankstopps</h2>
                  <p className="muted">{formatDate(range.from)} bis {formatDate(range.to)} · {selectedEntries.length} Einträge</p>
                </div>
              </div>
              <FuelEntryList entries={selectedEntries} selectedCarId={selectedCar.id} selectedCarName={selectedCar.name} returnTo={returnTo} categories={categories} labels={labels} documentRoots={documentRoots} settings={fuelExpenseSettings} expensesByEntryId={fuelExpensesByEntryId} documentsByExpenseId={fuelDocumentsByExpenseId} />
            </section>
          ) : null}

          {view === "entries" ? desktopMileageWorkspace : null}

          {view === "analysis" ? (
            <section className="panel finance-category-page mileage-analysis-page spacing-top">
              <div className="section-head compact-section-head">
                <div>
                  <h2 className="section-title">Analyse</h2>
                  <p className="muted">Monatswerte für Verbrauch, Kilometer und Kosten.</p>
                </div>
              </div>
              <MileageSummaryPanel comparison={comparison} stats={stats} compact />
              {monthlyRows.length === 0 ? <EmptyState>Noch keine Daten vorhanden.</EmptyState> : (
                <div className="mileage-analysis-scroll" role="region" aria-label="Autoanalyse, seitlich scrollbar" tabIndex={0}>
                <div className="mini-table mileage-analysis-table">
                  <div className="mini-table-head"><span>Monat</span><span>km</span><span>Liter</span><span>€</span><span>Ø</span></div>
                  {monthlyRows.map((row) => (
                    <div className="mini-table-row mileage-analysis-row" key={row.label}>
                      <span data-label="Monat">{row.label}</span>
                      <span data-label="km"><b>{formatKilometers(row.drivenKm)}</b></span>
                      <span data-label="Liter"><b>{formatLiters(row.litersMilli)} l</b></span>
                      <span data-label="Kosten"><b>{formatMoney(row.costCents)}</b></span>
                      <strong data-label="Ø">{formatDecimal(row.averageLitersPer100Km)} l</strong>
                    </div>
                  ))}
                </div>
                </div>
              )}
            </section>
          ) : null}
        </>
      )}
    </>
  );
}

function MileageSummaryPanel({
  comparison,
  stats,
  compact = false
}: {
  comparison: ReturnType<typeof buildMileageComparison> | null;
  stats: ReturnType<typeof calculateFuelStatsFromDerived>;
  compact?: boolean;
}) {
  return (
    <section className={compact ? "finance-summary-panel mileage-summary-panel compact" : "finance-summary-panel mileage-summary-panel"} aria-label={comparison ? "Autoüberblick" : "Gesamtwerte des Autos"}>
      <div className={`finance-summary-metric mileage-metric ${comparison?.cost.tone ?? "tone-neutral"}`}>
        <div className="finance-summary-card-head"><span>Tankkosten</span><i aria-hidden="true"><Fuel size={17} /></i></div>
        <strong>{formatMoney(stats.totalCostCents)}</strong>
        <small>{comparison?.cost.label ?? "Alle Tankstopps"}</small>
        {comparison?.cost.sparkWidth ? <div className="finance-summary-spark" aria-hidden="true"><b style={{ width: comparison.cost.sparkWidth }} /></div> : null}
      </div>
      <div className={`finance-summary-metric mileage-metric ${comparison?.liters.tone ?? "tone-neutral"}`}>
        <div className="finance-summary-card-head"><span>Liter</span><i aria-hidden="true"><Droplets size={17} /></i></div>
        <strong>{formatLiters(stats.totalLitersMilli)} l</strong>
        <small>{comparison?.liters.label ?? "Alle Tankstopps"}</small>
        {comparison?.liters.sparkWidth ? <div className="finance-summary-spark" aria-hidden="true"><b style={{ width: comparison.liters.sparkWidth }} /></div> : null}
      </div>
      <div className={`finance-summary-metric mileage-metric ${comparison?.distance.tone ?? "tone-neutral"}`}>
        <div className="finance-summary-card-head"><span>Gefahren</span><i aria-hidden="true"><Route size={17} /></i></div>
        <strong>{formatKilometers(stats.drivenKm)} km</strong>
        <small>{comparison?.distance.label ?? "Erfasste Strecken"}</small>
        {comparison?.distance.sparkWidth ? <div className="finance-summary-spark" aria-hidden="true"><b style={{ width: comparison.distance.sparkWidth }} /></div> : null}
      </div>
      <div className={`finance-summary-metric mileage-consumption-metric ${comparison?.consumption.tone ?? "tone-neutral"}`}>
        <div className="finance-summary-card-head"><span>Ø l/100 km</span></div>
        <strong>{formatDecimal(stats.averageLitersPer100Km)} l</strong>
        <small>{comparison?.consumption.label ?? "Nur mit messbarer Strecke"}</small>
        {comparison?.consumption.sparkWidth ? <div className="finance-summary-spark" aria-hidden="true"><b style={{ width: comparison.consumption.sparkWidth }} /></div> : null}
      </div>
    </section>
  );
}

function FuelEntryList({
  entries,
  selectedCarId,
  selectedCarName,
  returnTo,
  categories,
  labels,
  documentRoots,
  settings,
  expensesByEntryId,
  documentsByExpenseId
}: {
  entries: ReturnType<typeof addFuelDerivedFields>;
  selectedCarId: string;
  selectedCarName: string;
  returnTo: string;
  categories: Awaited<ReturnType<typeof getVisibleCategories>>;
  labels: Awaited<ReturnType<typeof getExpenseLabels>>;
  documentRoots: { id: string; name: string }[];
  settings: Awaited<ReturnType<typeof getFuelExpenseSettings>>;
  expensesByEntryId: Map<string, NonNullable<Awaited<ReturnType<typeof getFuelEntriesForCar>>[number]["expense"]>>;
  documentsByExpenseId: Map<string, Awaited<ReturnType<typeof getDocumentsForLinkedEntities>>[number]>;
}) {
  if (entries.length === 0) return <EmptyState>Noch keine Tankstopps im gewählten Zeitraum.</EmptyState>;

  return (
    <div className="expense-list mileage-entry-list">
      {entries.map((entry) => (
        <article className="expense-row mileage-row" key={entry.id}>
          <ActionModal title="Tankstoppdetails" trigger={<span className="mileage-row-content">
            <div className="mileage-row-head">
              <span className="mileage-date">{formatDate(entry.date)}</span>
              <span className="mileage-main">
                <span className="mileage-odometer">{formatKilometers(entry.odometerKm)} km</span>
                <small>{entry.note || "Ohne Bemerkung"}</small>
              </span>
            </div>
            <span className="mileage-values" aria-label="Tankdaten">
              <span className="mileage-value"><small>Liter</small><b>{formatLiters(entry.litersMilli)} l</b></span>
              <span className="mileage-value"><small>Verbrauch</small><b>{formatDecimal(entry.litersPer100Km)} l/100 km</b></span>
              <span className="mileage-value"><small>Gefahren</small><b>{entry.drivenKm === null ? "-" : `${formatKilometers(entry.drivenKm)} km`}</b></span>
              <span className="mileage-value"><small>Preis</small><b>{formatMoney(Math.round(entry.pricePerLiterCents ?? 0))}/l</b></span>
            </span>
            <strong className="mileage-cost">{formatMoney(entry.costCents)}</strong>
          </span>} triggerLabel="Tankstoppdetails öffnen" triggerClassName="mileage-row-detail-trigger" modalId={`fuel-entry-${entry.id}-details`} headerActions={<>
            <FuelEntryEditModal entry={entry} expense={expensesByEntryId.get(entry.id)} linkedDocument={documentsByExpenseId.get(expensesByEntryId.get(entry.id)?.id ?? "")} selectedCarId={selectedCarId} selectedCarName={selectedCarName} returnTo={returnTo} categories={categories} labels={labels} documentRoots={documentRoots} settings={settings} />
            <FuelEntryDeleteButton entryId={entry.id} selectedCarId={selectedCarId} returnTo={returnTo} />
          </>}>
              <div className="mileage-detail-sheet">
                <div className="mileage-detail-hero">
                  <span className="mileage-detail-icon" aria-hidden="true"><Fuel size={24} /></span>
                  <div>
                    <h3>{selectedCarName}</h3>
                    <time dateTime={toDateInputValue(entry.date)}>{formatDate(entry.date)}</time>
                  </div>
                  <strong className="mileage-detail-total"><small>Kosten</small>{formatMoney(entry.costCents)}</strong>
                </div>
                <div className="mileage-detail-grid">
                  <span><small>Kilometerstand</small><b>{formatKilometers(entry.odometerKm)} km</b></span>
                  <span><small>Liter</small><b>{formatLiters(entry.litersMilli)} l</b></span>
                  <span><small>Preis pro Liter</small><b>{formatMoney(Math.round(entry.pricePerLiterCents ?? 0))}/l</b></span>
                  <span><small>Verbrauch</small><b>{formatDecimal(entry.litersPer100Km)} l/100 km</b></span>
                  <span><small>Gefahren</small><b>{entry.drivenKm === null ? "–" : `${formatKilometers(entry.drivenKm)} km`}</b></span>
                </div>
                {entry.note ? <div className="task-detail-note"><span>Bemerkung</span><p>{entry.note}</p></div> : null}
              </div>
          </ActionModal>
        </article>
      ))}
    </div>
  );
}

function FuelEntryEditModal({ entry, expense, linkedDocument, selectedCarId, selectedCarName, returnTo, categories, labels, documentRoots, settings, desktop = false }: {
  entry: ReturnType<typeof addFuelDerivedFields>[number];
  expense: NonNullable<Awaited<ReturnType<typeof getFuelEntriesForCar>>[number]["expense"]> | undefined;
  linkedDocument: Awaited<ReturnType<typeof getDocumentsForLinkedEntities>>[number] | undefined;
  selectedCarId: string;
  selectedCarName: string;
  returnTo: string;
  categories: Awaited<ReturnType<typeof getVisibleCategories>>;
  labels: Awaited<ReturnType<typeof getExpenseLabels>>;
  documentRoots: { id: string; name: string }[];
  settings: Awaited<ReturnType<typeof getFuelExpenseSettings>>;
  desktop?: boolean;
}) {
  return <ActionModal title="Tankstopp bearbeiten" trigger={<><Pencil size={17} aria-hidden="true" />{desktop && <span>Bearbeiten</span>}</>} triggerLabel="Tankstopp bearbeiten" triggerClassName={desktop ? "button secondary" : "task-detail-edit-button mileage-row-edit-button"} modalId={`fuel-entry-${desktop ? "desktop-" : ""}${entry.id}`} sheetVariant="create" panelClassName="mileage-edit-sheet" wide>
    <FuelEntryEditForm entry={entry} expense={expense?.generatedByFuelEntry ? expense : undefined} linkedDocument={expense?.generatedByFuelEntry ? linkedDocument : undefined} selectedCarId={selectedCarId} selectedCarName={selectedCarName} returnTo={returnTo} categories={categories} labels={labels} documentRoots={documentRoots} settings={settings} />
  </ActionModal>;
}

function FuelEntryDeleteButton({ entryId, selectedCarId, returnTo }: { entryId: string; selectedCarId: string; returnTo: string }) {
  return <form action={deleteFuelEntry}><input type="hidden" name="id" value={entryId} /><input type="hidden" name="carId" value={selectedCarId} /><input type="hidden" name="returnTo" value={returnTo} /><ConfirmSubmitButton className="task-detail-edit-button danger-icon-button" title="Tankstopp löschen?" message="Der Tankstopp wird dauerhaft entfernt. Eine verknüpfte Ausgabe bleibt davon unberührt."><Trash2 size={18} aria-hidden="true" /><span className="sr-only">Tankstopp löschen</span></ConfirmSubmitButton></form>;
}

function MileagePeriodNavigator({
  params,
  range,
  currentMonthKey
}: {
  params: MileagePageParams;
  range: ReturnType<typeof getRange>;
  currentMonthKey: string;
}) {
  const currentYear = range.mode === "year" ? range.from.getFullYear() : Number((range.mode === "month" ? range.key : currentMonthKey).slice(0, 4));
  const monthKey = range.mode === "month" ? range.key : `${currentYear}-${currentMonthKey.slice(5)}`;
  const isYear = range.mode === "year";
  const previousHref = isYear ? buildMileageYearNavigationHref(params, currentYear, -1) : buildMileageMonthNavigationHref(params, monthKey, -1);
  const nextHref = isYear ? buildMileageYearNavigationHref(params, currentYear, 1) : buildMileageMonthNavigationHref(params, monthKey, 1);
  const title = isYear ? String(currentYear) : range.mode === "custom" ? "Freier Zeitraum" : formatMonthKeyLabel(monthKey);
  const detail = isYear ? "Jahresansicht" : range.mode === "custom" ? `${formatDate(range.from)} bis ${formatDate(range.to)}` : "Monatsansicht";
  const todayHref = isYear
    ? getMileageHref(params, { year: String(Number(currentMonthKey.slice(0, 4))), month: undefined, from: undefined, to: undefined })
    : getMileageHref(params, { month: currentMonthKey, year: undefined, from: undefined, to: undefined });
  const todayLabel = isYear ? "Aktuelles Jahr anzeigen" : "Aktuellen Monat anzeigen";

  return (
    <div className="period-nav-main">
      <PeriodNavLink className="period-nav-button" href={previousHref} aria-label={isYear ? "Vorheriges Jahr" : "Vorheriger Monat"} title={isYear ? "Vorheriges Jahr" : "Vorheriger Monat"}>
        <span aria-hidden="true">&lsaquo;</span>
      </PeriodNavLink>
      <div className="period-nav-current" aria-live="polite">
        <span>{detail}</span>
        <strong>{title}</strong>
      </div>
      <PeriodNavLink className="period-nav-button" href={nextHref} aria-label={isYear ? "Nächstes Jahr" : "Nächster Monat"} title={isYear ? "Nächstes Jahr" : "Nächster Monat"}>
        <span aria-hidden="true">&rsaquo;</span>
      </PeriodNavLink>
      <PeriodNavLink className="period-nav-button period-current-icon" href={todayHref} aria-label={todayLabel} title={todayLabel}>
        <CalendarCheck size={18} aria-hidden="true" />
      </PeriodNavLink>
      <div className="period-mode-toggle" role="list" aria-label="Zeitraum-Modus">
        <PeriodNavLink role="listitem" className={!isYear && range.mode !== "custom" ? "active" : ""} href={getMileageHref(params, { month: monthKey, year: undefined, from: undefined, to: undefined })}>Monat</PeriodNavLink>
        <PeriodNavLink role="listitem" className={isYear ? "active" : ""} href={getMileageHref(params, { year: String(currentYear), month: undefined, from: undefined, to: undefined })}>Jahr</PeriodNavLink>
      </div>
    </div>
  );
}

function CarPicker({
  cars,
  selectedCarId,
  params
}: {
  cars: Awaited<ReturnType<typeof getVisibleCars>>;
  selectedCarId: string;
  params: MileagePageParams;
}) {
  if (cars.length <= 1) {
    return (
      <span className="button secondary mileage-car-static" aria-label="Ausgewähltes Auto">
        {cars[0]?.name ?? "Kein Auto"}
      </span>
    );
  }

  return (
    <ActionModal title="Auto auswählen" trigger={cars.find((car) => car.id === selectedCarId)?.name ?? "Auto"} triggerLabel="Auto auswählen" modalId="kilometer-auto" triggerClassName="button secondary mileage-car-trigger" panelClassName="mileage-car-sheet" sheetSize="compact">
      <MileageCarPicker selectedCarId={selectedCarId} cars={cars.map((car) => ({
        id: car.id,
        name: car.name,
        color: car.color,
        licensePlate: car.licensePlate,
        href: getMileageHref(params, { car: car.id })
      }))} />
    </ActionModal>
  );
}

function MileageSetupPanel({
  selectedCar,
  activeCars,
  allCars,
  categories,
  labels,
  fuelExpenseSettings,
  isAdmin
}: {
  selectedCar: Awaited<ReturnType<typeof getVisibleCars>>[number] | null;
  activeCars: Awaited<ReturnType<typeof getVisibleCars>>;
  allCars: Awaited<ReturnType<typeof getVisibleCars>>;
  categories: Awaited<ReturnType<typeof getVisibleCategories>>;
  labels: Awaited<ReturnType<typeof getExpenseLabels>>;
  fuelExpenseSettings: Awaited<ReturnType<typeof getFuelExpenseSettings>>;
  isAdmin: boolean;
}) {
  return (
    <div className="expense-setup-layout">
      {selectedCar ? (
        <section className="setup-card setup-card-primary">
          <div className="setup-card-head">
            <div>
              <h2 className="section-title">Excel-Sicherung</h2>
              <p className="muted">Export und Import über die komplette Historie.</p>
            </div>
          </div>
          <ExcelProgressPanel>
            <form action={importFuelFromUploadedXlsx} className="excel-actions">
              <label className="excel-car-picker">
                <span>Auto</span>
                <select name="carId" defaultValue={selectedCar.id}>
                  {activeCars.map((car) => <option value={car.id} key={car.id}>{car.name}</option>)}
                  {isAdmin ? <option value="">Neues Auto aus Dateiname</option> : null}
                </select>
              </label>
              <div className="setup-action-row">
                <div className="mileage-excel-form">
                  <strong>Excel herunterladen</strong>
                  <button className="button secondary" formAction="/api/mileage/export" formMethod="get" formNoValidate type="submit" data-excel-progress="Verbrauchsdatei wird vorbereitet ...">
                    Excel herunterladen
                  </button>
                </div>
                <div className="upload-form">
                  <strong>Excel hochladen</strong>
                  <input name="xlsxFile" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
                  <button className="button secondary" type="submit" data-excel-progress="Verbrauchsdatei wird importiert ...">Excel hochladen</button>
                </div>
                <div className="mileage-excel-form">
                  <strong>Synology importieren</strong>
                  <button className="button secondary" formAction={importFuelFromSynologyExcel} formNoValidate type="submit" data-excel-progress="Synology-Import läuft ...">
                    Synology importieren
                  </button>
                </div>
                <div className="mileage-excel-form">
                  <strong>Synology exportieren</strong>
                  <button className="button secondary" formAction={exportFuelToSynologyExcel} formNoValidate type="submit" data-excel-progress="Synology-Export läuft ...">
                    Synology exportieren
                  </button>
                </div>
              </div>
            </form>
          </ExcelProgressPanel>
        </section>
      ) : null}

      <details className="setup-card" open>
        <summary>
          <span>
            <strong>Ausgabenbuchung</strong>
            <small>Vorgaben für Tankstopps aus dem Plus-Menü</small>
          </span>
        </summary>
        <AutosaveForm action={updateFuelExpenseSettings} className="form form-grid modal-form">
          <label className="checkbox-field full-span">
            <input name="autoCreateExpense" type="checkbox" defaultChecked={fuelExpenseSettings?.autoCreateExpense ?? false} />
            Tankstopps automatisch als Ausgabe vorbereiten
          </label>
          <label><input type="checkbox" name="sharedWithFamily" defaultChecked={fuelExpenseSettings?.sharedWithFamily}/> Neue Tankausgaben mit Familie teilen</label>
            <SearchableSelect name="defaultCategoryId" label="Kategorie" options={categories} defaultValue={fuelExpenseSettings?.defaultCategoryId} emptyLabel="Keine Kategorie" placeholder="Kategorie suchen oder auswählen" />
          <SearchableSelect name="defaultLabelId" label="Label / Projekt" options={labels} defaultValue={fuelExpenseSettings?.defaultLabelId} emptyLabel="Kein Label" placeholder="Label suchen oder auswählen" />
          <label>Bezahlart<input name="defaultPaymentMethod" defaultValue={fuelExpenseSettings?.defaultPaymentMethod ?? ""} placeholder="Optional" /></label>
          <label>Laden<input name="defaultStore" defaultValue={fuelExpenseSettings?.defaultStore ?? ""} placeholder="Optional" /></label>
          <label className="full-span">Beschreibung<input name="defaultDescription" defaultValue={fuelExpenseSettings?.defaultDescription ?? ""} placeholder="Pflicht, wenn automatisch gebucht werden soll" /></label>
          <button className="button secondary full-span autosave-submit" type="submit">Ausgabenbuchung speichern</button>
        </AutosaveForm>
      </details>

      {isAdmin ? (
        <details className="setup-card car-setup-card" open>
          <summary>
            <span>
              <strong>Autos verwalten</strong>
              <small>Aktive Autos stehen im Kilometer-Tab und im Plus-Menü bereit</small>
            </span>
          </summary>
          <div className="setup-two-column car-setup-grid">
            <form action={createCar} className="form compact car-create-form">
              <strong>Auto hinzufügen</strong>
              <label>Name<input name="name" placeholder="Seat Leon - weiß" required /></label>
              <label>Kennzeichen<input name="licensePlate" placeholder="Optional" /></label>
              <label>Farbe<input name="color" type="color" defaultValue="#16776f" /></label>
              <label>Notizen<textarea name="notes" /></label>
              <button className="button secondary" type="submit">Auto speichern</button>
            </form>
            <div className="category-editor-list car-editor-list">
              {allCars.map((car) => (
                <details className="category-editor car-editor" key={car.id}>
                  <summary>
                    <span className="color-dot" style={{ background: car.color }} />
                    <span>{car.name}{car.archivedAt ? " (archiviert)" : ""}</span>
                    <strong>{car.licensePlate || "Ohne Kennzeichen"}</strong>
                  </summary>
                  <AutosaveForm action={updateCar} className="form compact">
                    <input type="hidden" name="id" value={car.id} />
                    <label>Name<input name="name" defaultValue={car.name} required /></label>
                    <label>Kennzeichen<input name="licensePlate" defaultValue={car.licensePlate} /></label>
                    <label>Farbe<input name="color" type="color" defaultValue={car.color} /></label>
                    <label>Notizen<textarea name="notes" defaultValue={car.notes} /></label>
                    <button className="button secondary autosave-submit" type="submit">Speichern</button>
                  </AutosaveForm>
                  <form action={car.archivedAt ? unarchiveCar : archiveCar} className="inline-form">
                    <input type="hidden" name="id" value={car.id} />
                    <button className="button secondary" type="submit">{car.archivedAt ? "Wieder aktivieren" : "Archivieren"}</button>
                  </form>
                </details>
              ))}
            </div>
          </div>
        </details>
      ) : (
        <div className="setup-card">
          <h2 className="section-title">Autos</h2>
          <p className="muted">Nur Admins können Autos anlegen, bearbeiten oder archivieren.</p>
        </div>
      )}
    </div>
  );
}

function buildMonthlyRows(entries: ReturnType<typeof addFuelDerivedFields>) {
  const rows = new Map<string, { label: string; costCents: number; litersMilli: number; litersWithDistanceMilli: number; drivenKm: number }>();
  for (const entry of entries) {
    const date = new Date(entry.date);
    const label = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const row = rows.get(label) ?? { label, costCents: 0, litersMilli: 0, litersWithDistanceMilli: 0, drivenKm: 0 };
    row.costCents += entry.costCents;
    row.litersMilli += entry.litersMilli;
    if (entry.drivenKm !== null && entry.drivenKm > 0) row.litersWithDistanceMilli += entry.litersMilli;
    row.drivenKm += Math.max(0, entry.drivenKm ?? 0);
    rows.set(label, row);
  }
  return [...rows.values()]
    .map((row) => ({
      ...row,
      averageLitersPer100Km: row.drivenKm > 0 ? (row.litersWithDistanceMilli / 1000 / row.drivenKm) * 100 : null
    }))
    .sort((a, b) => b.label.localeCompare(a.label))
    .slice(0, 12);
}

function buildMileageComparison(entries: ReturnType<typeof addFuelDerivedFields>, range: ReturnType<typeof getRange>, query: string) {
  const selectedMonthKeys = monthKeysBetween(range.from, range.to);
  const selectedMonthCount = Math.max(1, selectedMonthKeys.length);
  const neighborKeys = [
    ...Array.from({ length: 3 }, (_, index) => addMonthsToKey(selectedMonthKeys[0] ?? getMonthKey(), -3 + index)),
    ...Array.from({ length: 3 }, (_, index) => addMonthsToKey(selectedMonthKeys.at(-1) ?? getMonthKey(), index + 1))
  ];
  const neighborKeySet = new Set(neighborKeys);
  const neighborEntries = entries
    .filter((entry) => neighborKeySet.has(getMonthKey(new Date(entry.date))))
    .filter((entry) => !query || normalizeSearch(entry.note).includes(query) || String(entry.odometerKm).includes(query));
  const neighborRows = buildMonthlyRows(neighborEntries);
  const neighborMonthCount = Math.max(1, neighborRows.length);
  const neighborStats = calculateFuelStatsFromDerived(neighborEntries);
  const selectedStats = calculateFuelStatsFromDerived(
    entries
      .filter((entry) => isInRange(entry.date, range.from, range.to))
      .filter((entry) => !query || normalizeSearch(entry.note).includes(query) || String(entry.odometerKm).includes(query))
  );

  return {
    cost: compareFuelMetric(
      selectedStats.totalCostCents / 100 / selectedMonthCount,
      neighborStats.totalCostCents / 100 / neighborMonthCount,
      maxNeighborValue(neighborRows, (row) => row.costCents / 100),
      "Kosten"
    ),
    liters: compareFuelMetric(
      selectedStats.totalLitersMilli / 1000 / selectedMonthCount,
      neighborStats.totalLitersMilli / 1000 / neighborMonthCount,
      maxNeighborValue(neighborRows, (row) => row.litersMilli / 1000),
      "Liter"
    ),
    distance: compareFuelMetric(
      selectedStats.drivenKm / selectedMonthCount,
      neighborStats.drivenKm / neighborMonthCount,
      maxNeighborValue(neighborRows, (row) => row.drivenKm),
      "Kilometer"
    ),
    consumption: compareFuelMetric(
      selectedStats.averageLitersPer100Km,
      neighborStats.averageLitersPer100Km,
      maxNeighborValue(neighborRows, (row) => row.averageLitersPer100Km),
      "Verbrauch"
    )
  };
}

function maxNeighborValue<T>(rows: T[], getValue: (row: T) => number | null) {
  const values = rows.map(getValue).filter((value): value is number => value !== null && Number.isFinite(value) && value > 0);
  return values.length > 0 ? Math.max(...values) : null;
}

function monthKeysBetween(from: Date, to: Date) {
  const keys: string[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cursor <= end) {
    keys.push(getMonthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

function addMonthsToKey(monthKey: string, delta: number) {
  const parts = splitMonthKey(monthKey) ?? splitMonthKey(getMonthKey())!;
  return getMonthKey(new Date(parts.year, Number(parts.month) - 1 + delta, 1));
}

function getRange(params: MileagePageParams, currentMonthKey: string) {
  const fallbackMonth = monthRange(currentMonthKey) ?? monthRange(getMonthKey())!;
  if (params.from || params.to) {
    return {
      mode: "custom" as const,
      from: params.from ? new Date(params.from) : fallbackMonth.from,
      to: params.to ? endOfDay(new Date(params.to)) : fallbackMonth.to
    };
  }
  if (params.month) {
    const range = monthRange(params.month);
    if (range) return { mode: "month" as const, key: params.month, ...range };
  }
  if (params.year) {
    const year = Number(params.year);
    if (Number.isInteger(year) && year >= 1900 && year <= 2100) {
      return { mode: "year" as const, from: new Date(year, 0, 1), to: endOfDay(new Date(year, 11, 31)) };
    }
  }
  return { mode: "month" as const, key: currentMonthKey, ...fallbackMonth };
}

function getMileageHref(params: MileagePageParams, overrides: MileagePageParams) {
  const next = cleanMileageParams({ ...params, ...overrides });
  const search = new URLSearchParams();
  for (const key of ["car", "from", "to", "year", "month", "q", "view"] as const) {
    const value = next[key];
    if (value && !(key === "view" && value === "overview")) search.set(key, value);
  }
  const query = search.toString();
  return query ? `/kilometer?${query}` : "/kilometer";
}

function buildMileageMonthNavigationHref(params: MileagePageParams, monthKey: string, delta: number) {
  const parts = splitMonthKey(monthKey) ?? splitMonthKey(getMonthKey())!;
  const date = new Date(parts.year, Number(parts.month) - 1 + delta, 1);
  return getMileageHref(params, {
    month: getMonthKey(date),
    year: undefined,
    from: undefined,
    to: undefined
  });
}

function buildMileageYearNavigationHref(params: MileagePageParams, year: number, delta: number) {
  return getMileageHref(params, {
    year: String(year + delta),
    month: undefined,
    from: undefined,
    to: undefined
  });
}

function cleanMileageParams(params: MileagePageParams) {
  const next: MileagePageParams = {};
  for (const key of ["car", "from", "to", "year", "month", "q", "view", "selected"] as const) {
    const value = String(params[key] ?? "").trim();
    if (value) next[key] = value;
  }

  if (next.month && /^\d{2}$/.test(next.month) && next.year) {
    next.month = `${next.year}-${next.month}`;
  } else if (next.month && !/^\d{4}-\d{2}$/.test(next.month)) {
    delete next.month;
  }

  if (next.from || next.to) {
    delete next.year;
    delete next.month;
  } else if (next.month) {
    delete next.year;
  } else if (next.year) {
    delete next.month;
  }
  if (next.view && getMileageView(next.view) === "overview") delete next.view;
  return next;
}

function getMileageView(value: unknown): "overview" | "entries" | "analysis" {
  if (value === "entries" || value === "analysis") return value;
  return "overview";
}

function buildMileageActiveFilterChips(params: MileagePageParams, range: ReturnType<typeof getRange>) {
  const chips: { label: string; clear: Partial<MileagePageParams> }[] = [];
  if (range.mode === "custom") {
    chips.push({ label: `Zeitraum: ${formatDate(range.from)} - ${formatDate(range.to)}`, clear: { from: undefined, to: undefined } });
  }
  if (params.q) {
    chips.push({ label: `Suche: ${params.q}`, clear: { q: undefined } });
  }
  return chips;
}

function monthRange(monthKey: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || month < 1 || month > 12) return null;
  return { from: new Date(year, month - 1, 1), to: endOfDay(new Date(year, month, 0)) };
}

function endOfDay(date: Date) {
  date.setHours(23, 59, 59, 999);
  return date;
}

function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isInRange(date: Date | string, from: Date, to: Date) {
  const value = new Date(date).getTime();
  return value >= from.getTime() && value <= to.getTime();
}

function normalizeSearch(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function toDateInputValue(date: Date | string) {
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
