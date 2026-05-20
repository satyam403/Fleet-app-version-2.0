/**
 * Translation helpers for enum-like values stored as canonical English in
 * state and persisted to the backend (e.g. status, priority, payment_type).
 *
 *   – CALL THESE ONLY FOR DISPLAY.
 *   – NEVER pass their output back into a payload — the raw English value
 *     is the source of truth and what the API expects.
 *
 * Example:
 *   <span>{tStatus(t, wo.status)}</span>     // displayed
 *   await api.post({ status: wo.status })    // sent (still English)
 */

import type { TFunction } from "i18next";

/** Normalize backend status strings → canonical lowercase keys. */
function normStatus(s?: string | null): string {
  return String(s ?? "").toLowerCase().trim().replace(/\s+/g, "_");
}

/**
 * Translate a status value for display.
 * Falls back to the original string if no translation exists.
 */
export function tStatus(t: TFunction, value?: string | null): string {
  if (!value) return "—";
  const key = normStatus(value);
  return t(`status.${key}`, { defaultValue: String(value) });
}

/** Translate a priority value for display. */
export function tPriority(t: TFunction, value?: string | null): string {
  if (!value) return "—";
  const key = String(value).toLowerCase().trim();
  return t(`priority.${key}`, { defaultValue: String(value) });
}

/**
 * Translate a payment-type label for display.
 * Backend stores exact strings ("Cash" | "Credit Card" | "Check" | ...).
 */
export function tPaymentType(t: TFunction, value?: string | null): string {
  if (!value) return "—";
  return t(`paymentType.${value}`, { defaultValue: String(value) });
}

/**
 * Generic safe translator with fallback to the raw value.
 * Use when you have a key path but want to be defensive.
 */
export function tOr(t: TFunction, key: string, fallback: string): string {
  return t(key, { defaultValue: fallback });
}
