export function financeAreaHref(pathname: string, search: string, area: "persoenlich" | "familie") {
  const query = new URLSearchParams(search);
  for (const key of ["person", "category", "label", "kind", "source", "paymentMethod", "modal", "returnTo"]) query.delete(key);
  query.set("bereich", area);
  let route = pathname;
  if (pathname.includes("/planung/kategorie/")) route = "/ausgaben/planung";
  if (pathname.includes("/analyse/")) {
    route = "/ausgaben";
    query.set("view", pathname.includes("/label/") ? "labels" : "categories");
  }
  if (pathname.startsWith("/ausgaben/setup/")) {
    const section = pathname.split("/").at(-1);
    const sharedSections = ["kategorien", "labels", "serien", "sicherung"];
    if (!sharedSections.includes(section ?? "")) route = "/ausgaben/setup";
  }
  if (area === "persoenlich" && query.get("view") === "people") query.set("view", "overview");
  return `${route}?${query}`;
}
