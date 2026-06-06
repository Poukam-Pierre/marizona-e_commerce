/**
 * ISO 4217 currency codes supported by the platform.
 * XAF is the default currency (Central African CFA franc — Cameroon).
 * Extend this enum when adding support for new markets.
 */
export enum Currency {
  // Central & West Africa (primary markets)
  XAF = 'XAF', // Central African CFA franc (Cameroon, Chad, CAR…)
  XOF = 'XOF', // West African CFA franc
  NGN = 'NGN', // Nigerian Naira
  GHS = 'GHS', // Ghanaian Cedi

  // East & Southern Africa
  KES = 'KES', // Kenyan Shilling
  ZAR = 'ZAR', // South African Rand
  TZS = 'TZS', // Tanzanian Shilling
  UGX = 'UGX', // Ugandan Shilling

  // North Africa & Middle East
  MAD = 'MAD', // Moroccan Dirham
  EGP = 'EGP', // Egyptian Pound

  // Major global currencies
  USD = 'USD', // US Dollar
  EUR = 'EUR', // Euro
  GBP = 'GBP', // British Pound
  JPY = 'JPY', // Japanese Yen
  CNY = 'CNY', // Chinese Yuan
}

/** Default currency symbol map (fallback when the DB has no currencySymbol setting). */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  [Currency.XAF]: 'FCFA',
  [Currency.XOF]: 'FCFA',
  [Currency.NGN]: '₦',
  [Currency.GHS]: 'GH₵',
  [Currency.KES]: 'KSh',
  [Currency.ZAR]: 'R',
  [Currency.TZS]: 'TSh',
  [Currency.UGX]: 'USh',
  [Currency.MAD]: 'MAD',
  [Currency.EGP]: 'EGP',
  [Currency.USD]: '$',
  [Currency.EUR]: '€',
  [Currency.GBP]: '£',
  [Currency.JPY]: '¥',
  [Currency.CNY]: '¥',
};
