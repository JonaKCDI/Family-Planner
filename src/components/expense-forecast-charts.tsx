import { formatMoney } from "@/lib/format";
import { boxStatistics, type MonthTotal } from "@/lib/expense-forecast";

export function monthLabel(month: string) {
  return `${month.slice(5)}.${month.slice(0, 4)}`;
}

// Node.js and browsers can emit different Unicode space characters for the
// same Intl output. Normalize them so SSR markup and client hydration match.
function stableMoney(amountCents: number, currency = "EUR") {
  return formatMoney(amountCents, currency).replace(/[\u00a0\u202f]/g, " ");
}

function stableCompactEuro(amount: number) {
  return new Intl.NumberFormat("de-DE", { notation: "compact", maximumFractionDigits: 1 })
    .format(amount)
    .replace(/[\u00a0\u202f]/g, " ");
}

export function ForecastChart({ history, forecast = [], average = [], saldo = [], spendingLabel = "Ausgaben", showMonthlyValues = true }: {
  history: MonthTotal[];
  forecast?: MonthTotal[];
  average?: { month: string; value: number | null }[];
  saldo?: MonthTotal[];
  spendingLabel?: string;
  showMonthlyValues?: boolean;
}) {
  const all = [...history, ...forecast];
  const max = Math.max(100, ...all.map((p) => p.value), ...average.map((p) => p.value ?? 0), ...saldo.map((p) => p.value)) * 1.1;
  const min = Math.min(0, ...all.map((p) => p.value), ...saldo.map((p) => p.value)) * 1.1;
  const x = (i: number) => 54 + i * 282 / Math.max(1, all.length - 1);
  const y = (value: number) => 180 - (value - min) / (max - min) * 156;
  const path = (points: MonthTotal[]) => points.map((p) => `${x(all.findIndex((a) => a.month === p.month))},${y(p.value)}`).join(" ");
  const forecastStart = average.filter((point): point is MonthTotal => point.value !== null).at(-1) ?? history.at(-1);
  return <>
    <div className="forecast-chart-scroll">
      <svg viewBox="0 0 360 210" role="img" aria-label={`${spendingLabel} mit Prognose${saldo.length ? " und monatlichem Gesamtsaldo" : ""}.${showMonthlyValues ? " Exakte Werte in der Tabelle unter dem Diagramm." : ""}`}>
        {[0, 0.5, 1].map((fraction) => <g key={fraction}>
          <line x1="54" x2="340" y1={y(min + (max - min) * fraction)} y2={y(min + (max - min) * fraction)} stroke="#e2e8e6" />
          <text x="48" y={y(min + (max - min) * fraction) + 4} textAnchor="end">{stableCompactEuro((min + (max - min) * fraction) / 100)} €</text>
        </g>)}
        {forecast.length > 0 && <rect x={x(history.length - 1) + 4} y="20" width={Math.max(0, 340 - x(history.length - 1) - 4)} height="160" fill="#f1f7f6" />}
        {min < 0 && <line x1="54" x2="340" y1={y(0)} y2={y(0)} stroke="#a6b5ae" strokeDasharray="2 3" />}
        {saldo.length > 0 && <polyline points={path(saldo)} fill="none" stroke="#7163b6" strokeWidth="2" />}
        <polyline points={path(history)} fill="none" stroke="#16776f" strokeWidth="3" />
        {average.length > 0 && <polyline points={path(average.filter((p): p is MonthTotal => p.value !== null))} fill="none" stroke="#b7791f" strokeWidth="2" />}
        {forecast.length > 0 && <polyline points={path([...(forecastStart ? [forecastStart] : []), ...forecast])} fill="none" stroke="#16776f" strokeWidth="3" strokeDasharray="7 5" />}
        {all.map((p, i) => <g key={p.month}>
          <circle cx={x(i)} cy={y(p.value)} r="2.5" fill={i < history.length ? "#16776f" : "white"} stroke="#16776f"><title>{`${monthLabel(p.month)}: ${stableMoney(p.value)}`}</title></circle>
          {(i === 0 || i === Math.floor((all.length - 1) / 2) || i === all.length - 1) && <text x={x(i)} y="202" textAnchor="middle">{monthLabel(p.month)}</text>}
        </g>)}
      </svg>
    </div>
    <div className="forecast-legend"><span><i />{spendingLabel}</span>{saldo.length > 0 && <span><i style={{ borderColor: "#7163b6" }} />Gesamtsaldo</span>}{forecast.length > 0 && <span><i className="is-dashed" />Prognose</span>}{average.length > 0 && <span><i className="is-average" />Ø 6 Monate</span>}</div>
    {showMonthlyValues && <details><summary>Monatswerte anzeigen</summary><table className="forecast-table"><thead><tr><th>Monat</th><th>{spendingLabel}</th>{average.length > 0 && <th>Ø 6 Monate</th>}{saldo.length > 0 && <th>Gesamtsaldo</th>}</tr></thead><tbody>
      {all.map((p, i) => <tr key={p.month}><td>{monthLabel(p.month)}{i >= history.length ? " (Prognose)" : ""}</td><td>{stableMoney(p.value)}</td>{average.length > 0 && <td>{average.find((a) => a.month === p.month)?.value != null ? stableMoney(average.find((a) => a.month === p.month)!.value!) : "–"}</td>}{saldo.length > 0 && <td>{saldo.find((s) => s.month === p.month) ? stableMoney(saldo.find((s) => s.month === p.month)!.value) : "–"}</td>}</tr>)}
    </tbody></table></details>}
  </>;
}

export function ExpenseBoxPlot({ points }: { points: MonthTotal[] }) {
  const stats = boxStatistics(points);
  if (!stats) return <p>Keine Daten vorhanden.</p>;
  const min = Math.min(0, ...points.map((p) => p.value));
  const max = Math.max(min + 100, ...points.map((p) => p.value));
  const x = (value: number) => 28 + (value - min) / (max - min) * 304;
  return <>
    <div className="forecast-chart-scroll forecast-box"><svg viewBox="0 0 360 140" role="img" aria-label="Boxplot der monatlichen Ausgaben mit Median, Quartilen, Whiskern und einzelnen Ausreißern">
      <line x1={x(stats.low)} x2={x(stats.high)} y1="65" y2="65" stroke="#16776f" strokeWidth="2" />
      {[stats.low, stats.high].map((v, i) => <line key={i} x1={x(v)} x2={x(v)} y1="48" y2="82" stroke="#16776f" strokeWidth="2" />)}
      <rect x={x(stats.q1)} y="40" width={Math.max(1, x(stats.q3) - x(stats.q1))} height="50" fill="#d9eeea" stroke="#16776f" />
      <line x1={x(stats.median)} x2={x(stats.median)} y1="40" y2="90" stroke="#16776f" strokeWidth="3" />
      {stats.outliers.map((p, i) => <circle key={p.month} cx={x(p.value)} cy={60 + (i % 3) * 7} r="4" fill="#b94242"><title>{`${monthLabel(p.month)}: ${stableMoney(p.value)}`}</title></circle>)}
      {[0, 0.5, 1].map((f) => <text key={f} x={x(min + f * (max - min))} y="118" textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"}>{stableCompactEuro((min + f * (max - min)) / 100)} €</text>)}
    </svg></div>
    <div className="forecast-box-summary"><span>Median <strong>{stableMoney(stats.median)}</strong></span><span>{stats.outliers.length} Ausreißer</span></div>
  </>;
}


