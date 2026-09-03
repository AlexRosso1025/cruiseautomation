// ────────────────────────────────────────────────────────────────
// Modo debug: pega al endpoint de sailings para cada mercado, vuelca
// el JSON crudo + un report.html para comparar a ojo.
//
//   npm run debug
//
// Confirma:
//   a) que la API devuelve precios distintos por request (mismo
//      proceso, sin estado compartido → si difieren, es por la request), y
//   b) qué parámetro cambia el mercado (mirá las dos URLs en el reporte:
//      sólo cambia countryCode / currencyCode / languageCode).
// ────────────────────────────────────────────────────────────────

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DEBUG_DIR, TARGET_SAIL_DATE, enabledMarkets } from "./config.js";
import { fetchSailings } from "./api.js";
import {
  availableSailDates,
  findSailing,
  roomCodesSeen,
  toMarketSample,
} from "./parse.js";
import { renderDebugReport, type DebugMarketView } from "./report.js";

const safe = (s: string) => s.replace(/[^a-z0-9._-]+/gi, "_");

async function main() {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = path.join(DEBUG_DIR, runId);
  mkdirSync(runDir, { recursive: true });

  const markets = enabledMarkets();
  console.log(`Debug run: ${runDir}`);
  console.log(
    `Mercados: ${markets.map((m) => `${m.key} (countryCode=${m.countryCode})`).join(" vs ")}`
  );
  console.log(`Sail date objetivo: ${TARGET_SAIL_DATE}\n`);

  const views: DebugMarketView[] = [];

  for (const market of markets) {
    const folder = safe(market.key);
    const dir = path.join(runDir, folder);
    mkdirSync(dir, { recursive: true });

    console.log(`▶ ${market.label}`);
    const res = await fetchSailings(market, TARGET_SAIL_DATE, {
      log: (m) => console.log(m),
    });

    const sailing = res.body ? findSailing(res.body, TARGET_SAIL_DATE) : null;
    const sample = sailing ? toMarketSample(sailing, market.currencyCode) : null;
    const dates = availableSailDates(res.body);
    const roomCodes = roomCodesSeen(res.body);

    writeFileSync(
      path.join(dir, "response-body.json"),
      res.rawText ?? "// sin respuesta\n"
    );
    writeFileSync(
      path.join(dir, "summary.json"),
      JSON.stringify(
        {
          market: market.key,
          url: res.url,
          httpStatus: res.status,
          ok: res.ok,
          attempts: res.attempts,
          error: res.error ?? null,
          sailDateFound: Boolean(sailing),
          availableSailDates: dates,
          roomCodesSeen: roomCodes,
          sample,
        },
        null,
        2
      )
    );

    if (res.ok && sample) {
      console.log(
        `  ✓ ${sample.currency} ${sample.cheapest} (más barato) — ` +
          `INT ${sample.prices.INTERIOR} / EXT ${sample.prices.OUTSIDE} / ` +
          `BAL ${sample.prices.BALCONY} / SUITE ${sample.prices.DELUXE}`
      );
    } else if (res.ok) {
      console.log(`  ✗ HTTP 200 pero no vino el sailing ${TARGET_SAIL_DATE}`);
      if (dates.length) console.log(`    fechas disponibles: ${dates.join(", ")}`);
    } else {
      console.log(`  ✗ ${res.error}`);
    }
    console.log("");

    views.push({
      key: market.key,
      label: market.label,
      folder,
      url: res.url,
      status: res.status,
      ok: res.ok,
      error: res.error ?? null,
      sample,
      availableSailDates: dates,
      roomCodes,
    });
  }

  const [a, b] = views;
  const pricesDiffer = Boolean(
    a?.sample &&
      b?.sample &&
      JSON.stringify(a.sample.prices) !== JSON.stringify(b.sample.prices)
  );

  const analysis =
    !a?.sample || !b?.sample
      ? "No se pudo comparar: falta al menos un mercado. Revisá summary.json."
      : pricesDiffer
        ? `Los mercados devolvieron precios DISTINTOS. Lo único que cambia entre las dos requests es countryCode / currencyCode / languageCode → el precio lo decide el parámetro countryCode.`
        : "Los dos mercados devolvieron el MISMO precio. Revisá que countryCode sea distinto en cada URL (ver sección Request).";

  writeFileSync(
    path.join(runDir, "comparison.json"),
    JSON.stringify(
      {
        runId,
        sailDate: TARGET_SAIL_DATE,
        pricesDiffer,
        analysis,
        markets: views.map((v) => ({
          key: v.key,
          url: v.url,
          httpStatus: v.status,
          ok: v.ok,
          sample: v.sample,
        })),
      },
      null,
      2
    )
  );

  const reportPath = path.join(runDir, "report.html");
  writeFileSync(
    reportPath,
    renderDebugReport({
      runId,
      sailDate: TARGET_SAIL_DATE,
      markets: views,
      analysis,
      pricesDiffer,
    })
  );

  console.log("═".repeat(60));
  console.log("REPORTE (abrir en el browser):");
  console.log("  " + pathToFileURL(reportPath).href);
  console.log("═".repeat(60));
  console.log(`Crudos: ${path.relative(process.cwd(), runDir)}/`);

  if (!a?.sample || !b?.sample) process.exitCode = 1;
}

main().catch((err) => {
  console.error("Error en debug:", err);
  process.exit(1);
});
