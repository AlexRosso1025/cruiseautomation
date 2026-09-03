// ────────────────────────────────────────────────────────────────
// Reporte HTML autocontenido del modo debug.
// data/debug/<runId>/report.html — se abre con doble clic.
// ────────────────────────────────────────────────────────────────

import {
  CATEGORY_IDS,
  CATEGORY_LABEL,
  type CategoryId,
  type MarketSample,
} from "./parse.js";

export interface DebugMarketView {
  key: string;
  label: string;
  folder: string;
  url: string;
  status: number | null;
  ok: boolean;
  error: string | null;
  sample: MarketSample | null;
  availableSailDates: string[];
  roomCodes: string[];
}

export interface DebugReportData {
  runId: string;
  sailDate: string;
  markets: DebugMarketView[];
  analysis: string;
  pricesDiffer: boolean;
}

function esc(s: unknown): string {
  return String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!
  );
}

function money(v: number | null | undefined, currency: string | undefined): string {
  if (v == null) return "—";
  const n = v.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency ?? ""} ${n}`.trim();
}

export function renderDebugReport(d: DebugReportData): string {
  const cols = d.markets;
  const first = cols[0]?.sample ?? null;
  const rowIds: (CategoryId | "cheapest")[] = [...CATEGORY_IDS, "cheapest"];

  const priceRows = rowIds
    .map((id) => {
      const label = id === "cheapest" ? "Más barato" : CATEGORY_LABEL[id];
      const cells = cols
        .map((col) => {
          const s = col.sample;
          const val = id === "cheapest" ? (s?.cheapest ?? null) : (s?.prices[id] ?? null);
          let delta = "";
          if (col !== cols[0] && first) {
            const base = id === "cheapest" ? first.cheapest : first.prices[id];
            if (base != null && val != null && base !== 0) {
              const p = ((val - base) / base) * 100;
              const cls = p < -0.05 ? "down" : p > 0.05 ? "up" : "same";
              delta = ` <span class="delta ${cls}">${p > 0 ? "+" : ""}${p.toFixed(1)}%</span>`;
            }
          }
          return `<td>${esc(money(val, s?.currency))}${delta}</td>`;
        })
        .join("");
      return `<tr class="${id === "cheapest" ? "cheapest" : ""}"><th>${label}</th>${cells}</tr>`;
    })
    .join("\n");

  const metaRow = (label: string, fn: (c: DebugMarketView) => string) =>
    `<tr class="meta"><th>${label}</th>${cols.map((c) => `<td>${esc(fn(c))}</td>`).join("")}</tr>`;

  const fileLinks = cols
    .map(
      (c) =>
        `<li><b>${esc(c.label)}</b> — ` +
        `<a href="${c.folder}/response-body.json" target="_blank">response-body.json</a> · ` +
        `<a href="${c.folder}/summary.json" target="_blank">summary.json</a></li>`
    )
    .join("");

  const bannerCls = d.pricesDiffer ? "good" : "warn";

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>RCL debug — ${esc(d.sailDate)}</title>
<style>
  :root{color-scheme:light dark;--bg:#fff;--fg:#1a1a1a;--mut:#666;--line:#e3e3e3;--card:#f6f6f7;--up:#c0392b;--down:#1e8e3e}
  @media(prefers-color-scheme:dark){:root{--bg:#161719;--fg:#e8e8e8;--mut:#9aa0a6;--line:#34363b;--card:#1f2023;--up:#ff6b6b;--down:#5bd18a}}
  *{box-sizing:border-box}body{margin:0;padding:2rem 1.25rem 4rem;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
  main{max-width:900px;margin:0 auto}h1{font-size:1.35rem;margin:0 0 .2rem}h2{font-size:1.05rem;margin:2.2rem 0 .6rem}
  .sub{color:var(--mut);font-size:.9rem;margin:0 0 1.4rem}
  .banner{padding:.85rem 1.1rem;border-radius:10px;font-weight:600;border:1px solid var(--line)}
  .banner.good{background:color-mix(in srgb,var(--down) 15%,transparent)}
  .banner.warn{background:color-mix(in srgb,var(--up) 13%,transparent)}
  .wrap{overflow-x:auto}
  table{border-collapse:collapse;width:100%;font-size:.92rem}
  th,td{text-align:left;padding:.5rem .7rem;border-bottom:1px solid var(--line);white-space:nowrap}
  thead th{color:var(--mut)}
  tr.cheapest th,tr.cheapest td{font-weight:700;border-top:2px solid var(--line)}
  tr.meta th,tr.meta td{color:var(--mut);font-size:.84rem;white-space:normal}
  .delta{font-size:.8em;font-weight:700;padding:.05em .4em;border-radius:5px}
  .delta.up{color:var(--up);background:color-mix(in srgb,var(--up) 15%,transparent)}
  .delta.down{color:var(--down);background:color-mix(in srgb,var(--down) 15%,transparent)}
  .delta.same{color:var(--mut)}
  code{background:var(--card);padding:.1em .35em;border-radius:4px;font-size:.8em;word-break:break-all;white-space:normal}
  .ok{color:var(--down)}
  ul.files{padding-left:1.1rem}ul.files a{color:inherit}
</style></head><body><main>
<h1>Royal Caribbean — debug de mercados</h1>
<p class="sub">Sailing <b>${esc(d.sailDate)}</b> · run ${esc(d.runId)} · ${esc(new Date().toISOString())}</p>

<div class="banner ${bannerCls}">${esc(d.analysis)}</div>

<h2>Precios por categoría (por persona)</h2>
<div class="wrap"><table>
<thead><tr><th></th>${cols.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr></thead>
<tbody>
${priceRows}
${metaRow("Moneda", (c) => c.sample?.currency ?? "—")}
${metaRow("Estado", (c) => c.sample?.status ?? "—")}
${metaRow("Impuestos incluidos", (c) => (c.sample ? (c.sample.taxesIncluded ? "sí" : "no") : "—"))}
${metaRow("HTTP", (c) => `${c.status ?? "—"}${c.ok ? "" : ` (${c.error ?? "error"})`}`)}
${metaRow("sailDate encontrado", (c) => (c.sample ? "sí" : "no"))}
${metaRow("room codes", (c) => c.roomCodes.join(", ") || "—")}
${metaRow("fechas en la respuesta", (c) => String(c.availableSailDates.length))}
</tbody></table></div>

<h2>Request de cada mercado</h2>
<div class="wrap"><table class="grid"><tbody>
${cols
  .map((c) => `<tr><td>${esc(c.label)}</td><td><code>${esc(c.url)}</code></td></tr>`)
  .join("")}
</tbody></table></div>

<h2>Fechas disponibles del paquete</h2>
<p style="font-size:.9rem"><code>${esc((cols[0]?.availableSailDates ?? []).join(", ") || "—")}</code></p>

<h2>Archivos crudos</h2>
<ul class="files">${fileLinks}<li><a href="comparison.json" target="_blank">comparison.json</a></li></ul>
</main></body></html>`;
}
