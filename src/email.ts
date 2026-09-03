// ────────────────────────────────────────────────────────────────
// Armado y envío del email comparativo (nodemailer + Gmail App Password).
// ────────────────────────────────────────────────────────────────

import nodemailer from "nodemailer";
import { emailConfig } from "./config.js";
import { CATEGORY_IDS, CATEGORY_LABEL, type CategoryId } from "./parse.js";
import type { HistoryEntry, MarketRecord } from "./history.js";

function money(v: number | null | undefined, currency: string): string {
  if (v == null) return "—";
  const n = v.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency} ${n}`;
}

function delta(cur: number | null, prev: number | null | undefined): string {
  if (cur == null || prev == null || prev === 0) return "";
  const d = ((cur - prev) / prev) * 100;
  if (Math.abs(d) < 0.05) return " (=)";
  return ` (${d > 0 ? "▲ +" : "▼ "}${d.toFixed(1)}%)`;
}

/** diferencia porcentual US vs LAC para la fila (negativo = US más barato) */
function gap(a: number | null, b: number | null): string {
  if (a == null || b == null || a === 0) return "";
  const d = ((b - a) / a) * 100;
  return `${d > 0 ? "+" : ""}${d.toFixed(1)}%`;
}

export interface EmailInput {
  current: HistoryEntry;
  previous: Record<string, MarketRecord | null>;
  changedMarkets: string[];
  firstRun: boolean;
}

const rowIds: (CategoryId | "cheapest")[] = [...CATEGORY_IDS, "cheapest"];
const rowLabel = (id: CategoryId | "cheapest") =>
  id === "cheapest" ? "Más barato" : CATEGORY_LABEL[id];
const priceOf = (rec: MarketRecord, id: CategoryId | "cheapest") =>
  id === "cheapest" ? rec.cheapest : rec.prices[id];

export function buildEmail(input: EmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const { current, previous, changedMarkets, firstRun } = input;
  const keys = Object.keys(current.markets);

  const tag = firstRun
    ? "primer chequeo"
    : changedMarkets.length
      ? `cambió: ${changedMarkets.join(", ")}`
      : "sin cambios";

  const subjBits = keys.map((k) => {
    const rec = current.markets[k]!;
    return `${k} ${money(rec.cheapest, rec.currency)}`;
  });
  const subject = `[RCL] ${current.sailDate} — ${subjBits.join(" | ")} (${tag})`;

  const twoMarket = keys.length === 2;
  const [ka, kb] = keys;

  // ── texto plano ──
  const lines: string[] = [
    "Grandeur of the Seas — 7 noches Southern Caribbean (Cartagena)",
    `Sail date: ${current.sailDate}`,
    `Corrida:   ${current.timestamp}  ·  ${tag}`,
    "",
  ];
  for (const id of rowIds) {
    const cells = keys.map((k) => {
      const rec = current.markets[k]!;
      const cur = priceOf(rec, id);
      const prev = previous[k]
        ? id === "cheapest"
          ? previous[k]!.cheapest
          : previous[k]!.prices[id]
        : undefined;
      return `${k} ${money(cur, rec.currency)}${delta(cur, prev)}`;
    });
    let line = `${rowLabel(id).padEnd(11)} ${cells.join("   |   ")}`;
    if (twoMarket) {
      const g = gap(
        priceOf(current.markets[ka!]!, id),
        priceOf(current.markets[kb!]!, id)
      );
      if (g) line += `   [${kb} vs ${ka}: ${g}]`;
    }
    lines.push(line);
  }
  for (const k of keys) {
    const rec = current.markets[k]!;
    if (rec.bookingLink) lines.push("", `${k}: ${rec.bookingLink}`);
  }
  const text = lines.join("\n");

  // ── HTML ──
  const cell = (s: string, bold = false) =>
    `<td style="padding:6px 12px;border-bottom:1px solid #eee;font:13px system-ui;${
      bold ? "font-weight:700" : ""
    }">${s}</td>`;
  const head = (s: string) =>
    `<th style="text-align:left;padding:6px 12px;border-bottom:2px solid #ddd;font:600 13px system-ui">${s}</th>`;

  const headRow = `<tr>${head("Categoría")}${keys
    .map((k) => head(k))
    .join("")}${twoMarket ? head(`${kb} vs ${ka}`) : ""}</tr>`;

  const bodyRows = rowIds
    .map((id) => {
      const isCheap = id === "cheapest";
      const cells = keys
        .map((k) => {
          const rec = current.markets[k]!;
          const cur = priceOf(rec, id);
          const prev = previous[k]
            ? isCheap
              ? previous[k]!.cheapest
              : previous[k]!.prices[id]
            : undefined;
          const d = delta(cur, prev);
          const col = d.includes("▲") ? "#c0392b" : d.includes("▼") ? "#1e8e3e" : "#888";
          return cell(
            `${money(cur, rec.currency)}<span style="color:${col};font-size:11px">${d}</span>`,
            isCheap
          );
        })
        .join("");
      const gapCell = twoMarket
        ? cell(
            gap(priceOf(current.markets[ka!]!, id), priceOf(current.markets[kb!]!, id)),
            isCheap
          )
        : "";
      return `<tr>${cell(rowLabel(id), isCheap)}${cells}${gapCell}</tr>`;
    })
    .join("");

  const linksHtml = keys
    .map((k) => {
      const rec = current.markets[k]!;
      return rec.bookingLink
        ? `<a href="${rec.bookingLink}" style="color:#1a73e8">${k}</a>`
        : "";
    })
    .filter(Boolean)
    .join(" · ");

  const html = `
  <div style="max-width:680px">
    <h2 style="font:600 16px system-ui;margin:0 0 2px">Royal Caribbean — Grandeur of the Seas</h2>
    <p style="font:13px system-ui;color:#555;margin:0 0 12px">
      7 noches Southern Caribbean (Cartagena) · sail date <b>${current.sailDate}</b><br>
      ${current.timestamp} · <b>${tag}</b>
    </p>
    <table style="border-collapse:collapse;width:100%">
      <thead>${headRow}</thead>
      <tbody>${bodyRows}</tbody>
    </table>
    <p style="font:12px system-ui;color:#888;margin:8px 0 0">
      Precio por persona. ${
        Object.values(current.markets).every((m) => m.taxesIncluded)
          ? "Incluye impuestos y tasas."
          : "Impuestos/tasas según mercado."
      }
    </p>
    ${linksHtml ? `<p style="font:13px system-ui">Ver: ${linksHtml}</p>` : ""}
  </div>`.trim();

  return { subject, text, html };
}

export async function sendEmail(msg: {
  subject: string;
  text: string;
  html: string;
}): Promise<boolean> {
  if (!emailConfig.configured) {
    console.warn(
      "Email no configurado (EMAIL_TO / EMAIL_FROM / GMAIL_APP_PASSWORD). " +
        "El precio quedó guardado igual."
    );
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: emailConfig.from, pass: emailConfig.appPassword },
  });

  await transporter.sendMail({
    from: emailConfig.from,
    to: emailConfig.to,
    subject: msg.subject,
    text: msg.text,
    html: msg.html,
  });
  console.log("Email enviado a", emailConfig.to);
  return true;
}
