// ============================================================
// DYNAMIC BUSINESS HOURS + LUNCH BREAK
// ============================================================
//
// Business hours used to be hardcoded in this codebase. They are
// now stored in the `business_hours` table so the shop owner can
// change opening times, closed days and the lunch break from
// Admin -> Hours without asking a developer to edit code.
//
// This file fetches that table and turns it into the same kind
// of availability calculations the booking page needs.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BOOKING_INTERVAL_MINUTES,
  formatTime,
  getDayOfWeek,
  minutesToTime,
  timeToMinutes,
} from "@/lib/booking/config";

export type DaySchedule = {
  day_of_week: number; // 0 = Sunday ... 6 = Saturday
  is_open: boolean;
  open_time: string | null; // "10:00:00"
  close_time: string | null; // "17:00:00"
  break_start: string | null; // "12:00:00" or null for no break
  break_end: string | null; // "12:30:00" or null for no break
};

export type WeekSchedule = DaySchedule[];

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function getDayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] ?? "";
}

// Used only until the real schedule has loaded from the database,
// so the page has something sensible to render for a split second.
export const FALLBACK_SCHEDULE: WeekSchedule = [
  { day_of_week: 0, is_open: true, open_time: "10:00", close_time: "17:00", break_start: "12:00", break_end: "12:30" },
  { day_of_week: 1, is_open: false, open_time: null, close_time: null, break_start: null, break_end: null },
  { day_of_week: 2, is_open: false, open_time: null, close_time: null, break_start: null, break_end: null },
  { day_of_week: 3, is_open: true, open_time: "10:00", close_time: "17:00", break_start: "12:00", break_end: "12:30" },
  { day_of_week: 4, is_open: true, open_time: "10:00", close_time: "17:00", break_start: "12:00", break_end: "12:30" },
  { day_of_week: 5, is_open: true, open_time: "10:00", close_time: "17:00", break_start: "12:00", break_end: "12:30" },
  { day_of_week: 6, is_open: true, open_time: "10:00", close_time: "17:00", break_start: "12:00", break_end: "12:30" },
];

export async function fetchBusinessHours(
  supabase: SupabaseClient,
): Promise<WeekSchedule> {
  const { data, error } = await supabase
    .from("business_hours")
    .select("day_of_week, is_open, open_time, close_time, break_start, break_end")
    .order("day_of_week");

  if (error || !data || data.length === 0) {
    console.error("Could not load business hours, using fallback:", error);
    return FALLBACK_SCHEDULE;
  }

  return data as WeekSchedule;
}

export function getScheduleForDate(
  schedule: WeekSchedule,
  dateString: string,
): DaySchedule | null {
  if (!dateString) {
    return null;
  }

  const day = getDayOfWeek(dateString);

  return schedule.find((entry) => entry.day_of_week === day) ?? null;
}

export function isClosedDay(
  schedule: WeekSchedule,
  dateString: string,
): boolean {
  const day = getScheduleForDate(schedule, dateString);

  return !day || !day.is_open || !day.open_time || !day.close_time;
}

export function isBookableDate(
  schedule: WeekSchedule,
  dateString: string,
): boolean {
  if (!dateString) {
    return false;
  }

  return !isClosedDay(schedule, dateString);
}

// True when [start, start+duration) overlaps the day's lunch break.
function overlapsBreak(
  day: DaySchedule,
  startMinutes: number,
  endMinutes: number,
): boolean {
  if (!day.break_start || !day.break_end) {
    return false;
  }

  const breakStart = timeToMinutes(day.break_start);
  const breakEnd = timeToMinutes(day.break_end);

  return startMinutes < breakEnd && endMinutes > breakStart;
}

export function getAvailableTimesForService(
  schedule: WeekSchedule,
  dateString: string,
  durationMinutes: number,
  bookedTimes: Array<{ start_time: string; end_time: string }>,
): string[] {
  if (!dateString || durationMinutes <= 0) {
    return [];
  }

  const day = getScheduleForDate(schedule, dateString);

  if (!day || !day.is_open || !day.open_time || !day.close_time) {
    return [];
  }

  const openingMinutes = timeToMinutes(day.open_time);
  const closingMinutes = timeToMinutes(day.close_time);

  const availableTimes: string[] = [];

  for (
    let start = openingMinutes;
    start + durationMinutes <= closingMinutes;
    start += BOOKING_INTERVAL_MINUTES
  ) {
    const end = start + durationMinutes;

    if (overlapsBreak(day, start, end)) {
      continue;
    }

    const overlapsExistingBooking = bookedTimes.some((booking) => {
      const existingStart = timeToMinutes(booking.start_time);
      const existingEnd = timeToMinutes(booking.end_time);

      return start < existingEnd && end > existingStart;
    });

    if (!overlapsExistingBooking) {
      availableTimes.push(minutesToTime(start));
    }
  }

  return availableTimes;
}

export function isTimeStillAvailable(
  schedule: WeekSchedule,
  dateString: string,
  startTime: string,
  durationMinutes: number,
  bookedTimes: Array<{ start_time: string; end_time: string }>,
): boolean {
  if (!dateString || !startTime || durationMinutes <= 0) {
    return false;
  }

  const day = getScheduleForDate(schedule, dateString);

  if (!day || !day.is_open || !day.open_time || !day.close_time) {
    return false;
  }

  const start = timeToMinutes(startTime);
  const end = start + durationMinutes;

  const opening = timeToMinutes(day.open_time);
  const closing = timeToMinutes(day.close_time);

  if (start < opening || end > closing) {
    return false;
  }

  if (overlapsBreak(day, start, end)) {
    return false;
  }

  return !bookedTimes.some((booking) => {
    const existingStart = timeToMinutes(booking.start_time);
    const existingEnd = timeToMinutes(booking.end_time);

    return start < existingEnd && end > existingStart;
  });
}

// Human-friendly single line for a day, e.g. "10:00 - 17:00 (lunch 12:00 - 12:30)".
export function formatDaySummary(day: DaySchedule | null): string {
  if (!day || !day.is_open || !day.open_time || !day.close_time) {
    return "Closed";
  }

  const base = `${formatTime(day.open_time)} - ${formatTime(day.close_time)}`;

  if (day.break_start && day.break_end) {
    return `${base} (lunch ${formatTime(day.break_start)} - ${formatTime(day.break_end)})`;
  }

  return base;
}