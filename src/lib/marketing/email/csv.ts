import { parseCsvRows } from "@/lib/csv-rows";
export type CsvResult = { addresses: string[]; invalid: number; duplicates: number; rows: number };
export function parseAudienceCsv(text: string): CsvResult {
  const rows = parseCsvRows(text, 10_000, 2_000_000);
  const headers = (rows.shift() || []).map(v => v.trim().toLowerCase());
  const columns = headers.flatMap((v, i) => ['email', 'email address', 'email_address'].includes(v) ? [i] : []);
  if (columns.length !== 1) throw new Error('CSV needs exactly one email column.');
  const addresses: string[] = []; const seen = new Set<string>(); let invalid = 0, duplicates = 0;
  for (const r of rows) { const email = (r[columns[0]] || '').trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) { invalid++; continue; }
    if (seen.has(email)) { duplicates++; continue; } seen.add(email); addresses.push(email);
  }
  return { addresses, invalid, duplicates, rows: rows.length };
}
