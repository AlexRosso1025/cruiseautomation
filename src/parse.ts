// ────────────────────────────────────────────────────────────────
// Parseo de la respuesta de /itinerary/api/v1/sailings.
//
// Forma real (achicada a lo que usamos):
//   { sailings: [ {
//       sailDate, startDate, endDate, status, includesTaxesAndFees,
//       taxesAndFees: { amount, total },
//       rooms: [ { code: "INTERIOR"|"OUTSIDE"|"BALCONY"|"DELUXE",
//                  pricing: { amount, total } } ]
//   } ] }
//   · amount = precio por persona   · total = precio 2 pax
// ────────────────────────────────────────────────────────────────

import type { RawSailing, SailingsResponse } from "./api.js";

export const CATEGORY_IDS = ["INTERIOR", "OUTSIDE", "BALCONY", "DELUXE"] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];
export type CategoryPrices = Record<CategoryId, number | null>;

export const CATEGORY_LABEL: Record<CategoryId, string> = {
  INTERIOR: "Interior",
  OUTSIDE: "Exterior",
  BALCONY: "Balcón",
  DELUXE: "Suite",
};

const emptyPrices = (): CategoryPrices => ({
  INTERIOR: null,
  OUTSIDE: null,
  BALCONY: null,
  DELUXE: null,
});

export interface MarketSample {
  currency: string;
  /** precio por persona, por categoría */
  prices: CategoryPrices;
  /** precio total (según adults/children configurados) */
  totals: CategoryPrices;
  cheapest: number | null;
  taxesIncluded: boolean;
  status: string | null;
}

export function findSailing(
  body: SailingsResponse | null,
  sailDate: string
): RawSailing | null {
  return body?.sailings?.find((s) => s.sailDate === sailDate) ?? null;
}

export function availableSailDates(body: SailingsResponse | null): string[] {
  return [
    ...new Set(
      (body?.sailings ?? [])
        .map((s) => s.sailDate)
        .filter((d): d is string => Boolean(d))
    ),
  ].sort();
}

export function roomCodesSeen(body: SailingsResponse | null): string[] {
  const codes = new Set<string>();
  for (const s of body?.sailings ?? []) {
    for (const r of s.rooms ?? []) if (r.code) codes.add(r.code);
  }
  return [...codes].sort();
}

export function toMarketSample(
  sailing: RawSailing,
  currencyCode: string
): MarketSample {
  const prices = emptyPrices();
  const totals = emptyPrices();

  for (const room of sailing.rooms ?? []) {
    const code = room.code?.toUpperCase();
    if (code && code in prices) {
      const id = code as CategoryId;
      if (typeof room.pricing?.amount === "number") prices[id] = room.pricing.amount;
      if (typeof room.pricing?.total === "number") totals[id] = room.pricing.total;
    }
  }

  const values = Object.values(prices).filter((v): v is number => v !== null);

  return {
    currency: currencyCode,
    prices,
    totals,
    cheapest: values.length ? Math.min(...values) : null,
    taxesIncluded: Boolean(sailing.includesTaxesAndFees),
    status: sailing.status ?? null,
  };
}

export function pricesEqual(a: CategoryPrices, b: CategoryPrices): boolean {
  return CATEGORY_IDS.every((id) => a[id] === b[id]);
}
