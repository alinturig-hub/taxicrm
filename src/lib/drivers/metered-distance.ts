export function meteredDistance(bookings: Array<{ status: string; meterDistanceMetres: number | null }>) {
 const completed = bookings.filter(b => b.status === "COMPLETED");
 const valid = completed.filter(b => b.meterDistanceMetres !== null && Number.isFinite(b.meterDistanceMetres) && b.meterDistanceMetres > 0);
 const metres = valid.reduce((sum, b) => sum + b.meterDistanceMetres!, 0);
 return { miles: valid.length ? Math.round(metres / 1609.344 * 100) / 100 : null, measuredJobs: valid.length, completedJobs: completed.length, zeroOrMissingJobs: completed.length - valid.length };
}
