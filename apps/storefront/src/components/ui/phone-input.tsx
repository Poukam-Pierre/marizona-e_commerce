'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// Common country codes — Cameroon first as the default
const COUNTRY_CODES = [
  { code: '+237', flag: '🇨🇲', name: 'Cameroon' },
  { code: '+234', flag: '🇳🇬', name: 'Nigeria' },
  { code: '+221', flag: '🇸🇳', name: 'Senegal' },
  { code: '+225', flag: '🇨🇮', name: "Côte d'Ivoire" },
  { code: '+241', flag: '🇬🇦', name: 'Gabon' },
  { code: '+242', flag: '🇨🇬', name: 'Congo' },
  { code: '+243', flag: '🇨🇩', name: 'Congo DR' },
  { code: '+233', flag: '🇬🇭', name: 'Ghana' },
  { code: '+254', flag: '🇰🇪', name: 'Kenya' },
  { code: '+212', flag: '🇲🇦', name: 'Morocco' },
  { code: '+216', flag: '🇹🇳', name: 'Tunisia' },
  { code: '+213', flag: '🇩🇿', name: 'Algeria' },
  { code: '+20',  flag: '🇪🇬', name: 'Egypt' },
  { code: '+27',  flag: '🇿🇦', name: 'South Africa' },
  { code: '+33',  flag: '🇫🇷', name: 'France' },
  { code: '+44',  flag: '🇬🇧', name: 'UK' },
  { code: '+1',   flag: '🇺🇸', name: 'USA / Canada' },
  { code: '+49',  flag: '🇩🇪', name: 'Germany' },
  { code: '+86',  flag: '🇨🇳', name: 'China' },
  { code: '+91',  flag: '🇮🇳', name: 'India' },
] as const;

export const DEFAULT_COUNTRY_CODE = '+237';

/**
 * Splits a full E.164-ish number (e.g. "+237696000000") into
 * [countryCode, localNumber]. Falls back to DEFAULT_COUNTRY_CODE.
 */
export function splitPhone(fullNumber: string): [string, string] {
  if (!fullNumber) return [DEFAULT_COUNTRY_CODE, ''];
  const match = COUNTRY_CODES.find((c) => fullNumber.startsWith(c.code));
  if (match) return [match.code, fullNumber.slice(match.code.length).trim()];
  // May already be a bare local number — keep it
  return [DEFAULT_COUNTRY_CODE, fullNumber.replace(/^\+/, '')];
}

/** Joins code + local number into a single E.164-style string */
export function joinPhone(code: string, local: string): string {
  const digits = local.replace(/\D/g, ''); // strip non-digits
  return digits ? `${code}${digits}` : '';
}

interface PhoneInputProps {
  value: string;                         // full number e.g. "+237696000000"
  onChange: (fullNumber: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function PhoneInput({
  value,
  onChange,
  onBlur,
  placeholder = '6 96 00 00 00',
  disabled = false,
  id,
  className,
}: PhoneInputProps) {
  const [countryCode, localNumber] = splitPhone(value);

  const handleCodeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(joinPhone(e.target.value, localNumber));
  };

  const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow digits, spaces, dashes, parentheses
    const raw = e.target.value.replace(/[^\d\s\-()]/g, '');
    onChange(joinPhone(countryCode, raw));
  };

  return (
    <div className={cn('flex gap-0 rounded-md border border-input overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2', className)}>
      {/* Country code selector */}
      <select
        value={countryCode}
        onChange={handleCodeChange}
        onBlur={onBlur}
        disabled={disabled}
        aria-label="Country code"
        className="bg-muted text-sm px-2 py-2 border-r border-input outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {COUNTRY_CODES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag} {c.code}
          </option>
        ))}
      </select>

      {/* Local number input */}
      <input
        id={id}
        type="tel"
        value={localNumber}
        onChange={handleLocalChange}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  );
}
