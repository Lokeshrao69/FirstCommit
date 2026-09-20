/**
 * Sensitive-value masking. Mirrors `backend/app/core/masking.py` exactly so
 * the offline mock and the live backend behave identically at the data layer:
 * only the last four digits of a long number survive, and formatted values
 * keep their original layout (e.g. `XXXX XXXX 0123`).
 */

const MIN_SENSITIVE_DIGITS = 9;

/** Mask all but the last four digits of a long number, preserving formatting. */
export function maskNumber(value: unknown): string {
  const text = String(value);
  const digits = text.replace(/\D/g, "");
  if (digits.length < MIN_SENSITIVE_DIGITS) return text;
  const masked = "X".repeat(digits.length - 4) + digits.slice(-4);
  let i = 0;
  return text.replace(/\d/g, () => masked[i++] ?? "");
}

/** Replace long digit runs in source text with bullet placeholders (backend `redact_digits`). */
export function redactDigits(value: unknown, minLength: number = MIN_SENSITIVE_DIGITS): string {
  return String(value).replace(new RegExp(`\\d{${minLength},}`, "g"), (m) => "•".repeat(m.length));
}

/** Per-document-type sensitive fields — mirrors `backend/knowledge/document_types.json`. */
export const SENSITIVE_FIELDS_BY_TYPE: Record<string, string[]> = {
  aadhaar: ["aadhaar_number"],
  income_certificate: ["certificate_number"],
  marks_memo: ["roll_number"],
  bonafide_certificate: ["roll_number"],
  bank_passbook: ["account_number"],
  ration_card: ["ration_card_number"],
  income_self_declaration: [],
};

export function sensitiveFor(type: string | null | undefined): string[] {
  return (type && SENSITIVE_FIELDS_BY_TYPE[type]) || [];
}

/**
 * Display-layer guard: values that look like long identifiers are masked even
 * if a caller forgets to go through the data layer. Idempotent — `X`s and
 * lone bullets are never re-processed in a way that leaks the tail digits.
 */
export function maskSensitiveValue(type: string | null | undefined, key: string, value: unknown): string {
  if (sensitiveFor(type).includes(key)) return maskNumber(value);
  const digits = String(value).replace(/\D/g, "");
  if (digits.length >= MIN_SENSITIVE_DIGITS) return maskNumber(value);
  return String(value);
}