/**
 * Pakistan payment-institution directory (SBP-aligned categories).
 * Maintainable static list — update REFERENCE_DATE when revising.
 *
 * Wallets / EMI-PSP are NOT labelled as banks.
 * Source framing: State Bank of Pakistan regulated commercial, Islamic,
 * digital, microfinance banks, and electronic money institutions / PSPs.
 */

export const PK_PAYMENT_INSTITUTIONS_REF_DATE = "2026-03-31" as const;

export type PkInstitutionKind =
  | "commercial_bank"
  | "islamic_bank"
  | "digital_bank"
  | "microfinance_bank"
  | "emi_psp";

export type PkPaymentInstitution = {
  id: string;
  name: string;
  kind: PkInstitutionKind;
  /** 4-letter bank code used in PK IBAN positions 5–8 (when applicable). */
  ibanBankCode?: string;
  aliases: string[];
  /** false for wallets / EMI-PSP — UI must not call these “banks”. */
  isBank: boolean;
};

const KIND_LABEL: Record<PkInstitutionKind, string> = {
  commercial_bank: "Commercial bank",
  islamic_bank: "Islamic bank",
  digital_bank: "Digital bank",
  microfinance_bank: "Microfinance bank (MFB)",
  emi_psp: "EMI / PSP (wallet)",
};

export function pkInstitutionKindLabel(kind: PkInstitutionKind): string {
  return KIND_LABEL[kind];
}

/** Other / manual entry — always available. */
export const PK_INSTITUTION_OTHER_ID = "other" as const;

/**
 * Curated directory. Aliases help search; codes align with common PK IBAN prefixes.
 * Not an official SBP dump — revise with REFERENCE_DATE when updating.
 */
