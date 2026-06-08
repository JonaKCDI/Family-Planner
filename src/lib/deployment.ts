export type DeploymentFact = {
  label: string;
  value: string;
  ok: boolean;
  hint: string;
};

export function buildDeploymentFacts(): DeploymentFact[] {
  const appUrl = process.env.APP_URL || "nicht gesetzt";
  const expenseExcelDir = process.env.EXPENSE_EXCEL_DIR || "nicht gesetzt";
  const mileageExcelDir = process.env.MILEAGE_EXCEL_DIR || "nicht gesetzt";
  const backupRetention = process.env.BACKUP_RETENTION_DAYS || "30";
  const backupTime = process.env.BACKUP_TIME || "01:00";
  const timezone = process.env.TZ || "Europe/Berlin";
  const backupTimeSuffix = process.env.BACKUP_TIME ? "" : " (Standard)";
  const timezoneSuffix = process.env.TZ ? "" : " (Standard)";

  return [
    {
      label: "APP_URL",
      value: appUrl,
      ok: Boolean(process.env.APP_URL),
      hint: "Für Synology auf die endgültige HTTPS-Adresse setzen, damit Auth, PWA und Service Worker dieselbe vertrauenswürdige Origin nutzen."
    },
    {
      label: "Excel-Ablage",
      value: expenseExcelDir,
      ok: expenseExcelDir.startsWith("/data/expenses"),
      hint: "Sollte im Container normalerweise der gemountete Ordner /data/expenses sein."
    },
    {
      label: "Kilometer-Ablage",
      value: mileageExcelDir,
      ok: mileageExcelDir.startsWith("/data/mileage"),
      hint: "Sollte im Container normalerweise der gemountete Ordner /data/mileage sein."
    },
    {
      label: "Backup-Plan",
      value: `${backupTime}${backupTimeSuffix} Uhr (${timezone}${timezoneSuffix}), ${backupRetention} Tage Aufbewahrung`,
      ok: isValidBackupTime(backupTime) && isPositiveInteger(backupRetention),
      hint: "Der Backup-Container schreibt täglich zur gesetzten oder per Compose vorbelegten Uhrzeit in den gemounteten Backup-Ordner."
    },
    {
      label: "Datenbank-Passwort",
      value: process.env.POSTGRES_PASSWORD ? "gesetzt" : "nicht gesetzt",
      ok: Boolean(process.env.POSTGRES_PASSWORD),
      hint: "Das Passwort kommt aus Docker/DSM und wird hier nie angezeigt."
    }
  ];
}

function isValidBackupTime(value: string) {
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return Boolean(match);
}

function isPositiveInteger(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0;
}
