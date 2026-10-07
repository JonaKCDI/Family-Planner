import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import {
  AccountSettings,
  DesktopSettingsNav,
  DeveloperSettings,
  DocumentRootSettings,
  loadSettingsContext,
  MemberSettings,
  RecoverySettings,
  SettingsBackLink,
  settingsSections,
  type SettingsSectionId,
  SynologySettings
} from "../settings-content";

type SettingsSectionPageProps = {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ password?: string; recovery?: string; gespeichert?: string }>;
};

export default async function SettingsSectionPage({ params, searchParams }: SettingsSectionPageProps) {
  const session = await requireSession();
  const { section } = await params;
  const query = await searchParams;
  const sectionMeta = settingsSections.find((item) => item.id === section);
  if (!sectionMeta || (section === "entwickler" && session.role !== "ADMIN")) notFound();

  const context = await loadSettingsContext(session);
  const sectionId = section as SettingsSectionId;

  return (
    <div className="desktop-section-layout">
      <DesktopSettingsNav section={sectionId} isAdmin={context.isAdmin} />
      <div className="desktop-section-main">
        <SettingsBackLink />
        <PageHeader title={sectionMeta.title} />
        {sectionId === "entwickler" ? <DeveloperSettings context={context} saved={query.gespeichert === "1"} /> : null}
        {sectionId === "konto" ? <AccountSettings params={query} /> : null}
        {sectionId === "mitglieder" ? <MemberSettings context={context} currentUserId={session.user.id} /> : null}
        {sectionId === "wiederherstellung" ? <RecoverySettings context={context} params={query} /> : null}
        {sectionId === "dokumentbereiche" ? <DocumentRootSettings context={context} /> : null}
        {sectionId === "synology" ? <SynologySettings context={context} /> : null}
      </div>
    </div>
  );
}
