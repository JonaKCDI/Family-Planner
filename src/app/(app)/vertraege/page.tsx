import { DocumentFilePicker } from "@/components/document-file-picker";
import { quickCreateExpenseCategory, quickCreateExpenseLabel } from "@/lib/actions";
import { updateContract } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { ensureDueContractExpenses } from "@/lib/contract-auto-expenses";
import { getContractNextCancellationDate, toAnnualCancellationInputValue } from "@/lib/contracts";
import { formatDate, formatMoney, toDateInputValue } from "@/lib/format";
import { getVisibleDocumentRoots, getDocumentsForLinkedEntities, getExpenseLabels, getVisibleCategories, getVisibleContractPayments, getVisibleContractsWithExpenseDetails } from "@/lib/queries";
import { ActionModal } from "@/components/action-modal";
import { AutosaveForm } from "@/components/autosave-form";
import { ContractPayments } from "@/components/contract-payments";
import { ContractSummaryStrip, type ContractSummaryView } from "@/components/contract-summary-strip";
import { ContractToolbar, type ContractToolbarParams } from "@/components/contract-toolbar";
import { SearchableSelect } from "@/components/searchable-select";
import { EmptyState, PageHeader, ScopeSelect } from "@/components/ui";
import { CalendarClock, CreditCard, FileText, Lock, Pencil, Repeat, ShieldCheck, UserRound } from "lucide-react";

type ContractsPageProps = {
  searchParams: Promise<ContractPageParams>;
};

type ContractPageParams = ContractToolbarParams;

