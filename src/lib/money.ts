import Decimal from 'decimal.js';

Decimal.set({ rounding: Decimal.ROUND_HALF_UP, precision: 28 });

export function toDecimal(val: string | number | Decimal | null | undefined): Decimal {
  if (val === null || val === undefined || val === '') return new Decimal(0);
  if (val instanceof Decimal) return val;
  return new Decimal(String(val));
}

export function toMoneyString(val: string | number | Decimal | null | undefined): string {
  return toDecimal(val).toFixed(2);
}

export function formatIDR(val: string | number | Decimal | null | undefined): string {
  const dec = toDecimal(val);
  const rounded = dec.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const neg = rounded.isNegative();
  const absStr = rounded.abs().toFixed(0);
  const withThousands = absStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${neg ? '-' : ''}Rp ${withThousands}`;
}

export function formatDateID(isoDate: string | null | undefined): string {
  if (!isoDate) return '-';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function formatDateTimeJakarta(isoTimestamp: string | null | undefined): string {
  if (!isoTimestamp) return '-';
  try {
    const dt = new Date(isoTimestamp);
    const parts = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(dt);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')} WIB`;
  } catch {
    return isoTimestamp;
  }
}

export function todayISOJakarta(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

export function parseFormattedNumber(raw: unknown, decimalFormat: 'id' | 'us'): Decimal | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null;
    return new Decimal(raw);
  }
  let s = String(raw).trim();
  if (!s) return null;
  // Remove currency symbol & spaces
  s = s.replace(/Rp/gi, '').replace(/\s+/g, '');
  // Handle CR/DB suffix or parentheses
  let negative = false;
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (/^-/.test(s)) {
    negative = true;
    s = s.slice(1);
  }
  s = s.replace(/(CR|DB)$/i, '');

  if (decimalFormat === 'id') {
    // 1.250.000,50 -> 1250000.50
    s = s.replace(/\./g, '').replace(/,/g, '.');
  } else {
    // 1,250,000.50 -> 1250000.50
    s = s.replace(/,/g, '');
  }

  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const d = new Decimal(s);
  return negative ? d.neg() : d;
}

export function parseBankDate(raw: unknown, dateFormat: 'dd/MM/yyyy' | 'yyyy-MM-dd' | 'MM/dd/yyyy'): string | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    // Excel serial date
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const dt = new Date(epoch.getTime() + raw * 86400000);
    return dt.toISOString().slice(0, 10);
  }
  const s = String(raw).trim().split(' ')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const parts = s.split(/[/\-.]/);
  if (parts.length !== 3) return null;
  if (dateFormat === 'dd/MM/yyyy') {
    const [d, m, y] = parts;
    if (y.length === 4) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  } else if (dateFormat === 'MM/dd/yyyy') {
    const [m, d, y] = parts;
    if (y.length === 4) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  } else if (dateFormat === 'yyyy-MM-dd') {
    const [y, m, d] = parts;
    if (y.length === 4) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

export async function sha256Hex(data: ArrayBuffer | string): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback deterministic FNV-1a hex for environments without subtle crypto
  let hash = 2166136261;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
