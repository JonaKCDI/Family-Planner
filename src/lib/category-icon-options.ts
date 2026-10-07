export const fallbackCategoryIcon = "tag";

export const categoryIconOptions = [
  { key: "tag", label: "Allgemein" },
  { key: "cart", label: "Einkauf" },
  { key: "utensils", label: "Essen" },
  { key: "home", label: "Wohnen" },
  { key: "car", label: "Auto" },
  { key: "fuel", label: "Tanken" },
  { key: "train", label: "ÖPNV" },
  { key: "bike", label: "Fahrrad" },
  { key: "wallet", label: "Geld" },
  { key: "banknote", label: "Bargeld" },
  { key: "piggy-bank", label: "Sparen" },
  { key: "receipt", label: "Rechnung" },
  { key: "credit-card", label: "Karte" },
  { key: "return", label: "Erstattung" },
  { key: "heart-pulse", label: "Gesundheit" },
  { key: "shield", label: "Versicherung" },
  { key: "graduation-cap", label: "Bildung" },
  { key: "baby", label: "Kinder" },
  { key: "plane", label: "Reise" },
  { key: "gift", label: "Geschenke" },
  { key: "sparkles", label: "Freizeit" },
  { key: "shirt", label: "Kleidung" },
  { key: "wifi", label: "Internet" },
  { key: "phone", label: "Telefon" },
  { key: "plug", label: "Energie" },
  { key: "hammer", label: "Handwerk" },
  { key: "landmark", label: "Bank" },
  { key: "briefcase", label: "Arbeit" },
  { key: "calendar", label: "Termin" },
  { key: "more", label: "Sonstiges" }
] as const;

const categoryIconKeys = new Set(categoryIconOptions.map((option) => option.key));

export type CategoryIconKey = typeof categoryIconOptions[number]["key"];

export function normalizeCategoryIcon(value: unknown): CategoryIconKey {
  const key = String(value ?? "").trim();
  return categoryIconKeys.has(key as CategoryIconKey) ? key as CategoryIconKey : fallbackCategoryIcon;
}
