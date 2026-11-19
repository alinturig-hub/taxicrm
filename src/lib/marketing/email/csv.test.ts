import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAudienceCsv } from './csv';
test('CSV handles quotes, newlines, case insensitive duplicates and invalid addresses', () => {
 const result = parseAudienceCsv('\ufeffname,email\r\n"Doe, Jane",Jane@Example.test\r\n"A\nB",jane@example.test\r\nX,invalid\r\n');
 assert.deepEqual(result, { addresses: ['jane@example.test'], duplicates: 1, invalid: 1, rows: 3 });
});
test('CSV rejects malformed, ambiguous or oversized input', () => {
 for (const s of ['name\nabc', 'email,email\na@b.test,b@b.test', 'email\n"broken', 'email\n"a"oops', 'x'.repeat(2000001)]) assert.throws(() => parseAudienceCsv(s));
});