export default async function ContractsPage({ searchParams }: ContractsPageProps) {
  const session = await requireSession();
  const params = await searchParams;
  await ensureDueContractExpenses(session.family.id, session.user.id);
  const query = normalizeSearch(params.q);
  const view = getContractView(params);
  const advancedStatus = getAdvancedStatusFilter(params.status, view);
  const scopeFilter = getScopeFilter(params.scope);
  const autoExpenseFilter = getBooleanFilter(params.autoExpense);
  const renewalFilter = getBooleanFilter(params.renewal);
  const attentionFilter = getAttentionFilter(params.attention);
  const sort = getContractSort(params.sort);
  const [contracts, categories, labels] = await Promise.all([
    getVisibleContractsWithExpenseDetails(session.family.id, session.user.id),
    getVisibleCategories(session.family.id, session.user.id, "EXPENSE"),
    getExpenseLabels(session.family.id, session.user.id)
  ]);
  const documentRoots = (await getVisibleDocumentRoots(session.family.id, session.user.id, session.role)).map(({ id, name }) => ({ id, name }));
  const enrichedContracts = contracts.map((contract) => enrichContract(contract));
  const searchedContracts = enrichedContracts
    .filter((contract) => !query || matchesContract(contract.contract, query))
    .filter((contract) => !advancedStatus || matchesStatusFilter(contract.contract, advancedStatus))
    .filter((contract) => !scopeFilter || contract.contract.scope === scopeFilter)
    .filter((contract) => autoExpenseFilter === null || contract.contract.autoCreateExpenses === autoExpenseFilter)
    .filter((contract) => renewalFilter === null || contract.contract.autoRenewal === renewalFilter)
    .filter((contract) => !attentionFilter || matchesAttentionFilter(contract, attentionFilter));
  const visibleContracts = sortContracts(searchedContracts.filter((contract) => matchesContractView(contract, view)), sort);
  const documents = await getDocumentsForLinkedEntities(
    session.family.id,
    session.user.id,
    "CONTRACT",
    visibleContracts.map((contract) => contract.contract.id)
  );
  const documentsByContract = groupBy(documents, (document) => document.linkedEntityId ?? "");
  const payments = await getVisibleContractPayments(
    session.family.id,
    session.user.id,
    visibleContracts.map((contract) => contract.contract.id)
  );
  const paymentsByContract = groupBy(payments, (payment) => payment.contractId ?? "");
  const activeContracts = searchedContracts.filter((contract) => contract.contract.status === "ACTIVE");
  const attentionContracts = searchedContracts.filter((contract) => isAttentionContract(contract));
  const autoExpenseContracts = searchedContracts.filter((contract) => contract.contract.autoCreateExpenses);
  const endedContracts = searchedContracts.filter((contract) => isEndedContract(contract.contract));
  const monthlyActiveCosts = activeContracts.reduce((sum, contract) => sum + monthlyCostCents(contract.contract), 0);
  const nextCancellation = activeContracts
    .map((contract) => contract.nextCancellation)
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => a.getTime() - b.getTime())[0];
  const activeFilterChips = buildActiveFilterChips(params, {
    status: advancedStatus,
    scope: scopeFilter,
    autoExpense: autoExpenseFilter,
    renewal: renewalFilter,
    attention: attentionFilter,
    sort
  });
  const activeFilterCount = countActiveContractFilters({
    status: advancedStatus,
    scope: scopeFilter,
    autoExpense: autoExpenseFilter,
    renewal: renewalFilter,
    attention: attentionFilter,
    sort
  });
  const toolbarParams = normalizeContractParams(params, view);

  return (
    <>
      <div className="task-page-head contract-page-head">
        <PageHeader title="Verträge" />
        <ContractToolbar params={toolbarParams} activeFilterCount={activeFilterCount} resultCount={visibleContracts.length} />
      </div>

      {activeFilterChips.length > 0 || query ? (
        <div className="active-filter-row contract-active-filters" aria-label="Aktive Vertragsfilter">
          {query ? <a className="filter-chip" href={buildContractsHref(params, { q: undefined })}><span>Suche: {params.q}</span><strong aria-hidden="true">×</strong></a> : null}
          {activeFilterChips.map((chip) => (
            <a className="filter-chip" href={chip.href} key={chip.label}>
              <span>{chip.label}</span>
              <strong aria-hidden="true">×</strong>
            </a>
          ))}
          <a className="filter-chip clear-all" href="/vertraege">Alle löschen</a>
        </div>
      ) : null}

      <ContractSummaryStrip
        key={view}
        view={view}
        items={[
          { count: activeContracts.length, href: buildViewHref(params, view === "active" ? "all" : "active"), label: "aktiv", view: "active" },
          { count: attentionContracts.length, href: buildViewHref(params, view === "attention" ? "all" : "attention"), label: "bald kündbar", view: "attention" },
          { count: autoExpenseContracts.length, href: buildViewHref(params, view === "auto" ? "all" : "auto"), label: "Auto-Ausgaben", view: "auto" },
          { count: endedContracts.length, href: buildViewHref(params, view === "ended" ? "all" : "ended"), label: "beendet", view: "ended" }
        ]}
      />

      <section className="contract-focus-strip" aria-label="Vertragsüberblick">
        <div className="contract-focus-metric">
          <span>Monatswert aktiv</span>
          <strong>{formatMoney(monthlyActiveCosts)}</strong>
        </div>
        <div className="contract-focus-metric">
          <span>Nächste Kündigung</span>
          <strong>{formatDate(nextCancellation)}</strong>
        </div>
        <div className="contract-focus-metric">
          <span>Aufmerksamkeit</span>
          <strong>{attentionContracts.length}</strong>
        </div>
      </section>

      <section className="task-list-section contract-list-section spacing-top">
        <div className="section-head">
          <div>
            <h2 className="section-title">{contractViewTitles[view]}</h2>
          </div>
          <span className="contract-result-count">{visibleContracts.length} Verträge</span>
        </div>
        <div className="task-priority-list contract-priority-list">
          {visibleContracts.length === 0 ? <EmptyState>{query ? "Keine passenden Verträge gefunden." : "Noch keine Verträge in dieser Ansicht."}</EmptyState> : null}
          {visibleContracts.map((entry) => {
            const contract = entry.contract;
            const linkedDocuments = documentsByContract[contract.id] ?? [];
            const primaryDocument = linkedDocuments[0];
            const contractPayments = paymentsByContract[contract.id] ?? [];
            const paymentTotal = contractPayments.reduce((sum, payment) => sum + payment.amountCents, 0);
            const currentPricePhase = contract.pricePhases.at(-1);

            return (
              <ActionModal
                title="Vertragsdetails"
                trigger={<ContractRow entry={entry} documentCount={linkedDocuments.length} paymentTotal={paymentTotal} />}
                triggerClassName={`task-row-trigger contract-row-trigger ${entry.urgencyClass}`}
                modalId={`contract-${contract.id}`}
                key={contract.id}
              >
                <div className="task-expanded-content task-detail-sheet contract-detail-sheet">
                  <div className="task-detail-read">
                    <div className="task-detail-head task-detail-head-plain">
                      <div className="task-detail-title-block">
                        <div className={`task-detail-status ${entry.urgencyClass}`}>
                          <CalendarClock size={15} aria-hidden="true" />
                          <span>{entry.urgencyLabel}</span>
                        </div>
                        <h3>{contract.provider}</h3>
                        <p>{contract.contractType}</p>
                      </div>
                      <ContractEditModal documentRoots={documentRoots}
                        contract={contract}
                        categories={categories}
                        labels={labels}
                        primaryDocument={primaryDocument}
                        currentPricePhase={currentPricePhase}
                      />
                    </div>
                    <dl className="task-detail-meta contract-detail-meta">
                      <div><CreditCard size={18} aria-hidden="true" /><dt>Kosten</dt><dd>{formatMoney(contract.costCents, contract.currency)} · {billingLabels[contract.billingInterval]}</dd></div>
                      <div><CalendarClock size={18} aria-hidden="true" /><dt>Kündigung</dt><dd>{formatDate(entry.nextCancellation)}</dd></div>
                      <div><Repeat size={18} aria-hidden="true" /><dt>Verlängerung</dt><dd>{contract.autoRenewal ? renewalLabels[contract.renewalInterval] : "Keine automatische Verlängerung"}</dd></div>
                      <div><Lock size={18} aria-hidden="true" /><dt>Sichtbarkeit</dt><dd>{contract.scope === "FAMILY" ? "Familie" : "Privat"}</dd></div>
                      <div><UserRound size={18} aria-hidden="true" /><dt>Besitzer</dt><dd>{contract.owner.name}</dd></div>
                      <div><ShieldCheck size={18} aria-hidden="true" /><dt>Status</dt><dd>{statusLabels[contract.status]}</dd></div>
                    </dl>
                    <div className="contract-detail-groups">
                      <section>
                        <span>Automatische Ausgabe</span>
                        <strong>{contract.autoCreateExpenses ? `Einzug am ${contract.expensePaymentDay ?? new Date(contract.startDate).getDate()}.` : "Nicht aktiv"}</strong>
                        <p>{contract.autoCreateExpenses ? [contract.expenseCategory?.name, contract.expenseLabel?.name].filter(Boolean).join(" · ") || "Ohne Kategorie/Label" : "Neue Ausgaben entstehen nur manuell."}</p>
                      </section>
                      <section>
                        <span>Preisentwicklung</span>
                        <div className="contract-price-chips">
                          {contract.pricePhases.length === 0 ? <strong>Keine Preisphasen</strong> : contract.pricePhases.map((phase) => (
                            <strong key={phase.id}>{formatMoney(phase.amountCents, phase.currency)} · {billingLabels[phase.billingInterval]} · ab {formatDate(phase.validFrom)}</strong>
                          ))}
                        </div>
                      </section>
                      <section>
                        <span>Dokumente</span>
                        {linkedDocuments.length === 0 ? (
                          <strong>Keine Nachweise verknüpft</strong>
                        ) : (
                          <div className="contract-document-list">
                            {linkedDocuments.map((document) => (
                              <a href={document.url} target="_blank" rel="noreferrer" key={document.id}>{document.title}</a>
                            ))}
                          </div>
                        )}
                      </section>
                    </div>
                    {contract.description ? <div className="task-detail-note"><span>Notiz</span><p>{contract.description}</p></div> : null}
                    <ContractPayments
                      payments={contractPayments.map((payment) => ({
                        id: payment.id,
                        date: payment.date.toISOString(),
                        description: payment.description,
                        amountCents: payment.amountCents,
                        currency: payment.currency
                      }))}
                      totalCents={paymentTotal}
                      currency={contract.currency}
                    />
                    <div className="task-detail-footnote">
                      <span>Erstellt von {contract.owner.name}</span>
                      <time>Aktualisiert {formatDate(contract.updatedAt)}</time>
                    </div>
                  </div>
                </div>
              </ActionModal>
            );
          })}
        </div>
      </section>
    </>
  );
}

