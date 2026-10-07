import type { CSSProperties } from "react";
import { formatMoney } from "@/lib/format";
import { CategoryIcon } from "@/components/category-icon";

type CategoryRow = {
  id?: string;
  name: string;
  color: string;
  icon?: string | null;
  spending: number;
};

export function CategoryDistributionChart({ rows, currency = "EUR" }: { rows: CategoryRow[]; currency?: string }) {
  const slices = rows.filter((row) => row.spending > 0).sort((a, b) => b.spending - a.spending);
  const total = slices.reduce((sum, row) => sum + row.spending, 0);
  if (total <= 0) return null;

  const angles = slices.reduce<number[]>(
    (values, row) => [...values, values[values.length - 1] + row.spending / total * 360],
    [-90]
  );
  const paths = slices.map((row, index) => {
    const start = angles[index];
    const end = angles[index + 1];
    if (end - start >= 359.999) return { ...row, percent: 100, path: "M 100 100 m -94 0 a 94 94 0 1 0 188 0 a 94 94 0 1 0 -188 0" };
    const startRadians = start * Math.PI / 180;
    const endRadians = end * Math.PI / 180;
    const x1 = 100 + 94 * Math.cos(startRadians);
    const y1 = 100 + 94 * Math.sin(startRadians);
    const x2 = 100 + 94 * Math.cos(endRadians);
    const y2 = 100 + 94 * Math.sin(endRadians);
    const largeArc = end - start > 180 ? 1 : 0;
    return {
      ...row,
      percent: row.spending / total * 100,
      path: `M 100 100 L ${x1} ${y1} A 94 94 0 ${largeArc} 1 ${x2} ${y2} Z`
    };
  });

  return (
    <section className="panel finance-chart-widget category-distribution" aria-label="Ausgabenverteilung nach Kategorie">
      <div className="category-distribution-heading">
        <h3>Verteilung der Kategorien</h3>
        <span>{formatMoney(total, currency)} Ausgaben</span>
      </div>
      <div className="category-distribution-content">
        <svg className="category-distribution-pie" viewBox="0 0 200 200" role="img" aria-label={`Kreisdiagramm der Ausgabenverteilung auf ${paths.length} Kategorien`}>
          {paths.map((slice) => <path key={slice.id ?? slice.name} d={slice.path} fill={slice.color} stroke="white" strokeWidth="1.5" />)}
        </svg>
        <ul className="category-distribution-legend">
          {paths.map((slice) => (
            <li key={slice.id ?? slice.name}>
              <span className="category-distribution-swatch" style={{ "--category-color": slice.color } as CSSProperties} aria-hidden="true"><CategoryIcon icon={slice.icon} size={15} /></span>
              <span className="category-distribution-copy">
                <strong className="category-distribution-name" title={slice.name}>{slice.name}</strong>
                <small>{new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(slice.percent)} % der Ausgaben</small>
              </span>
              <span className="category-distribution-amount">{formatMoney(slice.spending, currency)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
