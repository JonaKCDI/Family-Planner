export type ExpensePlanningTreatmentType =
  | "NORMAL"
  | "FIXED_COST"
  | "SPECIAL_EFFECT"
  | "REIMBURSEMENT"
  | "IGNORE_FOR_PLANNING"
  | "SAVINGS_INVESTMENT";

export type ExpensePlanningRulePatternType = "CATEGORY" | "STORE" | "DESCRIPTION" | "CATEGORY_STORE" | "REIMBURSEMENT_TEXT";

export type PlanningCategory = {
  id?: string | null;
  name: string;
  color?: string | null;
  icon?: string | null;
};

export type PlanningExpense = {
  id: string;
  ownerUserId: string;
  kind: "EXPENSE" | "INCOME";
  amountCents: number;
  date: Date | string;
  store?: string | null;
  description?: string | null;
  paymentMethod?: string | null;
  categoryId?: string | null;
  contractId?: string | null;
  recurringTransactionId?: string | null;
  generatedByContract?: boolean;
  generatedByRecurringTransaction?: boolean;
  category?: PlanningCategory | null;
};

export type PlanningTreatment = {
  expenseId?: string | null;
  groupKey?: string | null;
  treatment: ExpensePlanningTreatmentType;
};

export type PlanningRule = {
  ownerUserId: string;
  patternType: ExpensePlanningRulePatternType;
  patternValue: string;
  categoryId?: string | null;
  treatment: ExpensePlanningTreatmentType;
  confidence?: number | null;
};

export type PlanningCategoryRow = {
  categoryId?: string;
  name: string;
  color: string;
  icon?: string | null;
  grossCents: number;
  plannedCents: number;
  specialEffectCents: number;
  planMonthlyCents: number;
  normalLowCents: number;
  normalHighCents: number;
  medianCents: number;
  activeMonths: number;
  confidence: number;
  reason: string;
};

export type PlanningSuggestion = {
  groupKey: string;
  title: string;
  treatment: ExpensePlanningTreatmentType;
  amountCents: number;
  plannedImpactCents: number;
  confidence: number;
  reason: string;
  expenseIds: string[];
};

export type PlanningMonthlyRow = {
  month: string;
  grossSpendingCents: number;
  plannedSpendingCents: number;
  incomeCents: number;
  normalIncomeCents: number;
  specialEffectCents: number;
  grossSavingsCents: number;
  plannedSavingsCents: number;
};

export type ExpensePlanningAnalysis = {
  periods: string[];
  summary: {
    grossSpendingCents: number;
    plannedSpendingCents: number;
    specialEffectCents: number;
    fixedCostCents: number;
    variablePlanCents: number;
    monthlyReserveCents: number;
    reviewNeededCents: number;
    normalIncomeCents: number;
    grossSavingsCents: number;
    plannedSavingsCents: number;
    conservativeSavingsCents: number;
  };
  categoryRows: PlanningCategoryRow[];
  monthlyRows: PlanningMonthlyRow[];
  suggestions: PlanningSuggestion[];
};

type CategoryProfile = {
  categoryId: string;
  name: string;
  color: string;
  icon?: string | null;
  values: number[];
  activeMonths: number;
  median: number;
  q1: number;
  q3: number;
  iqr: number;
  trimmedMean: number;
  normalHigh: number;
  outlierThreshold: number;
  plan: number;
  confidence: number;
};

type FixedGroup = {
  key: string;
  categoryId: string;
  amountCents: number;
  expenseIds: Set<string>;
};

const fallbackColor = "#6b6f76";
const planningConstants = {
  sparseCategoryMonthLimit: 3,
  reserveShareOfDetectedEffects: 0.5,
  normalRangeMultiplier: 1.25,
  outlierIqrMultiplier: 1.5,
  minimumOutlierGapCents: 5000
} as const;
const reimbursementWords = ["spesen", "erstattung", "rueckzahlung", "rückzahlung", "auslage", "reisekosten", "gutschrift", "refund"];