function ContractRow({ entry, documentCount, paymentTotal }: { entry: EnrichedContract; documentCount: number; paymentTotal: number }) {
  const contract = entry.contract;

  return (
    <span className="contract-row">
      <span className="contract-row-icon" aria-hidden="true">{contract.provider.trim().charAt(0).toUpperCase() || "V"}</span>
      <span className="contract-row-main">
        <strong>{contract.provider}</strong>
        <span>{contract.contractType} · {contract.owner.name}</span>
        <span className="contract-row-badges">
          <small>{statusLabels[contract.status]}</small>
          <small>{contract.scope === "FAMILY" ? "Familie" : "Privat"}</small>
          {contract.autoCreateExpenses ? <small>Auto-Ausgabe</small> : null}
          {contract.autoRenewal ? <small>Verlängerung</small> : null}
          {documentCount > 0 ? <small><FileText size={12} aria-hidden="true" /> {documentCount}</small> : null}
        </span>
      </span>
      <span className="contract-row-side">
        <strong>{formatMoney(contract.costCents, contract.currency)}</strong>
        <span>{billingLabels[contract.billingInterval]}</span>
        <time dateTime={entry.nextCancellation?.toISOString()}>{formatDate(entry.nextCancellation)}</time>
        {paymentTotal > 0 ? <span>{formatMoney(paymentTotal, contract.currency)} gezahlt</span> : null}
      </span>
    </span>
  );
}

