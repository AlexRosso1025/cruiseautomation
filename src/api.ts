// ────────────────────────────────────────────────────────────────
// Cliente del endpoint REST de sailings de Royal Caribbean.
//
//   GET /itinerary/api/v1/sailings?packageCode=…&countryCode=…&currencyCode=…
//
// Devuelve JSON público, sin auth y (hoy) sin Akamai — se le pega con
// fetch directo. `countryCode` es el que cambia el precio por mercado.
// ────────────────────────────────────────────────────────────────

import {
  CRUISE,
  FETCH_RETRIES,
  SAILINGS_ENDPOINT,
  type MarketConfig,
} from "./config.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface RawRoom {
  code?: string;
  name?: string;
  categoryCode?: string;
  pricing?: { amount?: number; total?: number } | null;
}

export interface RawSailing {
  id?: string;
  packageCode?: string;
  sailDate?: string;
  startDate?: string;
  endDate?: string;
  rooms?: RawRoom[];
  includesTaxesAndFees?: boolean;
  taxesAndFees?: { amount?: number; total?: number };
  status?: string;
}

export interface SailingsResponse {
  sailings?: RawSailing[];
}

export function buildSailingsUrl(market: MarketConfig, sailDate: string): string {
  const params = new URLSearchParams({
    packageCode: CRUISE.packageCode,
    groupId: CRUISE.groupId,
    sailDate,
    adults: CRUISE.adults,
    children: CRUISE.children,
    shipCode: CRUISE.shipCode,
    voyageType: CRUISE.voyageType,
    countryCode: market.countryCode,
    currencyCode: market.currencyCode,
    languageCode: market.languageCode,
  });
  return `${SAILINGS_ENDPOINT}?${params}`;
}

export interface FetchResult {
  ok: boolean;
  status: number | null;
  url: string;
  attempts: number;
  body: SailingsResponse | null;
  rawText: string | null;
  error?: string;
}

export async function fetchSailings(
  market: MarketConfig,
  sailDate: string,
  opts: { retries?: number; log?: (m: string) => void } = {}
): Promise<FetchResult> {
  const url = buildSailingsUrl(market, sailDate);
  const retries = opts.retries ?? FETCH_RETRIES;
  const log = opts.log ?? (() => undefined);

  let lastError = "";
  let lastStatus: number | null = null;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          accept: "application/json, text/plain, */*",
          "accept-language":
            market.languageCode === "es"
              ? "es-AR,es;q=0.9,en;q=0.8"
              : "en-US,en;q=0.9",
          "user-agent": UA,
          referer: "https://www.royalcaribbean.com/",
        },
      });
      lastStatus = res.status;
      const rawText = await res.text();

      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        log(`  intento ${attempt}: ${lastError}`);
        const retryable =
          res.status === 403 || res.status === 429 || res.status >= 500;
        if (retryable && attempt <= retries) {
          await sleep(1500 * attempt);
          continue;
        }
        return {
          ok: false,
          status: res.status,
          url,
          attempts: attempt,
          body: null,
          rawText,
          error: lastError,
        };
      }

      let body: SailingsResponse;
      try {
        body = JSON.parse(rawText) as SailingsResponse;
      } catch {
        return {
          ok: false,
          status: res.status,
          url,
          attempts: attempt,
          body: null,
          rawText,
          error: "la respuesta no es JSON válido",
        };
      }

      return {
        ok: true,
        status: res.status,
        url,
        attempts: attempt,
        body,
        rawText,
      };
    } catch (err) {
      lastError = (err as Error).message;
      log(`  intento ${attempt}: ${lastError}`);
      if (attempt <= retries) await sleep(1500 * attempt);
    }
  }

  return {
    ok: false,
    status: lastStatus,
    url,
    attempts: retries + 1,
    body: null,
    rawText: null,
    error: lastError || "falló el fetch",
  };
}
