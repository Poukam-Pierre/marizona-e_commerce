import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Currency, CURRENCY_SYMBOLS } from '@ecommerce-platform/types';

export interface CurrencyConfig {
  code: string;
  symbol: string;
}

/** Safely parse a setting value that may be JSON-encoded ("XAF") or plain (XAF). */
function parseSettingString(value: string, fallback: string): string {
  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === 'string' ? parsed : fallback;
  } catch {
    return value || fallback;
  }
}

/**
 * Centralised currency service.
 *
 * Reads the `currency` and `currencySymbol` keys from the `settings` table and
 * provides a single `format()` helper so every price rendered in the backend is
 * always consistent with what the admin has configured.
 *
 * Results are cached for 5 minutes to avoid hammering the DB on every price
 * format call. Use `invalidateCache()` after updating currency settings.
 */
@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  private cache: (CurrencyConfig & { cachedAt: number }) | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the active currency code and symbol from settings (cached).
   * Falls back to XAF / FCFA when the settings table is empty.
   */
  async getConfig(): Promise<CurrencyConfig> {
    const now = Date.now();
    if (this.cache && now - this.cache.cachedAt < this.CACHE_TTL_MS) {
      return { code: this.cache.code, symbol: this.cache.symbol };
    }

    const [codeSetting, symbolSetting] = await Promise.all([
      this.prisma.setting.findUnique({ where: { key: 'currency' } }),
      this.prisma.setting.findUnique({ where: { key: 'currencySymbol' } }),
    ]);

    const code: string = codeSetting
      ? parseSettingString(codeSetting.value, Currency.XAF)
      : Currency.XAF;

    const symbol: string = symbolSetting
      ? parseSettingString(symbolSetting.value, CURRENCY_SYMBOLS[code] ?? code)
      : (CURRENCY_SYMBOLS[code] ?? code);

    this.cache = { code, symbol, cachedAt: now };
    this.logger.debug(`Currency config loaded from DB: ${code} (${symbol})`);
    return { code, symbol };
  }

  /**
   * Formats a monetary amount using the given ISO 4217 currency code.
   *
   * This is a synchronous helper — callers should resolve the currency code
   * once via `getConfig()` and reuse it for all format calls in the same
   * request, e.g.:
   *
   * ```ts
   * const { code } = await this.currencyService.getConfig();
   * const fmt = (price: number) => this.currencyService.format(price, code);
   * ```
   */
  format(price: number, currencyCode: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
    }).format(price);
  }

  /**
   * Invalidates the in-process cache.
   * Call this after the `currency` or `currencySymbol` settings are updated
   * so the next request picks up the new values immediately.
   */
  invalidateCache(): void {
    this.cache = null;
    this.logger.debug('Currency cache invalidated');
  }
}