function ContractEditModal({
  contract,
  categories,
  labels,
  primaryDocument,
  documentRoots,
  currentPricePhase
}: {
  documentRoots: { id: string; name: string }[];
  contract: ContractLike;
  categories: Awaited<ReturnType<typeof getVisibleCategories>>;
  labels: Awaited<ReturnType<typeof getExpenseLabels>>;
  primaryDocument: DocumentLike | undefined;
  currentPricePhase: ContractLike["pricePhases"][number] | undefined;
}) {
  return (
    <ActionModal
      title="Vertrag bearbeiten"
      trigger={<Pencil size={18} aria-hidden="true" />}
      triggerLabel="Vertrag bearbeiten"
      triggerClassName="task-detail-edit-button contract-detail-edit-button"
      panelClassName="contract-edit-dialog"
      sheetVariant="create"
      wide
      modalId={`contract-${contract.id}-edit`}
    >
      <AutosaveForm action={updateContract} className="form form-grid modal-form task-create-form contract-edit-form">
        <input type="hidden" name="id" value={contract.id} />
        <fieldset className="fieldset modal-form-section full-span task-create-core">
          <legend>Vertrag</legend>
          <div className="form-grid">
            <label>Anbieter<input name="provider" defaultValue={contract.provider} required /></label>
            <label>Vertragsart<input name="contractType" defaultValue={contract.contractType} required /></label>
            <label>Startdatum<input name="startDate" type="date" defaultValue={toDateInputValue(contract.startDate)} required /></label>
            <label>
              Status
              <select name="status" defaultValue={contract.status}>
                <option value="ACTIVE">Aktiv</option>
                <option value="DRAFT">Entwurf</option>
                <option value="CANCELLED">Gekündigt</option>
                <option value="EXPIRED">Ausgelaufen</option>
              </select>
            </label>
            <ScopeSelect defaultValue={contract.scope} />
          </div>
        </fieldset>

        <fieldset className="fieldset modal-form-section full-span">
          <legend>Kosten & Abbuchung</legend>
          <div className="form-grid">
            <label>Kosten in EUR<input name="cost" inputMode="decimal" defaultValue={formatEuroInput(contract.costCents)} required /></label>
            <label>Preis gilt ab<input name="priceValidFrom" type="date" defaultValue={toDateInputValue(currentPricePhase?.validFrom ?? contract.startDate)} required /></label>
            <input type="hidden" name="priceChangeMode" value="NEW_PHASE" />
            <label>
              Zahlungsrhythmus
              <select name="billingInterval" defaultValue={contract.billingInterval}>
                <option value="MONTHLY">Monatlich</option>
                <option value="YEARLY">Jährlich</option>
                <option value="QUARTERLY">Quartalsweise</option>
                <option value="ONCE">Einmalig</option>
                <option value="OTHER">Sonstiges</option>
              </select>
            </label>
          </div>
          <p className="muted">Die App legt daraus automatisch eine Preisphase an. Bereits erzeugte Auto-Ausgaben bleiben unverändert, solange die Option nicht aktiv ist.</p>
          <label className="checkbox-field contract-price-sync-toggle"><input name="updateGeneratedExpenses" type="checkbox" /> Auto-Ausgaben ab „Preis gilt ab“ anpassen</label>
        </fieldset>

        <fieldset className="fieldset modal-form-section full-span">
          <legend>Automatik</legend>
          <div className="form-grid">
            <label className="checkbox-field full-span"><input name="autoCreateExpenses" type="checkbox" defaultChecked={contract.autoCreateExpenses} /> Automatisch als Ausgabe eintragen</label>
            <label>Einzugstag<input name="expensePaymentDay" type="number" min="1" max="31" defaultValue={contract.expensePaymentDay ?? new Date(contract.startDate).getDate()} /></label>
            <SearchableSelect name="expenseCategoryId" label="Ausgaben-Kategorie" options={categories} defaultValue={contract.expenseCategoryId} emptyLabel="Keine Kategorie" placeholder="Kategorie suchen oder auswählen" quickAddLabel="+ Neue Kategorie hinzufügen" quickAddAction={quickCreateExpenseCategory} />
            <SearchableSelect name="expenseLabelId" label="Label / Projekt" options={labels} defaultValue={contract.expenseLabelId} emptyLabel="Kein Label" placeholder="Label suchen oder auswählen" quickAddLabel="+ Neues Label hinzufügen" quickAddAction={quickCreateExpenseLabel} />
          </div>
        </fieldset>

        <fieldset className="fieldset modal-form-section full-span">
          <legend>Laufzeit & Kündigung</legend>
          <div className="form-grid">
            <label>Ende/Laufzeit bis<input name="endDate" type="date" defaultValue={toDateInputValue(contract.endDate)} /></label>
            <label>Kündigung spätestens am<input name="cancellationDeadline" type="date" defaultValue={toAnnualCancellationInputValue(contract.cancellationDeadlineMonth, contract.cancellationDeadlineDay)} /></label>
            <label>Kündigungsfrist in Tagen<input name="cancellationNoticeDays" type="number" min="0" defaultValue={contract.cancellationNoticeDays ?? ""} /></label>
            <input type="hidden" name="renewalAnchorDay" value={contract.renewalAnchorDay ?? ""} />
            <label className="checkbox-field"><input name="autoRenewal" type="checkbox" defaultChecked={contract.autoRenewal} /> Verlängert sich automatisch</label>
            <label>
              Verlängerungsrhythmus
              <select name="renewalInterval" defaultValue={contract.renewalInterval}>
                <option value="MONTHLY">Monatlich</option>
                <option value="QUARTERLY">Quartalsweise</option>
                <option value="YEARLY">Jährlich</option>
              </select>
            </label>
          </div>
        </fieldset>

        <label className="full-span">Notizen<textarea name="description" defaultValue={contract.description ?? ""} /></label>
        <DocumentFilePicker roots={documentRoots} />
        <details className="optional-section full-span" open={Boolean(primaryDocument)}>
          <summary>Beleg / Drive-Link hinzufügen</summary>
          <input type="hidden" name="documentId" value={primaryDocument?.id ?? ""} />
          {primaryDocument && !primaryDocument.url ? <p className="muted full-span">Verknüpfte NAS-Datei: {primaryDocument.title}. Weitere Belege können hinzugefügt werden.</p> : null}
          <div className="form-grid">
            <label>Dokumenttitel<input name="documentTitle" defaultValue={primaryDocument?.url ? primaryDocument.title : ""} placeholder="Vertrag, Rechnung, Nachweis ..." /></label>
            <label>HTTPS-Link<input name="documentUrl" type="url" defaultValue={primaryDocument?.url ?? ""} placeholder="https://drive.google.com/..." /></label>
          </div>
        </details>
        <div className="modal-submit-row full-span">
          <button className="button autosave-submit" type="submit">Speichern</button>
        </div>
      </AutosaveForm>
    </ActionModal>
  );
}

