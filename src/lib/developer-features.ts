type DeveloperSession = { role: string; user: { developerFeatures?: boolean } };

export function developerFeaturesEnabled(session: DeveloperSession) {
  return session.role === "ADMIN" && session.user.developerFeatures === true;
}

export function allowedForecastYear(session: DeveloperSession, year: string | string[] | null | undefined) {
  return developerFeaturesEnabled(session) ? year ?? undefined : undefined;
}
