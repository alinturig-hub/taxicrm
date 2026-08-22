import { prisma } from "../src/lib/prisma";
import { syncHourlyWeather } from "../src/lib/weather/sync-hourly-weather";

const [from, to] = process.argv.slice(2);

if (!from || !to) {
  console.error(
    "Usage: npx tsx scripts/sync-weather.ts YYYY-MM-DD YYYY-MM-DD",
  );
  process.exit(1);
}

void (async () => {
  try {
    const result = await syncHourlyWeather(from, to);
    console.log(result);
  } finally {
    await prisma.$disconnect();
  }
})();