function enrichContract(contract: ContractLike): EnrichedContract {
  const nextCancellation = getContractNextCancellationDate(contract);
  const days = daysUntil(nextCancellation);
  const urgencyClass = contract.status !== "ACTIVE"
    ? "task-completed"
    : days !== null && days < 0
      ? "task-critical"
      : days !== null && days <= attentionDays
        ? "task-warning"
        : "task-calm";
  const urgencyLabel = contract.status !== "ACTIVE"
    ? statusLabels[contract.status]
    : days === null
      ? "Ohne Frist"
      : days < 0
        ? "Frist überfällig"
        : days === 0
          ? "Heute kündbar"
          : days <= attentionDays
            ? `${days} Tage bis Frist`
            : "Im Blick";
  return { contract, nextCancellation, daysUntilCancellation: days, urgencyClass, urgencyLabel };
}

function matchesContract(contract: ContractLike, query: string) {
  return [
    contract.provider,
    contract.contractType,
    contract.description,
    billingLabels[contract.billingInterval],
    statusLabels[contract.status],
    contract.owner.name,
    contract.expenseCategory?.name,
    contract.expenseLabel?.name
  ].some((value) => normalizeSearch(value).includes(query));
}

function matchesContractView(entry: EnrichedContract, view: ContractSummaryView) {
  if (view === "all") return true;
  if (view === "active") return entry.contract.status === "ACTIVE";
  if (view === "attention") return isAttentionContract(entry);
  if (view === "auto") return entry.contract.autoCreateExpenses;
  return isEndedContract(entry.contract);
}

