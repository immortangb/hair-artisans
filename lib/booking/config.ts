// ============================================================
// HAIR ARTISAN'S BOOKING CONFIGURATION
// ============================================================
//
// Central source of truth for business hours and booking rules.
//
// Monday + Tuesday = CLOSED
// Wednesday - Sunday = 09:00 - 17:00
// Booking slots = 30 minutes
//
// ============================================================

export const BUSINESS_NAME = "Hair Artisan's";

export const BUSINESS_TIMEZONE = "Africa/Johannesburg";

export const BOOKING_INTERVAL_MINUTES = 30;

export const BOOKING_WINDOW_DAYS = 60;

export type BusinessHours = {
  open: string;
  close: string;
};

export const BUSINESS_HOURS: Record<number, BusinessHours | null> = {
  0: {
    // Sunday
    open: "09:00",
    close: "17:00",
  },

  1: null, // Monday - CLOSED

  2: null, // Tuesday - CLOSED

  3: {
    // Wednesday
    open: "09:00",
    close: "17:00",
  },

  4: {
    // Thursday
    open: "09:00",
    close: "17:00",
  },

  5: {
    // Friday
    open: "09:00",
    close: "17:00",
  },

  6: {
    // Saturday
    open: "09:00",
    close: "17:00",
  },
};

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
  const totalMinutes = timeToMinutes(time);

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;

  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

// ============================================================
// DATE HELPERS
// ============================================================

export function getDayOfWeek(dateString: string): number {
  const date = new Date(`${dateString}T12:00:00`);

  return date.getDay();
}

export function isClosedDay(dateString: string): boolean {
  if (!dateString) {
    return true;
  }

  const day = getDayOfWeek(dateString);

  return BUSINESS_HOURS[day] === null;
}

export function isBookableDate(dateString: string): boolean {
  if (!dateString) {
    return false;
  }

  return !isClosedDay(dateString);
}

export function getBusinessHours(
  dateString: string,
): BusinessHours | null {
  if (!dateString) {
    return null;
  }

  const day = getDayOfWeek(dateString);

  return BUSINESS_HOURS[day] ?? null;
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
// AVAILABLE TIMES
// ============================================================

export function getAvailableTimesForService(
  dateString: string,
  durationMinutes: number,
  bookedTimes: Array<{
    start_time: string;
    end_time: string;
  }>,
): string[] {
  if (!dateString || durationMinutes <= 0) {
    return [];
  }

  const hours = getBusinessHours(dateString);

  if (!hours) {
    return [];
  }

  const openingMinutes = timeToMinutes(hours.open);
  const closingMinutes = timeToMinutes(hours.close);

  const availableTimes: string[] = [];

  for (
    let start = openingMinutes;
    start + durationMinutes <= closingMinutes;
    start += BOOKING_INTERVAL_MINUTES
  ) {
    const end = start + durationMinutes;

    const overlapsExistingBooking = bookedTimes.some((booking) => {
      const existingStart = timeToMinutes(booking.start_time);
      const existingEnd = timeToMinutes(booking.end_time);

      return (
        start < existingEnd &&
        end > existingStart
      );
    });

    if (!overlapsExistingBooking) {
      availableTimes.push(minutesToTime(start));
    }
  }

  return availableTimes;
}

// ============================================================
// CHECK WHETHER A TIME IS STILL AVAILABLE
// ============================================================

export function isTimeStillAvailable(
  dateString: string,
  startTime: string,
  durationMinutes: number,
  bookedTimes: Array<{
    start_time: string;
    end_time: string;
  }>,
): boolean {
  if (!dateString || !startTime || durationMinutes <= 0) {
    return false;
  }

  const hours = getBusinessHours(dateString);

  if (!hours) {
    return false;
  }

  const start = timeToMinutes(startTime);
  const end = start + durationMinutes;

  const opening = timeToMinutes(hours.open);
  const closing = timeToMinutes(hours.close);

  if (start < opening || end > closing) {
    return false;
  }

  return !bookedTimes.some((booking) => {
    const existingStart = timeToMinutes(booking.start_time);
    const existingEnd = timeToMinutes(booking.end_time);

    return (
      start < existingEnd &&
      end > existingStart
    );
  });
}