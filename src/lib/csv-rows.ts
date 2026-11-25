/** Bounded, RFC-style CSV parser: handles quoted commas and newlines, rejects malformed files. */
export function parseCsvRows(text: string, limit: number, maxLength: number): string[][] {
  if (text.length > maxLength) throw new Error('CSV exceeds its size limit.');
  text = text.replace(/^\uFEFF/, '');
  const rows: string[][] = []; let row: string[] = [], field = '', quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; } } else field += c; continue; }
    if (c === '"') { if (field || closed) throw new Error('Malformed CSV quotes.'); quoted = true; }
    else if (c === ',' || c === '\n' || c === '\r') {
      row.push(field); field = ''; closed = false;
      if (c !== ',') { if (c === '\r' && text[i + 1] === '\n') i++; if (row.some(v => v.trim())) rows.push(row); row = []; if (rows.length > limit + 1) throw new Error(`CSV is limited to ${limit.toLocaleString('en-GB')} data rows.`); }
    } else { if (closed) throw new Error('Malformed CSV quotes.'); field += c; }
  }
  if (quoted) throw new Error('Unclosed CSV quote.');
  row.push(field); if (row.some(v => v.trim())) rows.push(row);
  if (rows.length > limit + 1) throw new Error(`CSV is limited to ${limit.toLocaleString('en-GB')} data rows.`);
  return rows;
}
