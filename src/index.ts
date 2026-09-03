// ────────────────────────────────────────────────────────────────
// Corrida real: pega al endpoint de sailings para cada mercado (LAC/US),
// guarda el historial y manda el email comparativo si algún mercado
// cambió respecto de la corrida anterior.
//
//   npm run check
// ────────────────────────────────────────────────────────────────

import { mkdirSync } from "node:fs";
import {
  DATA_DIR,
  TARGET_SAIL_DATE,
  emailConfig,
  enabledMarkets,
  itineraryUrl,
} from "./config.js";
import { fetchSailings } from "./api.js";
import {
  availableSailDates,
  findSailing,
  pricesEqual,
  toMarketSample,
} from "./parse.js";
import {
  loadHistory,
  previousRecordFor,
  saveHistory,
  type HistoryEntry,
  type MarketRecord,
} from "./history.js";
import { buildEmail, sendEmail } from "./email.js";

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });

  const markets = enabledMarkets();
  console.log(
    `Chequeo RCL — sailDate ${TARGET_SAIL_DATE} — mercados: ${markets
      .map((m) => m.key)
      .join(", ")}`
  );

  const history = loadHistory();
  const marketsRecord: Record<string, MarketRecord> = {};
  const failures: string[] = [];

  for (const market of markets) {
    console.log(`\n▶ ${market.label} (countryCode=${market.countryCode})`);
    const res = await fetchSailings(market, TARGET_SAIL_DATE, {
      log: (m) => console.log(m),
    });

    if (!res.ok || !res.body) {
      console.log(`  ✗ ${res.error}`);
      failures.push(market.key);
      continue;
    }

    const sailing = findSailing(res.body, TARGET_SAIL_DATE);
    if (!sailing) {
      console.log(
        `  ✗ no vino el sailing ${TARGET_SAIL_DATE}. Fechas disponibles: ${availableSailDates(
          res.body
        ).join(", ")}`
      );
      failures.push(market.key);
      continue;
    }

    const sample = toMarketSample(sailing, market.currencyCode);
    marketsRecord[market.key] = {
      currency: sample.currency,
      prices: sample.prices,
      totals: sample.totals,
      cheapest: sample.cheapest,
      status: sample.status,
      taxesIncluded: sample.taxesIncluded,
      bookingLink: itineraryUrl(market, TARGET_SAIL_DATE),
    };
    console.log(
      `  ✓ más barato ${sample.currency} ${sample.cheapest} — ` +
        `INT ${sample.prices.INTERIOR} / EXT ${sample.prices.OUTSIDE} / ` +
        `BAL ${sample.prices.BALCONY} / SUITE ${sample.prices.DELUXE}`
    );
  }

  if (Object.keys(marketsRecord).length === 0) {
    console.error("\n✗ Ningún mercado devolvió datos. El historial queda intacto.");
    process.exitCode = 1;
    return;
  }

  const entry: HistoryEntry = {
    timestamp: new Date().toISOString(),
    sailDate: TARGET_SAIL_DATE,
    markets: marketsRecord,
  };

  // ── comparación por mercado vs la corrida anterior ──
  const previous: Record<string, MarketRecord | null> = {};
  const changedMarkets: string[] = [];
  let anyPrevious = false;

  for (const key of Object.keys(marketsRecord)) {
    const prev = previousRecordFor(history, key);
    previous[key] = prev;
    if (prev) {
      anyPrevious = true;
      if (!pricesEqual(prev.prices, marketsRecord[key]!.prices)) {
        changedMarkets.push(key);
      }
    }
  }
  const firstRun = !anyPrevious;

  history.push(entry);
  saveHistory(history);
  console.log(`\nHistorial actualizado — ${history.length} corrida/s.`);

  const shouldSend = firstRun || changedMarkets.length > 0 || emailConfig.force;
  if (shouldSend) {
    const msg = buildEmail({ current: entry, previous, changedMarkets, firstRun });
    console.log(`\nEmail: ${msg.subject}`);
    await sendEmail(msg);
  } else {
    console.log("\nSin cambios en ningún mercado — no se envía email.");
  }

  if (failures.length) {
    console.warn(`\n⚠ Mercados sin datos esta corrida: ${failures.join(", ")}.`);
  }
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