export function buildExpensePlanningAnalysis({
  entries,
  categories,
  treatments = [],
  rules = [],
  months = 12,
  referenceDate = new Date(),
  displayYear
}: {
  entries: PlanningExpense[];
  categories: PlanningCategory[];
  treatments?: PlanningTreatment[];
  rules?: PlanningRule[];
  months?: number;
  referenceDate?: Date | string;
  displayYear?: number;
}): ExpensePlanningAnalysis {
  const periods = buildMonthPeriods(referenceDate, months);
  const periodSet = new Set(periods);
  const treatmentByExpense = new Map(treatments.filter((item) => item.expenseId).map((item) => [item.expenseId ?? "", item.treatment]));
  const treatmentByGroup = new Map(treatments.filter((item) => item.groupKey).map((item) => [item.groupKey ?? "", item.treatment]));
  const visibleEntries = entries.filter((entry) => periodSet.has(monthKey(entry.date)));
  const expenseEntries = visibleEntries.filter((entry) => entry.kind === "EXPENSE");
  const incomeEntries = visibleEntries.filter((entry) => entry.kind === "INCOME");
  const fixedGroups = detectFixedGroups(expenseEntries);
  const fixedExpenseIds = new Set([...fixedGroups.values()].flatMap((group) => [...group.expenseIds]));
  const profiles = buildCategoryProfiles(expenseEntries, categories, periods);
  const selectedPeriods = displayYear ? periods.filter((period) => period.startsWith(`${displayYear}-`)) : periods;
  const selectedPeriodSet = new Set(selectedPeriods);
  const applied = expenseEntries
    .filter((entry) => selectedPeriodSet.has(monthKey(entry.date)))
    .map((entry) => {
      const profile = profiles.get(categoryKey(entry));
      const ruleTreatment = matchingRuleTreatment(entry, rules);
      const groupKey = specialGroupKey(entry, profile);
      const treatment = treatmentByExpense.get(entry.id) ?? (groupKey ? treatmentByGroup.get(groupKey) : undefined) ?? ruleTreatment;
      return { entry, profile, treatment, groupKey, isFixed: fixedExpenseIds.has(entry.id) || treatment === "FIXED_COST" };
    });

  const categoryBuckets = new Map<string, { row: PlanningCategoryRow; values: number[] }>();
  const suggestionsByGroup = new Map<string, PlanningSuggestion>();
  for (const item of applied) {
    const profile = item.profile ?? fallbackProfile(item.entry);
    const raw = item.entry.amountCents;
    const planned = plannedAmountForExpense(item.entry, profile, item.treatment, item.isFixed);
    const special = Math.max(0, raw - planned);
    const key = categoryKey(item.entry);
    const bucket = categoryBuckets.get(key) ?? {
      row: {
        categoryId: item.entry.category?.id ?? item.entry.categoryId ?? undefined,
        name: profile.name,
        color: profile.color,
        icon: profile.icon,
        grossCents: 0,
        plannedCents: 0,
        specialEffectCents: 0,
        planMonthlyCents: Math.round(profile.plan),
        normalLowCents: Math.round(profile.q1),
        normalHighCents: Math.round(profile.normalHigh),
        medianCents: Math.round(profile.median),
        activeMonths: profile.activeMonths,
        confidence: profile.confidence,
        reason: categoryReason(profile)
      },
      values: profile.values
    };
    bucket.row.grossCents += raw;
    bucket.row.plannedCents += planned;
    bucket.row.specialEffectCents += special;
    categoryBuckets.set(key, bucket);

    if (!item.treatment && item.groupKey && special > 0) {
      const current = suggestionsByGroup.get(item.groupKey) ?? {
        groupKey: item.groupKey,
        title: `${profile.name}: auffällige Ausgaben ${formatMonthLabel(monthKey(item.entry.date))}`,
        treatment: "SPECIAL_EFFECT",
        amountCents: 0,
        plannedImpactCents: 0,
        confidence: Math.max(35, profile.confidence - 8),
        reason: `Liegt über dem typischen Bereich (${formatCents(profile.normalHigh)}).`,
        expenseIds: []
      };
      current.amountCents += raw;
      current.plannedImpactCents += special;
      current.expenseIds.push(item.entry.id);
      suggestionsByGroup.set(item.groupKey, current);
    }
  }

  const monthlyRows = selectedPeriods.map((period) => buildMonthlyRow(period, expenseEntries, incomeEntries, profiles, rules, treatmentByExpense, treatmentByGroup, fixedExpenseIds));
  const fixedCostCents = [...fixedGroups.values()].reduce((sum, group) => sum + group.amountCents, 0)
    + applied.filter((item) => item.treatment === "FIXED_COST" && !fixedExpenseIds.has(item.entry.id)).reduce((sum, item) => sum + item.entry.amountCents, 0);
  const categoryRows = [...categoryBuckets.values()].map((bucket) => bucket.row).sort((a, b) => b.grossCents - a.grossCents || a.name.localeCompare(b.name, "de"));
  const planTotal = categoryRows.reduce((sum, row) => sum + row.planMonthlyCents, 0);
  const normalIncomeCents = normalMonthlyIncome(incomeEntries, periods, treatmentByExpense, rules);
  const grossSpendingCents = monthlyRows.reduce((sum, row) => sum + row.grossSpendingCents, 0);
  const plannedSpendingCents = monthlyRows.reduce((sum, row) => sum + row.plannedSpendingCents, 0);
  const specialEffectCents = Math.max(0, grossSpendingCents - plannedSpendingCents);
  const sparseSpendingCents = categoryRows
    .filter((row) => row.activeMonths < planningConstants.sparseCategoryMonthLimit)
    .reduce((sum, row) => sum + row.grossCents, 0);
  const monthlyReserveCents = Math.round((specialEffectCents * planningConstants.reserveShareOfDetectedEffects) / Math.max(1, selectedPeriods.length));
  const incomeCents = monthlyRows.reduce((sum, row) => sum + row.incomeCents, 0);
  const conservativeNeed = fixedCostCents + categoryRows.reduce((sum, row) => sum + Math.max(row.planMonthlyCents, row.normalHighCents), 0) - fixedCostCents;

  return {
    periods: selectedPeriods,
    summary: {
      grossSpendingCents,
      plannedSpendingCents,
      specialEffectCents,
      fixedCostCents,
      variablePlanCents: Math.max(0, planTotal - fixedCostCents),
      monthlyReserveCents,
      reviewNeededCents: sparseSpendingCents,
      normalIncomeCents,
      grossSavingsCents: incomeCents - grossSpendingCents,
      plannedSavingsCents: normalIncomeCents - planTotal - monthlyReserveCents,
      conservativeSavingsCents: normalIncomeCents - conservativeNeed - monthlyReserveCents
    },
    categoryRows,
    monthlyRows,
    suggestions: [
      ...suggestionsByGroup.values(),
      ...buildReimbursementSuggestions(incomeEntries, selectedPeriodSet, treatmentByExpense)
    ].sort((a, b) => b.plannedImpactCents - a.plannedImpactCents)
  };
}

