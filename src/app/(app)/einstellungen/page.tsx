import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { DesktopSettingsNav, loadSettingsContext, SettingsOverview } from "./settings-content";

export default async function SettingsPage() {
  const session = await requireSession();
  const context = await loadSettingsContext(session);

  return (
    <div className="desktop-section-layout">
      <DesktopSettingsNav isAdmin={context.isAdmin} />
      <div className="desktop-section-main"><PageHeader title="Einstellungen" description="Dein Konto. Eure Familie." /><SettingsOverview context={context} name={session.user.name} familyName={session.family.name} /></div>
    </div>
  );
}
