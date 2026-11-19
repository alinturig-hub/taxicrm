export type CsvResult = { addresses: string[]; invalid: number; duplicates: number; rows: number };
/** Bounded, RFC-style CSV parser: handles quoted commas and newlines, rejects malformed files. */
export function parseAudienceCsv(text: string): CsvResult {
  if (text.length > 2_000_000) throw new Error('CSV must be under 2 MB.');
  text = text.replace(/^\uFEFF/, '');
  const rows: string[][] = []; let row: string[] = [], field = '', quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; } } else field += c; continue; }
    if (c === '"') { if (field || closed) throw new Error('Malformed CSV quotes.'); quoted = true; }
    else if (c === ',' || c === '\n' || c === '\r') {
      row.push(field); field = ''; closed = false;
      if (c !== ',') { if (c === '\r' && text[i + 1] === '\n') i++; if (row.some(v => v.trim())) rows.push(row); row = []; if (rows.length > 10001) throw new Error('CSV is limited to 10,000 contacts.'); }
    } else { if (closed) throw new Error('Malformed CSV quotes.'); field += c; }
  }
  if (quoted) throw new Error('Unclosed CSV quote.');
  row.push(field); if (row.some(v => v.trim())) rows.push(row);
  if (rows.length > 10001) throw new Error('CSV is limited to 10,000 contacts.');
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
