export type DeploymentFact = {
  label: string;
  value: string;
  ok: boolean;
  hint: string;
};

export function buildDeploymentFacts(): DeploymentFact[] {
  const appUrl = process.env.APP_URL || "nicht gesetzt";
  const expenseCsvPath = process.env.EXPENSE_CSV_PATH || "nicht gesetzt";
  const backupRetention = process.env.BACKUP_RETENTION_DAYS || "30";
  const backupInterval = process.env.BACKUP_INTERVAL_SECONDS || "86400";

  return [
    {
      label: "Datenbank",
      value: "erreichbar",
      ok: true,
      hint: "Diese Seite konnte nur laden, weil PostgreSQL erreichbar ist."
    },
    {
      label: "APP_URL",
      value: appUrl,
      ok: Boolean(process.env.APP_URL),
      hint: "Für Synology später auf die echte HTTP- oder HTTPS-Adresse setzen."
    },
    {
      label: "Ausgaben-Export",
      value: expenseCsvPath,
      ok: expenseCsvPath.startsWith("/data/expenses"),
      hint: "Sollte im Container normalerweise unter /data/expenses liegen."
    },
    {
      label: "Backup-Plan",
      value: `alle ${backupInterval}s, ${backupRetention} Tage Aufbewahrung`,
      ok: Boolean(process.env.BACKUP_RETENTION_DAYS || process.env.BACKUP_INTERVAL_SECONDS),
      hint: "Der Backup-Container schreibt die Dateien in den gemounteten Backup-Ordner."
    },
    {
      label: "Datenbank-Passwort",
      value: process.env.POSTGRES_PASSWORD ? "gesetzt" : "nicht gesetzt",
      ok: Boolean(process.env.POSTGRES_PASSWORD),
      hint: "Das Passwort kommt aus Docker/DSM und wird hier nie angezeigt."
    }
  ];
}
