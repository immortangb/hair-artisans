// ============================================================
// HAIR ARTISANS BARBERSHOP BOOKING CONFIGURATION
// ============================================================
//
// Central source of truth for booking rules that are NOT stored
// in the database. Business hours + lunch break are now stored
// in the `business_hours` table (see lib/booking/schedule.ts)
// so the shop owner can edit them from Admin -> Hours without a
// code change.
//
// ============================================================

export const BUSINESS_NAME = "Hair-Artisans Barbershop";

export const BUSINESS_TIMEZONE = "Africa/Johannesburg";

export const BOOKING_INTERVAL_MINUTES = 30;

export const BOOKING_WINDOW_DAYS = 60;

// A client must pay at least this percentage of the service price
// as a deposit to confirm a booking. They can also choose to pay
// the full price up front instead.
export const MINIMUM_DEPOSIT_PERCENTAGE = 0.3;

// ============================================================
// TIME HELPERS
// ============================================================

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time
    .slice(0, 5)
    .split(":")
    .map(Number);

  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(
    2,
    "0",
  )}`;
}

export function formatTime(time: string): string {
  return minutesToTime(timeToMinutes(time));
}

// ============================================================
// DATE HELPERS
// ============================================================

export function getDayOfWeek(dateString: string): number {
  const date = new Date(`${dateString}T12:00:00`);

  return date.getDay();
}

// ============================================================
// SOUTH AFRICAN DATE
// ============================================================

export function getTodaySouthAfrica(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values: Record<string, string> = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return `${values.year}-${values.month}-${values.day}`;
}

// ============================================================
// DATE OFFSET
// ============================================================

export function getDateOffset(
  dateString: string,
  days: number,
): string {
  const date = new Date(`${dateString}T12:00:00`);

  date.setDate(date.getDate() + days);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// ============================================================
// MONEY HELPERS
// ============================================================

// Rounds to the nearest cent, the same way the database does,
// so the amount shown to the client always matches what gets
// charged.
export function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function getDepositAmount(servicePrice: number): number {
  return roundCurrency(servicePrice * MINIMUM_DEPOSIT_PERCENTAGE);
}