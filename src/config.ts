// ────────────────────────────────────────────────────────────────
// Configuración central. Todo lo ambiental sale de acá.
// ────────────────────────────────────────────────────────────────

import path from "node:path";

export const ROOT = process.cwd();
export const DATA_DIR = path.join(ROOT, "data");
export const HISTORY_FILE = path.join(DATA_DIR, "price-history.json");
export const DEBUG_DIR = path.join(DATA_DIR, "debug");

// ── El crucero que trackeamos ──────────────────────────────────
// Grandeur of the Seas · 7 noches Southern Caribbean desde Cartagena.
// El endpoint /itinerary/api/v1/sailings devuelve TODAS las fechas del
// paquete de una; filtramos por TARGET_SAIL_DATE al parsear.
export const CRUISE = {
  packageCode: process.env.PACKAGE_CODE ?? "GR7IP220",
  groupId: process.env.GROUP_ID ?? "GR07CTG-1478956324",
  shipCode: process.env.SHIP_CODE ?? "GR",
  voyageType: process.env.VOYAGE_TYPE ?? "OCEAN",
  adults: process.env.ADULTS ?? "2",
  children: process.env.CHILDREN ?? "0",
  /** slug de la página de itinerario (para armar el link "humano" del email) */
  itinerarySlug:
    process.env.ITINERARY_SLUG ??
    "7-night-southern-caribbean-cruise-from-cartagena-on-grandeur-GR7IP220",
};

export const TARGET_SAIL_DATE = process.env.TARGET_SAIL_DATE ?? "2026-10-18";

export const SAILINGS_ENDPOINT =
  "https://www.royalcaribbean.com/itinerary/api/v1/sailings";

/** reintentos ante 403 / 429 / 5xx / error de red */
export const FETCH_RETRIES = Number(process.env.FETCH_RETRIES ?? "3");

// ── Mercados a comparar ────────────────────────────────────────
// El precio lo decide `countryCode`. `currencyCode` fija la moneda.
// `languageCode` / `officeCode` no afectan el precio (probado).
export interface MarketConfig {
  key: string;
  label: string;
  countryCode: string;
  currencyCode: string;
  languageCode: string;
  /** prefijo de path del sitio para el link humano ("" = sitio US) */
  sitePrefix: string;
  enabled: boolean;
}

export const MARKETS: MarketConfig[] = [
  {
    key: "LAC-ARG",
    label: "LAC · Argentina",
    countryCode: process.env.LAC_COUNTRY_CODE ?? "ARG",
    currencyCode: process.env.LAC_CURRENCY ?? "USD",
    languageCode: "es",
    sitePrefix: "/lac/es",
    enabled: process.env.LAC_ENABLED !== "false",
  },
  {
    key: "US",
    label: "US · Estados Unidos",
    countryCode: process.env.US_COUNTRY_CODE ?? "USA",
    currencyCode: process.env.US_CURRENCY ?? "USD",
    languageCode: "en",
    sitePrefix: "",
    enabled: process.env.US_ENABLED !== "false",
  },
];

export const enabledMarkets = (): MarketConfig[] => MARKETS.filter((m) => m.enabled);

export function itineraryUrl(market: MarketConfig, sailDate: string): string {
  const qs = new URLSearchParams({
    sailDate,
    packageCode: CRUISE.packageCode,
    groupId: CRUISE.groupId,
    country: market.countryCode,
  });
  return `https://www.royalcaribbean.com${market.sitePrefix}/itinerary/${CRUISE.itinerarySlug}?${qs}`;
}

// ── Email (Gmail App Password vía nodemailer) ──────────────────
export const emailConfig = {
  to: process.env.EMAIL_TO ?? "",
  from: process.env.EMAIL_FROM ?? "",
  appPassword: process.env.GMAIL_APP_PASSWORD ?? "",
  /** manda el mail aunque no haya cambios */
  force: process.env.FORCE_EMAIL === "true",
  get configured(): boolean {
    return Boolean(this.to && this.from && this.appPassword);
  },
};