function buildCategoryProfiles(entries: PlanningExpense[], categories: PlanningCategory[], periods: string[]) {
  const profiles = new Map<string, CategoryProfile>();
  const categoryInfo = new Map(categories.map((category) => [category.id ?? "", category]));
  const valuesByCategory = new Map<string, number[]>();
  for (const category of categories) valuesByCategory.set(category.id ?? "", periods.map(() => 0));
  for (const entry of entries) {
    const periodIndex = periods.indexOf(monthKey(entry.date));
    if (periodIndex < 0) continue;
    const key = categoryKey(entry);
    const values = valuesByCategory.get(key) ?? periods.map(() => 0);
    values[periodIndex] += entry.amountCents;
    valuesByCategory.set(key, values);
  }

  for (const [key, values] of valuesByCategory) {
    const category = categoryInfo.get(key);
    const activeValues = values.filter((value) => value > 0);
    const activeMonths = activeValues.length;
    const medianValue = median(values);
    const q1 = percentile(values, 25);
    const q3 = percentile(values, 75);
    const iqr = Math.max(0, q3 - q1);
    const trimmed = trimmedMean(values);
    const recentValues = values.slice(-3);
    const recentMedian = median(recentValues);
    const basePlan = values.length >= 6 ? (0.7 * medianValue) + (0.3 * trimmed) : medianValue;
    const trendRatio = medianValue > 0 ? recentMedian / medianValue : 1;
    const trend = activeMonths >= 3 && recentValues.every((value) => value > q3) ? clamp(trendRatio, 0.85, 1.25) : 1;
    const normalHigh = activeMonths < 8 ? Math.max(q1, medianValue * planningConstants.normalRangeMultiplier) : Math.max(q3, medianValue * planningConstants.normalRangeMultiplier);
    const outlierThreshold = Math.max(
      q3 + planningConstants.outlierIqrMultiplier * iqr,
      medianValue * planningConstants.outlierIqrMultiplier,
      medianValue + planningConstants.minimumOutlierGapCents
    );
    const stability = medianValue > 0 ? 1 - Math.min(1, iqr / medianValue) : activeMonths > 0 ? 0.35 : 0.1;
    const outlierRate = values.filter((value) => value > outlierThreshold).length / Math.max(1, values.length);
    const confidence = Math.round(clamp(30 + activeMonths * 5 + stability * 28 - outlierRate * 20, 15, 90));
    profiles.set(key, {
      categoryId: key,
      name: category?.name ?? "Ohne Kategorie",
      color: category?.color ?? fallbackColor,
      icon: category?.icon,
      values,
      activeMonths,
      median: medianValue,
      q1,
      q3,
      iqr,
      trimmedMean: trimmed,
      normalHigh,
      outlierThreshold,
      plan: activeMonths < planningConstants.sparseCategoryMonthLimit ? medianValue : basePlan * trend,
      confidence: activeMonths < planningConstants.sparseCategoryMonthLimit ? Math.min(confidence, 40) : confidence
    });
  }
  return profiles;
}