function isAttentionContract(entry: EnrichedContract) {
  return entry.contract.status === "ACTIVE" && entry.daysUntilCancellation !== null && entry.daysUntilCancellation <= attentionDays;
}

function isEndedContract(contract: ContractLike) {
  return contract.status === "CANCELLED" || contract.status === "EXPIRED";
}

function matchesStatusFilter(contract: ContractLike, status: ContractStatusFilter) {
  if (status === "ENDED") return isEndedContract(contract);
  return contract.status === status;
}

function matchesAttentionFilter(entry: EnrichedContract, filter: AttentionFilter) {
  if (filter === "none") return entry.nextCancellation === null;
  if (filter === "overdue") return entry.daysUntilCancellation !== null && entry.daysUntilCancellation < 0;
  return isAttentionContract(entry);
}

function sortContracts(contracts: EnrichedContract[], sort: ContractSort) {
  return [...contracts].sort((a, b) => {
    if (sort === "provider") return a.contract.provider.localeCompare(b.contract.provider, "de");
    if (sort === "cost-desc") return monthlyCostCents(b.contract) - monthlyCostCents(a.contract);
    return compareOptionalDates(a.nextCancellation, b.nextCancellation) || a.contract.provider.localeCompare(b.contract.provider, "de");
  });
}

function monthlyCostCents(contract: ContractLike) {
  if (contract.billingInterval === "YEARLY") return Math.round(contract.costCents / 12);
  if (contract.billingInterval === "QUARTERLY") return Math.round(contract.costCents / 3);
  if (contract.billingInterval === "ONCE") return 0;
  return contract.costCents;
}

