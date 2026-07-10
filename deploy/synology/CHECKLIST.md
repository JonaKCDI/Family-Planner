# Synology Deployment Checklist

## Before Start

- [ ] Copy the full project to `/volume1/docker/family-app`.
- [ ] Create `/volume1/docker/family-app/expenses`.
- [ ] Create `/volume1/docker/family-app/mileage`.
- [ ] Create `/volume1/docker/family-app/documents` or set `DOCUMENTS_HOST_DIR` to a narrow existing read-only document folder.
- [ ] Create `/volume1/docker/family-app/backups`.
- [ ] Copy `deploy/synology/.env.example` to `deploy/synology/.env`.
- [ ] Set a long random `POSTGRES_PASSWORD`.
- [ ] Set `APP_URL` to `http://NAS-IP:3000` for the first local test.
- [ ] Confirm no old Docker volume is reused unless you intentionally upgrade existing data.

## First Start

- [ ] Open Synology Container Manager.
- [ ] Create project `family-app`.
- [ ] Use project path `/volume1/docker/family-app/deploy/synology`.
- [ ] Use the existing `compose.yaml`.
- [ ] Build and start the project.
- [ ] Confirm `db`, `app`, and `backup` are running.
- [ ] Open `http://NAS-IP:3000`.
- [ ] Create the first admin in setup.
- [ ] In **Einstellungen > Notfall-Wiederherstellung**, save a long recovery key and store it offline.

## Functional Check

- [ ] Login works.
- [ ] Create one expense.
- [ ] Download yearly Excel from **Ausgaben > Setup**.
- [ ] Export Synology Excel and confirm a year-specific workbook, e.g. `Ausgaben-Jona-2026.xlsx`, appears in `expenses`.
- [ ] Create one car in **Kilometer > Setup**, add one tank stop, and confirm a workbook like `Verbrauch-Seat-Leon.xlsx` appears in `mileage` after Synology export.
- [ ] Create one task and change its status.
- [ ] Create one contract and link an expense to it.
- [ ] Confirm contract payments show in **Verträge**.
- [ ] Add one HTTPS document reference.
- [ ] If documents are mounted: create one document root, browse a folder, preview a PDF/image/text file, and download one file.
- [ ] Confirm a `.sql.gz` backup appears in `backups`.

## HTTPS / iPhone PWA

- [ ] Keep access private through LAN/VPN unless public exposure is explicitly desired.
- [ ] Configure Synology DDNS or an internal DNS name.
- [ ] Add a DSM certificate for the hostname.
- [ ] Add DSM Reverse Proxy: HTTPS hostname to HTTP `127.0.0.1:3000`.
- [ ] Update `APP_URL` to the HTTPS URL.
- [ ] Recreate/restart the project.
- [ ] Open the HTTPS URL in iPhone Safari and add to Home Screen.

## Update Check

- [ ] Confirm a fresh SQL backup exists before updating.
- [ ] Copy new project files to the NAS.
- [ ] Rebuild/restart the Container Manager project.
- [ ] Confirm migrations complete in app logs.
- [ ] Recheck login, Excel export, and backup.

## Admin Recovery Drill

- [ ] Confirm the offline recovery key is available.
- [ ] Open `/admin-recovery`.
- [ ] Enter the admin name, recovery key, and a new password.
- [ ] After login, replace the recovery key in **Einstellungen > Notfall-Wiederherstellung**.
