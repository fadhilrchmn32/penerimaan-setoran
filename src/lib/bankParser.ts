import * as XLSX from 'xlsx';
import Decimal from 'decimal.js';
import { parseBankDate, parseFormattedNumber, sha256Hex } from './money';

export interface BankColumnMapping {
  postingDateCol: string;
  valueDateCol: string;
  descriptionCol: string;
  referenceCol: string;
  externalTxnIdCol: string;
  debitCol: string;
  creditCol: string;
  signedAmountCol: string;
  directionMode: 'split_debit_credit' | 'signed_amount' | 'amount_plus_type_col';
  directionTypeCol: string;
  runningBalanceCol: string;
  dateFormat: 'dd/MM/yyyy' | 'yyyy-MM-dd' | 'MM/dd/yyyy';
  decimalFormat: 'id' | 'us';
}

export interface ParsedStatementRow {
  row_number: number;
  raw_row: Record<string, unknown>;
  external_txn_id: string | null;
  posting_date: string;
  value_date: string;
  direction: 'credit' | 'debit';
  amount: string;
  running_balance: string | null;
  bank_reference: string | null;
  description: string;
  fingerprint: string;
  validation_error: string | null;
}

export interface ParsedWorkbookSheet {
  headers: string[];
  rows: Record<string, unknown>[];
  fileHash: string;
}

export async function readBankStatementFile(file: File): Promise<ParsedWorkbookSheet> {
  const buffer = await file.arrayBuffer();
  const fileHash = await sha256Hex(buffer);
  const workbook = XLSX.read(buffer, { type: 'array', raw: false });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) {
    throw new Error('Berkas tidak memiliki lembar kerja (sheet) yang dapat dibaca.');
  }
  const sheet = workbook.Sheets[firstSheet];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  const nonEmptyRows = matrix.filter((r) => Array.isArray(r) && r.some((cell) => String(cell ?? '').trim() !== ''));
  if (nonEmptyRows.length < 2) {
    throw new Error('Berkas harus berisi minimal 1 baris header dan 1 baris transaksi.');
  }
  const headers = (nonEmptyRows[0] as unknown[]).map((h, idx) => {
    const label = String(h ?? '').trim();
    return label || `Kolom_${idx + 1}`;
  });
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < nonEmptyRows.length; i++) {
    const rawArr = nonEmptyRows[i] as unknown[];
    const obj: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      obj[h] = rawArr[idx] ?? '';
    });
    rows.push(obj);
  }
  return { headers, rows, fileHash };
}

export function inferDefaultMapping(headers: string[]): BankColumnMapping {
  const findCol = (patterns: RegExp[]) =>
    headers.find((h) => patterns.some((p) => p.test(h.toLowerCase()))) ?? '';

  const debitCol = findCol([/debit/, /keluar/, /tarik/, /^db$/]);
  const creditCol = findCol([/kredit/, /credit/, /masuk/, /setor/, /^cr$/]);
  const signedAmountCol = findCol([/nominal/, /amount/, /jumlah/, /mutasi/]);
  const directionTypeCol = findCol([/tipe/, /jenis/, /dk/, /d\/k/, /dr\/cr/, /type/]);

  let directionMode: BankColumnMapping['directionMode'] = 'split_debit_credit';
  if (!debitCol && !creditCol && signedAmountCol) {
    directionMode = directionTypeCol ? 'amount_plus_type_col' : 'signed_amount';
  }

  return {
    postingDateCol: findCol([/posting/, /tanggal/, /tgl/, /date/]) || headers[0] || '',
    valueDateCol: findCol([/valuta/, /value/, /efektif/, /tanggal/, /tgl/, /date/]) || headers[0] || '',
    descriptionCol: findCol([/ket/, /uraian/, /berita/, /desc/, /narasi/, /memo/]) || headers[1] || '',
    referenceCol: findCol([/ref/, /no\.? ?ref/, /arsip/, /bukti/]),
    externalTxnIdCol: findCol([/id ?transaksi/, /txn ?id/, /trace/, /seq/, /nomor ?jurnal/]),
    debitCol,
    creditCol,
    signedAmountCol,
    directionMode,
    directionTypeCol,
    runningBalanceCol: findCol([/saldo/, /balance/]),
    dateFormat: 'dd/MM/yyyy',
    decimalFormat: 'id',
  };
}