function plannedAmountForExpense(entry: PlanningExpense, profile: CategoryProfile, treatment: ExpensePlanningTreatmentType | undefined, isFixed: boolean) {
  if (treatment === "IGNORE_FOR_PLANNING" || treatment === "SPECIAL_EFFECT") return 0;
  if (treatment === "REIMBURSEMENT" || treatment === "SAVINGS_INVESTMENT") return 0;
  if (treatment === "NORMAL" || treatment === "FIXED_COST" || isFixed) return entry.amountCents;
  if (profile.activeMonths < planningConstants.sparseCategoryMonthLimit) return entry.amountCents;
  return Math.min(entry.amountCents, Math.round(profile.normalHigh));
}

function buildMonthlyRow(
  period: string,
  expenseEntries: PlanningExpense[],
  incomeEntries: PlanningExpense[],
  profiles: Map<string, CategoryProfile>,
  rules: PlanningRule[],
  treatmentByExpense: Map<string, ExpensePlanningTreatmentType>,
  treatmentByGroup: Map<string, ExpensePlanningTreatmentType>,
  fixedExpenseIds: Set<string>
): PlanningMonthlyRow {
  let grossSpendingCents = 0;
  let plannedSpendingCents = 0;
  for (const entry of expenseEntries) {
    if (monthKey(entry.date) !== period) continue;
    const profile = profiles.get(categoryKey(entry)) ?? fallbackProfile(entry);
    const groupKey = specialGroupKey(entry, profile);
    const treatment = treatmentByExpense.get(entry.id) ?? (groupKey ? treatmentByGroup.get(groupKey) : undefined) ?? matchingRuleTreatment(entry, rules);
    grossSpendingCents += entry.amountCents;
    plannedSpendingCents += plannedAmountForExpense(entry, profile, treatment, fixedExpenseIds.has(entry.id) || treatment === "FIXED_COST");
  }
  const periodIncome = incomeEntries.filter((entry) => monthKey(entry.date) === period);
  const incomeCents = periodIncome.reduce((sum, entry) => sum + entry.amountCents, 0);
  const normalIncomeCents = periodIncome
    .filter((entry) => isNormalPlanningIncome(entry, treatmentByExpense.get(entry.id) ?? matchingRuleTreatment(entry, rules)))
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  return {
    month: period,
    grossSpendingCents,
    plannedSpendingCents,
    incomeCents,
    normalIncomeCents,
    specialEffectCents: Math.max(0, grossSpendingCents - plannedSpendingCents),
    grossSavingsCents: incomeCents - grossSpendingCents,
    plannedSavingsCents: normalIncomeCents - plannedSpendingCents
  };
}

