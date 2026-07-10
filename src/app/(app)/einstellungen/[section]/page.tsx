import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import {
  AccountSettings,
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
  searchParams: Promise<{ password?: string; recovery?: string }>;
};

export default async function SettingsSectionPage({ params, searchParams }: SettingsSectionPageProps) {
  const session = await requireSession();
  const { section } = await params;
  const query = await searchParams;
  const sectionMeta = settingsSections.find((item) => item.id === section);
  if (!sectionMeta) notFound();

  const context = await loadSettingsContext(session);
  const sectionId = section as SettingsSectionId;

  return (
    <>
      <SettingsBackLink />
      <PageHeader title={sectionMeta.title} description={sectionMeta.description} />
      {sectionId === "konto" ? <AccountSettings params={query} /> : null}
      {sectionId === "mitglieder" ? <MemberSettings context={context} currentUserId={session.user.id} /> : null}
      {sectionId === "wiederherstellung" ? <RecoverySettings context={context} params={query} /> : null}
      {sectionId === "dokumentbereiche" ? <DocumentRootSettings context={context} /> : null}
      {sectionId === "synology" ? <SynologySettings context={context} /> : null}
    </>
  );
}