export async function normalizeBankRows(
  fundAccountId: string,
  rawRows: Record<string, unknown>[],
  mapping: BankColumnMapping
): Promise<ParsedStatementRow[]> {
  const out: ParsedStatementRow[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const postingDate = parseBankDate(raw[mapping.postingDateCol], mapping.dateFormat);
    const valueDate = parseBankDate(raw[mapping.valueDateCol] ?? raw[mapping.postingDateCol], mapping.dateFormat);
    const description = String(raw[mapping.descriptionCol] ?? '').trim();
    const reference = mapping.referenceCol ? String(raw[mapping.referenceCol] ?? '').trim() || null : null;
    const extId = mapping.externalTxnIdCol ? String(raw[mapping.externalTxnIdCol] ?? '').trim() || null : null;
    const balanceDec = mapping.runningBalanceCol
      ? parseFormattedNumber(raw[mapping.runningBalanceCol], mapping.decimalFormat)
      : null;

    let direction: 'credit' | 'debit' | null = null;
    let amountDec: Decimal | null = null;
    let err: string | null = null;

    if (mapping.directionMode === 'split_debit_credit') {
      const db = mapping.debitCol ? parseFormattedNumber(raw[mapping.debitCol], mapping.decimalFormat) : null;
      const cr = mapping.creditCol ? parseFormattedNumber(raw[mapping.creditCol], mapping.decimalFormat) : null;
      if (cr && cr.gt(0) && (!db || db.eq(0))) {
        direction = 'credit';
        amountDec = cr;
      } else if (db && db.gt(0) && (!cr || cr.eq(0))) {
        direction = 'debit';
        amountDec = db;
      } else if (cr && cr.gt(0) && db && db.gt(0)) {
        err = 'Baris memiliki nilai Debit dan Kredit sekaligus.';
      } else {
        err = 'Nominal Debit/Kredit kosong atau nol.';
      }
    } else if (mapping.directionMode === 'signed_amount') {
      const amt = parseFormattedNumber(raw[mapping.signedAmountCol], mapping.decimalFormat);
      if (!amt || amt.eq(0)) {
        err = 'Nominal mutasi tidak valid atau nol.';
      } else if (amt.gt(0)) {
        direction = 'credit';
        amountDec = amt;
      } else {
        direction = 'debit';
        amountDec = amt.abs();
      }
    } else {
      const amt = parseFormattedNumber(raw[mapping.signedAmountCol], mapping.decimalFormat);
      const rawType = String(raw[mapping.directionTypeCol] ?? '').trim().toUpperCase();
      if (!amt || amt.eq(0)) {
        err = 'Nominal tidak valid atau nol.';
      } else if (['CR', 'K', 'C', 'CREDIT', 'KREDIT', 'MASUK'].includes(rawType)) {
        direction = 'credit';
        amountDec = amt.abs();
      } else if (['DB', 'D', 'DR', 'DEBIT', 'KELUAR'].includes(rawType)) {
        direction = 'debit';
        amountDec = amt.abs();
      } else {
        err = `Tipe D/K tidak dikenali: "${rawType}"`;
      }
    }

    if (!postingDate || !valueDate) {
      err = err ?? `Format tanggal tidak sesuai (${mapping.dateFormat}).`;
    }

    const finalDir = direction ?? 'credit';
    const finalAmt = amountDec ? amountDec.toFixed(2) : '0.00';
    const finalValDate = valueDate ?? '1970-01-01';
    const fingerprint = await sha256Hex(
      `${fundAccountId}|${finalValDate}|${finalDir}|${finalAmt}|${description}`
    );

    out.push({
      row_number: i + 1,
      raw_row: raw,
      external_txn_id: extId,
      posting_date: postingDate ?? finalValDate,
      value_date: finalValDate,
      direction: finalDir,
      amount: finalAmt,
      running_balance: balanceDec ? balanceDec.toFixed(2) : null,
      bank_reference: reference,
      description,
      fingerprint,
      validation_error: err,
    });
  }

  return out;
}
