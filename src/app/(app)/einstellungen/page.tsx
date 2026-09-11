import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { loadSettingsContext, SettingsOverview } from "./settings-content";

export default async function SettingsPage() {
  const session = await requireSession();
  const context = await loadSettingsContext(session);

  return (
    <>
      <PageHeader title="Einstellungen" description="Dein Konto. Eure Familie." />
      <SettingsOverview context={context} name={session.user.name} familyName={session.family.name} />
    </>
  );
}
