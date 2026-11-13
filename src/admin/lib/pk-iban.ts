/**
 * Pakistan IBAN helpers — validate + mask.
 * PK IBAN: PK + 2 check digits + 4-letter bank code + 16-digit BBAN = 24 chars.
 * Never log or persist full IBANs to localStorage / app_state from call sites.
 */

const PK_IBAN_LEN = 24;

/** Strip spaces/dashes; uppercase. */
export function normalizePkIban(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

/** Format as PK00 AAAA #### #### #### #### for display (caller should mask first). */
export function formatPkIbanGroups(iban: string): string {
  const n = normalizePkIban(iban);
  const parts: string[] = [];
  for (let i = 0; i < n.length; i += 4) parts.push(n.slice(i, i + 4));
  return parts.join(" ");
}

/**
 * MOD-97 check (ISO 13616). Returns true only for structurally valid PK IBANs.
 */
export function isValidPkIban(raw: string): boolean {
  const iban = normalizePkIban(raw);
  if (!/^PK[0-9]{2}[A-Z]{4}[0-9]{16}$/.test(iban)) return false;
  if (iban.length !== PK_IBAN_LEN) return false;
  return mod97Valid(iban);
}

function mod97Valid(iban: string): boolean {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let expanded = "";
  for (const ch of rearranged) {
    if (ch >= "A" && ch <= "Z") expanded += String(ch.charCodeAt(0) - 55);
    else expanded += ch;
  }
  // iterative mod 97 for large numbers
  let rem = 0;
  for (const ch of expanded) {
    rem = (rem * 10 + (ch.charCodeAt(0) - 48)) % 97;
  }
  return rem === 1;
}

/**
 * Mask by default: show country + bank code hint + last 4 digits.
 * Example: PK** HABB **** **** **** 1234
 */
export function maskPkIban(raw: string): string {
  const iban = normalizePkIban(raw);
  if (iban.length < 8) return "••••";
  const country = iban.slice(0, 2);
  const bank = iban.slice(4, 8);
  const last4 = iban.slice(-4);
  return `${country}** ${bank} **** **** **** ${last4}`;
}

/** Last 4 for compact tables / export (never full account). */
export function pkIbanLast4(raw: string): string {
  const iban = normalizePkIban(raw);
  return iban.length >= 4 ? iban.slice(-4) : "????";
}

export function pkIbanBankCode(raw: string): string | null {
  const iban = normalizePkIban(raw);
  if (iban.length < 8) return null;
  return iban.slice(4, 8);
}