export const PK_PAYMENT_INSTITUTIONS: readonly PkPaymentInstitution[] = [
  // —— Commercial banks ——
  { id: "hbl", name: "Habib Bank Limited (HBL)", kind: "commercial_bank", ibanBankCode: "HABB", aliases: ["HBL", "Habib Bank"], isBank: true },
  { id: "ubl", name: "United Bank Limited (UBL)", kind: "commercial_bank", ibanBankCode: "UNIL", aliases: ["UBL", "United Bank"], isBank: true },
  { id: "mcb", name: "MCB Bank Limited", kind: "commercial_bank", ibanBankCode: "MUCB", aliases: ["MCB", "Muslim Commercial Bank"], isBank: true },
  { id: "abl", name: "Allied Bank Limited", kind: "commercial_bank", ibanBankCode: "ABPA", aliases: ["ABL", "Allied Bank"], isBank: true },
  { id: "nbp", name: "National Bank of Pakistan", kind: "commercial_bank", ibanBankCode: "NBPA", aliases: ["NBP"], isBank: true },
  { id: "bafl", name: "Bank Alfalah Limited", kind: "commercial_bank", ibanBankCode: "ALFH", aliases: ["BAFL", "Alfalah"], isBank: true },
  { id: "askari", name: "Askari Bank Limited", kind: "commercial_bank", ibanBankCode: "ASCM", aliases: ["Askari"], isBank: true },
  { id: "bop", name: "The Bank of Punjab", kind: "commercial_bank", ibanBankCode: "BPUN", aliases: ["BOP", "Bank of Punjab"], isBank: true },
  { id: "bok", name: "The Bank of Khyber", kind: "commercial_bank", ibanBankCode: "KHYB", aliases: ["BOK", "Bank of Khyber"], isBank: true },
  { id: "faysal", name: "Faysal Bank Limited", kind: "commercial_bank", ibanBankCode: "FAYS", aliases: ["Faysal", "FBL"], isBank: true },
  { id: "js", name: "JS Bank Limited", kind: "commercial_bank", ibanBankCode: "JSBL", aliases: ["JS Bank", "JSBL"], isBank: true },
  { id: "scb", name: "Standard Chartered Bank (Pakistan)", kind: "commercial_bank", ibanBankCode: "SCBL", aliases: ["SCB", "Standard Chartered"], isBank: true },
  { id: "citi", name: "Citibank N.A. Pakistan", kind: "commercial_bank", ibanBankCode: "CITI", aliases: ["Citi", "Citibank"], isBank: true },
  { id: "samba", name: "Samba Bank Limited", kind: "commercial_bank", ibanBankCode: "SAMB", aliases: ["Samba"], isBank: true },
  { id: "silk", name: "Silkbank Limited", kind: "commercial_bank", ibanBankCode: "SAUD", aliases: ["Silkbank", "Silk"], isBank: true },
  { id: "summit", name: "Summit Bank Limited", kind: "commercial_bank", ibanBankCode: "SUMB", aliases: ["Summit"], isBank: true },
  { id: "soneri", name: "Soneri Bank Limited", kind: "commercial_bank", ibanBankCode: "SONE", aliases: ["Soneri"], isBank: true },
  { id: "habibmetro", name: "Habib Metropolitan Bank", kind: "commercial_bank", ibanBankCode: "MPBL", aliases: ["Habib Metro", "HMB"], isBank: true },
  { id: "baah", name: "Bank Al Habib Limited", kind: "commercial_bank", ibanBankCode: "BAHL", aliases: ["BAHL", "Bank Al Habib", "Al Habib"], isBank: true },
  { id: "hbl_islamic_window", name: "HBL Islamic (window — use HBL IBAN code)", kind: "commercial_bank", ibanBankCode: "HABB", aliases: ["HBL Islamic"], isBank: true },

  // —— Islamic banks ——
  { id: "meezan", name: "Meezan Bank Limited", kind: "islamic_bank", ibanBankCode: "MEZN", aliases: ["Meezan", "MBL"], isBank: true },
  { id: "dubai_islamic", name: "Dubai Islamic Bank Pakistan", kind: "islamic_bank", ibanBankCode: "DUIB", aliases: ["DIB", "Dubai Islamic"], isBank: true },
  { id: "albaraka", name: "Al Baraka Bank (Pakistan)", kind: "islamic_bank", ibanBankCode: "AIIN", aliases: ["Al Baraka", "AlBaraka"], isBank: true },
  { id: "bip", name: "BankIslami Pakistan Limited", kind: "islamic_bank", ibanBankCode: "BKIP", aliases: ["BankIslami", "BIP"], isBank: true },
  { id: "mcb_islamic", name: "MCB Islamic Bank", kind: "islamic_bank", ibanBankCode: "MCIB", aliases: ["MCB Islamic"], isBank: true },

  // —— Digital banks ——
  { id: "masa", name: "Masa Digital Bank", kind: "digital_bank", aliases: ["Masa"], isBank: true },
  { id: "haball", name: "HBL Microfinance / digital brands (verify IBAN with HBL)", kind: "digital_bank", aliases: [], isBank: true },
  { id: "easypaisa_bank", name: "Easypaisa Digital Bank (Telenor Microfinance Bank lineage)", kind: "digital_bank", ibanBankCode: "TMFB", aliases: ["Easypaisa Bank", "EP Digital Bank"], isBank: true },
  { id: "jazzcash_bank", name: "JazzCash Digital Bank (when IBAN issued)", kind: "digital_bank", aliases: ["JazzCash Bank"], isBank: true },
  { id: "rda_digital", name: "Other SBP-licensed digital bank (select Other if unnamed)", kind: "digital_bank", aliases: [], isBank: true },

  // —— Microfinance banks ——
  { id: "khushhali", name: "Khushhali Microfinance Bank", kind: "microfinance_bank", ibanBankCode: "KHYB", aliases: ["Khushhali", "KMBL"], isBank: true },
  { id: "tmfb", name: "Telenor Microfinance Bank", kind: "microfinance_bank", ibanBankCode: "TMFB", aliases: ["TMFB", "Telenor MFB"], isBank: true },
  { id: "ufone_mfb", name: "U Microfinance Bank", kind: "microfinance_bank", aliases: ["U Bank", "Ufone MFB", "UMFB"], isBank: true },
  { id: "apna_mfb", name: "APNA Microfinance Bank", kind: "microfinance_bank", aliases: ["APNA MFB"], isBank: true },
  { id: "advans", name: "Advans Pakistan Microfinance Bank", kind: "microfinance_bank", aliases: ["Advans"], isBank: true },
  { id: "finja_mfb", name: "FINCA Microfinance Bank", kind: "microfinance_bank", aliases: ["FINCA", "FINCA MFB"], isBank: true },
  { id: "nrsp_mfb", name: "NRSP Microfinance Bank", kind: "microfinance_bank", aliases: ["NRSP MFB"], isBank: true },
  { id: "pakoman", name: "Pak Oman Microfinance Bank", kind: "microfinance_bank", aliases: ["Pak Oman MFB"], isBank: true },

  // —— EMI / PSP wallets (NOT banks) ——
  { id: "jazzcash", name: "JazzCash", kind: "emi_psp", aliases: ["Jazz Cash", "Mobilink JazzCash"], isBank: false },
  { id: "easypaisa", name: "Easypaisa", kind: "emi_psp", aliases: ["Easy Paisa", "Telenor Easypaisa"], isBank: false },
  { id: "sadapay", name: "SadaPay", kind: "emi_psp", aliases: ["Sada Pay"], isBank: false },
  { id: "nayapay", name: "NayaPay", kind: "emi_psp", aliases: ["Naya Pay"], isBank: false },
  { id: "bykea_pay", name: "Bykea Pay", kind: "emi_psp", aliases: ["Bykea"], isBank: false },
  { id: "keenu", name: "Keenu", kind: "emi_psp", aliases: [], isBank: false },
  { id: "tag", name: "TAG (HBL Konnect wallet brands — verify)", kind: "emi_psp", aliases: ["HBL Konnect"], isBank: false },
] as const;

export function findPkInstitution(id: string): PkPaymentInstitution | undefined {
  return PK_PAYMENT_INSTITUTIONS.find((x) => x.id === id);
}

export function searchPkInstitutions(query: string): PkPaymentInstitution[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...PK_PAYMENT_INSTITUTIONS];
  return PK_PAYMENT_INSTITUTIONS.filter((inst) => {
    if (inst.name.toLowerCase().includes(q)) return true;
    if (inst.ibanBankCode?.toLowerCase().includes(q)) return true;
    return inst.aliases.some((a) => a.toLowerCase().includes(q));
  });
}

export function institutionDisplayLabel(id: string, otherLabel?: string): string {
  if (id === PK_INSTITUTION_OTHER_ID) return otherLabel?.trim() || "Other";
  const inst = findPkInstitution(id);
  if (!inst) return otherLabel?.trim() || "Unknown institution";
  const kind = pkInstitutionKindLabel(inst.kind);
  return inst.isBank ? `${inst.name}` : `${inst.name} (${kind})`;
}

export function countInstitutionsByKind(): Record<PkInstitutionKind, number> {
  const out: Record<PkInstitutionKind, number> = {
    commercial_bank: 0,
    islamic_bank: 0,
    digital_bank: 0,
    microfinance_bank: 0,
    emi_psp: 0,
  };
  for (const i of PK_PAYMENT_INSTITUTIONS) out[i.kind]++;
  return out;
}