function detectFixedGroups(entries: PlanningExpense[]) {
  const groups = new Map<string, PlanningExpense[]>();
  for (const entry of entries) {
    const sourceKey = entry.contractId ? `contract:${entry.contractId}`
      : entry.recurringTransactionId ? `recurring:${entry.recurringTransactionId}`
        : normalizedMerchant(entry);
    if (!sourceKey) continue;
    const values = groups.get(sourceKey) ?? [];
    values.push(entry);
    groups.set(sourceKey, values);
  }

  const fixed = new Map<string, FixedGroup>();
  for (const [key, groupEntries] of groups) {
    const sorted = [...groupEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const amounts = sorted.map((entry) => entry.amountCents);
    const meanValue = mean(amounts);
    const cv = meanValue > 0 ? standardDeviation(amounts) / meanValue : 1;
    const gaps = sorted.slice(1).map((entry, index) => daysBetween(sorted[index].date, entry.date));
    const cadence = median(gaps);
    const generated = sorted.some((entry) => entry.generatedByContract || entry.generatedByRecurringTransaction || entry.contractId || entry.recurringTransactionId);
    const regularCadence = (cadence >= 25 && cadence <= 35) || (cadence >= 80 && cadence <= 100) || (cadence >= 350 && cadence <= 380);
    if (sorted.length >= 3 && (generated || (cv <= 0.1 && regularCadence))) {
      fixed.set(key, {
        key,
        categoryId: categoryKey(sorted[0]),
        amountCents: Math.round(median(amounts)),
        expenseIds: new Set(sorted.map((entry) => entry.id))
      });
    }
  }
  return fixed;
}

function matchingRuleTreatment(entry: PlanningExpense, rules: PlanningRule[]) {
  const store = normalizeText(entry.store);
  const description = normalizeText(entry.description);
  const categoryId = entry.category?.id ?? entry.categoryId ?? "";
  for (const rule of rules) {
    if (rule.ownerUserId !== entry.ownerUserId) continue;
    if (rule.categoryId && rule.categoryId !== categoryId) continue;
    const value = normalizeText(rule.patternValue);
    if (rule.patternType === "CATEGORY" && value === normalizeText(categoryId || entry.category?.name)) return rule.treatment;
    if (rule.patternType === "STORE" && store && store === value) return rule.treatment;
    if (rule.patternType === "DESCRIPTION" && description && description.includes(value)) return rule.treatment;
    if (rule.patternType === "CATEGORY_STORE" && store && `${categoryId}:${store}` === value) return rule.treatment;
    if (rule.patternType === "REIMBURSEMENT_TEXT" && entry.kind === "INCOME" && description.includes(value)) return rule.treatment;
  }
  return undefined;
}

function buildReimbursementSuggestions(incomeEntries: PlanningExpense[], selectedPeriods: Set<string>, treatmentByExpense: Map<string, ExpensePlanningTreatmentType>) {
  return incomeEntries
    .filter((entry) => selectedPeriods.has(monthKey(entry.date)) && !treatmentByExpense.has(entry.id) && looksLikeReimbursement(entry))
    .map((entry) => ({
      groupKey: `reimbursement:${entry.id}`,
      title: "Mögliche Erstattung",
      treatment: "REIMBURSEMENT" as const,
      amountCents: entry.amountCents,
      plannedImpactCents: entry.amountCents,
      confidence: 68,
      reason: "Die Beschreibung klingt nach Spesen, Erstattung oder Auslage.",
      expenseIds: [entry.id]
    }));
}

export function createPlanningRuleFromExpense(entry: PlanningExpense, treatment: ExpensePlanningTreatmentType): Pick<PlanningRule, "patternType" | "patternValue" | "categoryId" | "treatment"> | null {
  const store = normalizeText(entry.store);
  if (store && entry.categoryId) {
    return { patternType: "CATEGORY_STORE", patternValue: `${entry.categoryId}:${store}`, categoryId: entry.categoryId, treatment };
  }
  if (store) return { patternType: "STORE", patternValue: store, categoryId: null, treatment };
  if (entry.categoryId) return { patternType: "CATEGORY", patternValue: entry.categoryId, categoryId: entry.categoryId, treatment };
  const description = normalizeText(entry.description).split(" ").slice(0, 3).join(" ");
  if (description.length >= 4) return { patternType: "DESCRIPTION", patternValue: description, categoryId: null, treatment };
  return null;
}

export function planningGroupKeyForExpense(entry: PlanningExpense) {
  return `expense:${entry.id}`;
}

function specialGroupKey(entry: PlanningExpense, profile?: CategoryProfile) {
  if (!profile || profile.activeMonths < planningConstants.sparseCategoryMonthLimit || entry.amountCents <= profile.normalHigh) return null;
  return `category:${categoryKey(entry)}:${monthKey(entry.date)}`;
}

function fallbackProfile(entry: PlanningExpense): CategoryProfile {
  return {
    categoryId: categoryKey(entry),
    name: entry.category?.name ?? "Ohne Kategorie",
    color: entry.category?.color ?? fallbackColor,
    icon: entry.category?.icon,
    values: [],
    activeMonths: 0,
    median: entry.amountCents,
    q1: entry.amountCents,
    q3: entry.amountCents,
    iqr: 0,
    trimmedMean: entry.amountCents,
    normalHigh: entry.amountCents,
    outlierThreshold: entry.amountCents,
    plan: entry.amountCents,
    confidence: 25
  };
}

function categoryKey(entry: PlanningExpense) {
  return entry.category?.id ?? entry.categoryId ?? "";
}

function categoryReason(profile: CategoryProfile) {
  if (profile.activeMonths < planningConstants.sparseCategoryMonthLimit) return "Noch wenig Historie; bleibt unverÃ¤ndert und wird als PrÃ¼fbedarf gezeigt.";
  return `Planwert aus Median ${formatCents(profile.median)} und getrimmtem Durchschnitt ${formatCents(profile.trimmedMean)}.`;
}

function looksLikeReimbursement(entry: PlanningExpense) {
  const text = `${entry.description ?? ""} ${entry.store ?? ""} ${entry.category?.name ?? ""}`;
  const normalized = normalizeText(text);
  return reimbursementWords.some((word) => normalized.includes(word));
}

function normalMonthlyIncome(entries: PlanningExpense[], periods: string[], treatmentByExpense: Map<string, ExpensePlanningTreatmentType>, rules: PlanningRule[]) {
  const byMonth = periods.map((period) => entries
    .filter((entry) => monthKey(entry.date) === period && isNormalPlanningIncome(entry, treatmentByExpense.get(entry.id) ?? matchingRuleTreatment(entry, rules)))
    .reduce((sum, entry) => sum + entry.amountCents, 0));
  return Math.round(median(byMonth));
}

function isNormalPlanningIncome(entry: PlanningExpense, treatment?: ExpensePlanningTreatmentType) {
  if (treatment === "REIMBURSEMENT" || treatment === "SPECIAL_EFFECT" || treatment === "IGNORE_FOR_PLANNING" || treatment === "SAVINGS_INVESTMENT") return false;
  if (treatment === "NORMAL" || treatment === "FIXED_COST") return true;
  return !looksLikeReimbursement(entry);
}

function buildMonthPeriods(referenceDate: Date | string, count: number) {
  const end = new Date(referenceDate);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(end.getFullYear(), end.getMonth() - (count - index - 1), 1);
    return monthKey(date);
  });
}

function monthKey(dateLike: Date | string) {
  const date = new Date(dateLike);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function normalizedMerchant(entry: PlanningExpense) {
  const text = normalizeText(entry.store || entry.description);
  return text.length >= 3 ? `merchant:${text}` : "";
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("de-DE")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

function percentile(values: number[], target: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (target / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function median(values: number[]) {
  return percentile(values, 50);
}

function trimmedMean(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const trim = sorted.length >= 10 ? Math.floor(sorted.length * 0.1) : sorted.length >= 6 ? 1 : 0;
  const kept = sorted.slice(trim, sorted.length - trim);
  return mean(kept.length > 0 ? kept : sorted);
}

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  const avg = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
}

function daysBetween(a: Date | string, b: Date | string) {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 86400000;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatCents(value: number) {
  return `${Math.round(value / 100)} €`;
}

function formatMonthLabel(month: string) {
  const [year, value] = month.split("-");
  return `${String(value).padStart(2, "0")}/${year}`;
}
