import { parseCsvRows } from "@/lib/csv-rows";

export function parseFreephoneCsv(csv: string) {
  const rows = parseCsvRows(csv, 25, 64_000);
  const headers = rows.shift()?.map((value) => value.trim().toLowerCase());
  if (headers?.length !== 2 || !headers.includes("location name") || !headers.includes("phone number")) {
    throw new Error("Use the CSV columns Location Name and Phone Number.");
  }
  const nameIndex = headers.indexOf("location name");
  const phoneIndex = headers.indexOf("phone number");
  return rows.map((row) => ({
    name: row[nameIndex] ?? "",
    phone: row[phoneIndex] ?? "",
    malformed: row.length !== 2,
  }));
}
