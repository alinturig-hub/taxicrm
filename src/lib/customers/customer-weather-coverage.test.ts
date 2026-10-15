import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCustomerWeatherIntelligence, buildWeatherCoverageIndex, countWeatherMatchedBookings } from './customer-weather-intelligence';

test('cached coverage matches full weather analysis across repeated London hours and missing dates', () => {
  const observations = ['2026-10-25T00:00:00Z', '2026-10-25T01:00:00Z', '2026-07-01T12:00:00Z'].map(date => ({ observedAt: new Date(date), temperature: null, apparentTemperature: null, precipitation: null, rain: null, snowfall: null, windSpeed: null, windGusts: null, cloudCover: null, isDay: null, weatherCode: null }));
  const bookings = ['2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z', '2026-10-25T01:45:00Z', '2026-07-01T12:59:00Z', '2026-07-01T13:00:00Z'].map(date => ({ pickupDueTime: new Date(date), bookedAtTime: null }));
  bookings.push({ pickupDueTime: null!, bookedAtTime: new Date('2026-07-01T12:10:00Z') }, { pickupDueTime: null!, bookedAtTime: null });
  const actual = countWeatherMatchedBookings(bookings, buildWeatherCoverageIndex(observations));
  assert.equal(actual, 5);
  assert.equal(actual, buildCustomerWeatherIntelligence(bookings, observations).matchedBookings);
  assert.equal(countWeatherMatchedBookings(bookings, new Set()), 0);
});
