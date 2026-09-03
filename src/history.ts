// ────────────────────────────────────────────────────────────────
// Historial de precios: data/price-history.json
// Cada entrada guarda AMBOS mercados de esa corrida.
// ────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { DATA_DIR, HISTORY_FILE } from "./config.js";
import type { CategoryPrices } from "./parse.js";

export interface MarketRecord {
  currency: string;
  prices: CategoryPrices;
  totals: CategoryPrices;
  cheapest: number | null;
  status: string | null;
  taxesIncluded: boolean;
  bookingLink: string | null;
}

export interface HistoryEntry {
  timestamp: string;
  sailDate: string;
  /** clave de mercado → precios; sólo los que capturaron esa corrida */
  markets: Record<string, MarketRecord>;
}

export function loadHistory(): HistoryEntry[] {
  if (!existsSync(HISTORY_FILE)) return [];
  try {
    const raw = readFileSync(HISTORY_FILE, "utf-8")
      .replace(/^﻿/, "") // BOM que puede meter un editor de Windows
      .trim();
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[]): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(HISTORY_FILE, JSON.stringify(entries, null, 2) + "\n");
}

/** Última corrida (anterior a la actual) con datos de ese mercado. */
export function previousRecordFor(
  history: HistoryEntry[],
  marketKey: string
): MarketRecord | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const rec = history[i]?.markets?.[marketKey];
    if (rec) return rec;
  }
  return null;
}
