import assert from "node:assert/strict";
import { test } from "node:test";
import { archiveMaximumDate, syncHourlyWeather } from "./sync-hourly-weather";

test("archive end_date follows the provider boundary, retries once and avoids unavailable ranges", async () => {
  assert.equal(archiveMaximumDate("Parameter 'end_date' is out of allowed range from 1940-01-01 to 2026-10-08"), "2026-10-08");
  assert.equal(archiveMaximumDate("unrelated failure 2026-10-08"), null);
  const original = global.fetch;
  const dates: string[] = [];
  global.fetch = async (input) => {
    const date = new URL(String(input)).searchParams.get("end_date")!;
    dates.push(date);
    return date > "2026-10-08"
      ? new Response(JSON.stringify({error: true, reason: "end_date is out of allowed range from 1940-01-01 to 2026-10-08"}), {status: 400})
      : new Response(JSON.stringify({hourly: {time: []}}));
  };
  try {
    const result = await syncHourlyWeather("2026-10-07", "2026-10-11");
    assert.equal(result.to, "2026-10-08");
    assert.deepEqual(dates, ["2026-10-11", "2026-10-08"]);
    dates.length = 0;
    assert.equal((await syncHourlyWeather("2026-10-11", "2026-10-11")).imported, 0);
    assert.equal(dates.length, 1);
    await assert.rejects(syncHourlyWeather("2026-02-30", "2026-10-11"));
    await assert.rejects(syncHourlyWeather("2026-10-11", "2026-10-08"));
  } finally { global.fetch = original; }
});