function daysUntil(date: Date | null) {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / dayMs);
}

function compareOptionalDates(a: Date | null, b: Date | null) {
  const aTime = a?.getTime() ?? Number.POSITIVE_INFINITY;
  const bTime = b?.getTime() ?? Number.POSITIVE_INFINITY;
  return aTime - bTime;
}

function normalizeSearch(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function formatEuroInput(amountCents: number) {
  if (amountCents === 0) return "";
  return (amountCents / 100).toFixed(2).replace(".", ",");
}

function getContractView(params: ContractPageParams): ContractSummaryView {
  if (params.view === "active" || params.view === "attention" || params.view === "auto" || params.view === "ended" || params.view === "all") return params.view;
  if (params.status === "ENDED") return "ended";
  if (params.status === "ACTIVE") return "active";
  return "active";
}

function getAdvancedStatusFilter(value: unknown, view: ContractSummaryView): ContractStatusFilter | null {
  if (view === "active" && value === "ACTIVE") return null;
  if (view === "ended" && value === "ENDED") return null;
  if (value === "ACTIVE" || value === "DRAFT" || value === "CANCELLED" || value === "EXPIRED" || value === "ENDED") return value;
  return null;
}

function getScopeFilter(value: unknown): "FAMILY" | "PRIVATE" | null {
  if (value === "FAMILY" || value === "PRIVATE") return value;
  return null;
}

function getBooleanFilter(value: unknown) {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

function getAttentionFilter(value: unknown): AttentionFilter | null {
  if (value === "soon" || value === "overdue" || value === "none") return value;
  return null;
}

function getContractSort(value: unknown): ContractSort {
  if (value === "cost-desc" || value === "provider") return value;
  return "deadline";
}

function normalizeContractParams(params: ContractPageParams, view: ContractSummaryView): ContractToolbarParams {
  const normalized: ContractToolbarParams = {};
  if (params.q) normalized.q = params.q;
  if (view !== "active") normalized.view = view;
  if (params.status && !(view === "active" && params.status === "ACTIVE") && !(view === "ended" && params.status === "ENDED")) normalized.status = params.status;
  if (params.scope) normalized.scope = params.scope;
  if (params.autoExpense) normalized.autoExpense = params.autoExpense;
  if (params.renewal) normalized.renewal = params.renewal;
  if (params.attention) normalized.attention = params.attention;
  if (getContractSort(params.sort) !== "deadline") normalized.sort = getContractSort(params.sort);
  return normalized;
}

function countActiveContractFilters(filters: {
  status: ContractStatusFilter | null;
  scope: "FAMILY" | "PRIVATE" | null;
  autoExpense: boolean | null;
  renewal: boolean | null;
  attention: AttentionFilter | null;
  sort: ContractSort;
}) {
  return [
    Boolean(filters.status),
    Boolean(filters.scope),
    filters.autoExpense !== null,
    filters.renewal !== null,
    Boolean(filters.attention),
    filters.sort !== "deadline"
  ].filter(Boolean).length;
}

function buildActiveFilterChips(
  params: ContractPageParams,
  filters: {
    status: ContractStatusFilter | null;
    scope: "FAMILY" | "PRIVATE" | null;
    autoExpense: boolean | null;
    renewal: boolean | null;
    attention: AttentionFilter | null;
    sort: ContractSort;
  }
) {
  return [
    filters.status ? { label: statusFilterLabels[filters.status], href: buildContractsHref(params, { status: undefined }) } : null,
    filters.scope ? { label: filters.scope === "FAMILY" ? "Familie" : "Privat", href: buildContractsHref(params, { scope: undefined }) } : null,
    filters.autoExpense !== null ? { label: filters.autoExpense ? "Mit Auto-Ausgabe" : "Ohne Auto-Ausgabe", href: buildContractsHref(params, { autoExpense: undefined }) } : null,
    filters.renewal !== null ? { label: filters.renewal ? "Mit Verlängerung" : "Ohne Verlängerung", href: buildContractsHref(params, { renewal: undefined }) } : null,
    filters.attention ? { label: attentionLabels[filters.attention], href: buildContractsHref(params, { attention: undefined }) } : null,
    filters.sort !== "deadline" ? { label: sortLabels[filters.sort], href: buildContractsHref(params, { sort: undefined }) } : null
  ].filter((chip): chip is { label: string; href: string } => Boolean(chip));
}

function buildViewHref(params: ContractPageParams, view: ContractSummaryView) {
  return buildContractsHref(params, {
    view: view === "active" ? undefined : view,
    status: undefined
  });
}

function buildContractsHref(params: ContractPageParams, next: Partial<ContractPageParams>) {
  const search = new URLSearchParams();
  const merged = { ...params, ...next };
  if (merged.q?.trim()) search.set("q", merged.q.trim());
  if (merged.view && merged.view !== "active") search.set("view", merged.view);
  if (merged.status) search.set("status", merged.status);
  if (merged.scope) search.set("scope", merged.scope);
  if (merged.autoExpense) search.set("autoExpense", merged.autoExpense);
  if (merged.renewal) search.set("renewal", merged.renewal);
  if (merged.attention) search.set("attention", merged.attention);
  if (getContractSort(merged.sort) !== "deadline") search.set("sort", getContractSort(merged.sort));
  const query = search.toString();
  return query ? `/vertraege?${query}` : "/vertraege";
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const key = getKey(item);
    groups[key] = [...(groups[key] ?? []), item];
    return groups;
  }, {});
}

