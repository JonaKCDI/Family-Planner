import { z } from "zod";

const requiredDateInputSchema = z.string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Bitte ein gültiges Datum im Format JJJJ-MM-TT eingeben.")
  .transform((value, context) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      context.addIssue({ code: "custom", message: "Bitte ein gültiges Datum eingeben." });
      return z.NEVER;
    }
    return date;
  });

const isoDateTimeSchema = z.string()
  .trim()
  .transform((value, context) => {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) {
      context.addIssue({ code: "custom", message: "Bitte ein gültiges Datum eingeben." });
      return z.NEVER;
    }
    return date;
  });

const integerSchema = z.number().int().finite();

export function parseRequiredDateInput(value: FormDataEntryValue | string | null | undefined) {
  return requiredDateInputSchema.parse(String(value ?? ""));
}

export function parseOptionalDateInput(value: FormDataEntryValue | string | null | undefined) {
  const text = String(value ?? "").trim();
  return text ? parseRequiredDateInput(text) : null;
}

export function parseIsoDateTime(value: string) {
  return isoDateTimeSchema.parse(value);
}

export function parseEuroInputToCents(value: FormDataEntryValue | string | number | null | undefined) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = z.coerce.number().finite().safeParse(normalized);
  if (!parsed.success) throw new Error("Bitte einen gültigen Euro-Betrag eingeben.");
  const cents = Math.round(parsed.data * 100);
  if (!Number.isSafeInteger(cents)) throw new Error("Der Euro-Betrag ist zu groß.");
  return cents;
}

export function parseOptionalEuroInputToCents(value: FormDataEntryValue | string | number | null | undefined) {
  return String(value ?? "").trim() ? parseEuroInputToCents(value) : 0;
}

export function parseOptionalIntegerInput(
  value: FormDataEntryValue | string | number | null | undefined,
  options: { min?: number; max?: number } = {}
) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = z.coerce.number().pipe(integerSchema).safeParse(text);
  if (!parsed.success) throw new Error("Bitte eine gültige ganze Zahl eingeben.");
  if (options.min !== undefined && parsed.data < options.min) throw new Error(`Die Zahl muss mindestens ${options.min} sein.`);
  if (options.max !== undefined && parsed.data > options.max) throw new Error(`Die Zahl darf höchstens ${options.max} sein.`);
  return parsed.data;
}

export function parseRequiredIntegerInput(
  value: FormDataEntryValue | string | number | null | undefined,
  options: { min?: number; max?: number } = {}
) {
  const parsed = parseOptionalIntegerInput(value, options);
  if (parsed === null) throw new Error("Bitte eine gültige ganze Zahl eingeben.");
  return parsed;
}

export function parseDecimalInputToMilli(
  value: FormDataEntryValue | string | number | null | undefined,
  options: { min?: number; max?: number } = {}
) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = z.coerce.number().finite().safeParse(normalized);
  if (!parsed.success) throw new Error("Bitte eine gültige Dezimalzahl eingeben.");
  if (options.min !== undefined && parsed.data < options.min) throw new Error(`Die Zahl muss mindestens ${options.min} sein.`);
  if (options.max !== undefined && parsed.data > options.max) throw new Error(`Die Zahl darf höchstens ${options.max} sein.`);
  const milli = Math.round(parsed.data * 1000);
  if (!Number.isSafeInteger(milli)) throw new Error("Die Zahl ist zu groß.");
  return milli;
}

export function parseSyncAmountCents(value: unknown) {
  return z.number().int().finite().nonnegative().parse(value);
}