const dayMs = 24 * 60 * 60 * 1000;
const attentionDays = 60;

const billingLabels = {
  MONTHLY: "Monatlich",
  YEARLY: "Jährlich",
  QUARTERLY: "Quartalsweise",
  ONCE: "Einmalig",
  OTHER: "Sonstiges"
};

const renewalLabels = {
  MONTHLY: "monatlich",
  YEARLY: "jährlich",
  QUARTERLY: "quartalsweise",
  ONCE: "einmalig",
  OTHER: "individuell"
};

const statusLabels = {
  ACTIVE: "Aktiv",
  CANCELLED: "Gekündigt",
  EXPIRED: "Ausgelaufen",
  DRAFT: "Entwurf"
};

const statusFilterLabels = {
  ...statusLabels,
  ENDED: "Beendet"
};

const attentionLabels = {
  soon: "Bald kündbar",
  overdue: "Überfällig",
  none: "Ohne Frist"
};

const sortLabels = {
  deadline: "Nächste Frist",
  "cost-desc": "Kosten absteigend",
  provider: "Anbieter A-Z"
};

const contractViewTitles = {
  active: "Aktive Verträge",
  attention: "Bald kündbar",
  auto: "Auto-Ausgaben",
  ended: "Beendete Verträge",
  all: "Alle Verträge"
};

type ContractLike = Awaited<ReturnType<typeof getVisibleContractsWithExpenseDetails>>[number];
type DocumentLike = Awaited<ReturnType<typeof getDocumentsForLinkedEntities>>[number];
type ContractStatusFilter = ContractLike["status"] | "ENDED";
type AttentionFilter = "soon" | "overdue" | "none";
type ContractSort = "deadline" | "cost-desc" | "provider";
type EnrichedContract = {
  contract: ContractLike;
  nextCancellation: Date | null;
  daysUntilCancellation: number | null;
  urgencyClass: "task-critical" | "task-warning" | "task-calm" | "task-completed";
  urgencyLabel: string;
};
