"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LogOut,
  Scissors,
  Settings,
  User,
  XCircle,
} from "lucide-react";

type Booking = {
  id: number;
  customer_id: string;
  service_id: number;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
};

type Customer = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
};

type Service = {
  id: number;
  name: string;
  price: number;
  duration_minutes: number;
};

type BookingRow = Booking & {
  customer?: Customer;
  service?: Service;
};

function getSouthAfricaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatDateLong(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);

  return new Intl.DateTimeFormat("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDateShort(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatTime(time: string) {
  if (!time) return "-";

  const [hourString, minute] = time.split(":");
  const hour = Number(hourString);

  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minute} ${suffix}`;
}

function getDateOffset(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00`);

  date.setDate(date.getDate() + days);

  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function isClosedDay(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);
  const day = date.getDay();

  return day === 1 || day === 2;
}

export default function AdminCalendar() {
  const supabase = createClient();

  const [selectedDate, setSelectedDate] = useState(
    getSouthAfricaToday()
  );

  const [bookings, setBookings] = useState<BookingRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingBooking, setUpdatingBooking] =
    useState<number | null>(null);

  const [loggingOut, setLoggingOut] = useState(false);

  async function checkAdmin() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/admin/login";
        return false;
      }

      const { data: adminUser, error } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error || !adminUser) {
        await supabase.auth.signOut();
        window.location.href = "/admin/login";
        return false;
      }

      return true;
    } catch (error) {
      console.error("Admin check error:", error);
      window.location.href = "/admin/login";
      return false;
    }
  }

  async function loadBookings() {
    try {
      setRefreshing(true);

      const { data: bookingData, error: bookingError } =
        await supabase
          .from("bookings")
          .select(
            `
            id,
            customer_id,
            service_id,
            appointment_date,
            start_time,
            end_time,
            status
          `
          )
          .eq("appointment_date", selectedDate)
          .order("start_time", {
            ascending: true,
          });

      if (bookingError) {
        console.error(bookingError);
        throw bookingError;
      }

      const safeBookings = (bookingData || []) as Booking[];

      if (safeBookings.length === 0) {
        setBookings([]);
        return;
      }

      const customerIds = [
        ...new Set(
          safeBookings.map(
            (booking) => booking.customer_id
          )
        ),
      ];

      const serviceIds = [
        ...new Set(
          safeBookings.map(
            (booking) => booking.service_id
          )
        ),
      ];

      const [
        { data: customersData, error: customersError },
        { data: servicesData, error: servicesError },
      ] = await Promise.all([
        supabase
          .from("customers")
          .select(
            "id, full_name, phone, email"
          )
          .in("id", customerIds),

        supabase
          .from("services")
          .select(
            "id, name, price, duration_minutes"
          )
          .in("id", serviceIds),
      ]);

      if (customersError) {
        throw customersError;
      }

      if (servicesError) {
        throw servicesError;
      }

      const customerMap = new Map<string, Customer>();

      (customersData || []).forEach((customer) => {
        customerMap.set(
          customer.id,
          customer as Customer
        );
      });

      const serviceMap = new Map<number, Service>();

      (servicesData || []).forEach((service) => {
        serviceMap.set(
          service.id,
          service as Service
        );
      });

      const combined: BookingRow[] =
        safeBookings.map((booking) => ({
          ...booking,
          customer: customerMap.get(
            booking.customer_id
          ),
          service: serviceMap.get(
            booking.service_id
          ),
        }));

      setBookings(combined);
    } catch (error) {
      console.error(
        "Failed to load calendar bookings:",
        error
      );

      alert(
        "Could not load the bookings for this date."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    async function initialise() {
      const isAdmin = await checkAdmin();

      if (!isAdmin) return;

      await loadBookings();
    }

    initialise();
  }, []);

  useEffect(() => {
    async function refreshForDate() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      await loadBookings();
    }

    if (!loading) {
      refreshForDate();
    }
  }, [selectedDate]);

  const dayBookings = useMemo(() => {
    return [...bookings].sort((a, b) =>
      a.start_time.localeCompare(b.start_time)
    );
  }, [bookings]);

  const activeBookings = dayBookings.filter(
    (booking) =>
      booking.status === "pending" ||
      booking.status === "confirmed"
  );

  const completedBookings = dayBookings.filter(
    (booking) => booking.status === "completed"
  );

  const cancelledBookings = dayBookings.filter(
    (booking) => booking.status === "cancelled"
  );

  const totalRevenue = dayBookings
    .filter((booking) => booking.status !== "cancelled")
    .reduce(
      (total, booking) =>
        total + Number(booking.service?.price || 0),
      0
    );

  async function updateBookingStatus(
    bookingId: number,
    newStatus: "completed" | "cancelled"
  ) {
    const booking = bookings.find(
      (item) => item.id === bookingId
    );

    if (!booking) return;

    const action =
      newStatus === "completed"
        ? "mark this booking as completed"
        : "cancel this booking";

    const confirmed = window.confirm(
      `Are you sure you want to ${action}?\n\nCustomer: ${
        booking.customer?.full_name ||
        "Unknown customer"
      }\nService: ${
        booking.service?.name ||
        "Unknown service"
      }\nTime: ${formatTime(
        booking.start_time
      )}`
    );

    if (!confirmed) return;

    try {
      setUpdatingBooking(bookingId);

      const { error } = await supabase
        .from("bookings")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookingId);

      if (error) {
        console.error(error);

        alert(
          "Could not update the booking."
        );

        return;
      }

      await loadBookings();
    } catch (error) {
      console.error(error);

      alert(
        "Something went wrong while updating the booking."
      );
    } finally {
      setUpdatingBooking(null);
    }
  }

  async function logout() {
    const confirmed = window.confirm(
      "Are you sure you want to log out?"
    );

    if (!confirmed) return;

    try {
      setLoggingOut(true);

      await supabase.auth.signOut();

      window.location.href = "/admin/login";
    } catch (error) {
      console.error(error);

      alert("Could not log out.");

      setLoggingOut(false);
    }
  }

  function goPreviousDay() {
    setSelectedDate(
      getDateOffset(selectedDate, -1)
    );
  }

  function goNextDay() {
    setSelectedDate(
      getDateOffset(selectedDate, 1)
    );
  }

  function goToday() {
    setSelectedDate(
      getSouthAfricaToday()
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-black" />

          <p className="text-gray-600">
            Loading calendar...
          </p>
        </div>
      </main>
    );
  }

  const closed = isClosedDay(selectedDate);

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-20 items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Scissors size={22} />

                <h1 className="text-xl font-black tracking-tight">
                  HAIR ARTISAN'S BARBERSHOP
                </h1>
              </div>

              <p className="mt-1 text-xs text-gray-500">
                Booking Calendar
              </p>
            </div>

            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/admin/dashboard"
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Dashboard
              </Link>

              <Link
                href="/admin/calendar"
                className="rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white"
              >
                Calendar
              </Link>

              <Link
                href="/admin/services"
                className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Settings size={16} />
                Services
              </Link>

              <button
                onClick={logout}
                disabled={loggingOut}
                className="flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <LogOut size={16} />

                {loggingOut
                  ? "Logging out..."
                  : "Logout"}
              </button>
            </div>

            {/* MOBILE */}
            <div className="flex items-center gap-2 md:hidden">
              <Link
                href="/admin/dashboard"
                className="rounded-xl border border-gray-200 p-2.5"
              >
                <CalendarDays size={19} />
              </Link>

              <Link
                href="/admin/services"
                className="rounded-xl border border-gray-200 p-2.5"
              >
                <Settings size={19} />
              </Link>

              <button
                onClick={logout}
                disabled={loggingOut}
                className="rounded-xl border border-red-200 p-2.5 text-red-600"
              >
                <LogOut size={19} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* PAGE TITLE */}
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-500">
            Appointment schedule
          </p>

          <h2 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
            Booking Calendar
          </h2>

          <p className="mt-2 text-gray-600">
            View and manage your appointments by date.
          </p>
        </div>

        {/* DATE NAVIGATION */}
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <button
              onClick={goPreviousDay}
              className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold hover:bg-gray-50"
            >
              <ArrowLeft size={18} />
              Previous Day
            </button>

            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                Selected Date
              </p>

              <h3 className="mt-1 text-xl font-black sm:text-2xl">
                {formatDateLong(selectedDate)}
              </h3>

              {selectedDate ===
                getSouthAfricaToday() && (
                <span className="mt-2 inline-flex rounded-full bg-black px-3 py-1 text-xs font-bold text-white">
                  TODAY
                </span>
              )}
            </div>

            <button
              onClick={goNextDay}
              className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold hover:bg-gray-50"
            >
              Next Day
              <ArrowRight size={18} />
            </button>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={goToday}
              className="rounded-xl bg-black px-5 py-3 text-sm font-bold text-white hover:bg-gray-800"
            >
              Go to Today
            </button>

            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(event) =>
                  setSelectedDate(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-black sm:w-auto"
              />
            </div>
          </div>
        </section>

        {/* CLOSED DAY */}
        {closed && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <XCircle
              size={32}
              className="mx-auto text-red-500"
            />

            <h3 className="mt-3 text-lg font-black text-red-700">
              Hair Artisan's Barbershop is closed
            </h3>

            <p className="mt-1 text-sm text-red-600">
              Monday and Tuesday are closed days.
              There should be no appointments on this date.
            </p>
          </div>
        )}

        {/* DAILY STATS */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gray-100 p-2.5">
                <CalendarDays size={20} />
              </div>

              <div>
                <p className="text-2xl font-black">
                  {dayBookings.length}
                </p>

                <p className="text-sm text-gray-500">
                  Total bookings
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-green-50 p-2.5 text-green-600">
                <Clock3 size={20} />
              </div>

              <div>
                <p className="text-2xl font-black">
                  {activeBookings.length}
                </p>

                <p className="text-sm text-gray-500">
                  Active bookings
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
                <CheckCircle2 size={20} />
              </div>

              <div>
                <p className="text-2xl font-black">
                  {completedBookings.length}
                </p>

                <p className="text-sm text-gray-500">
                  Completed
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-yellow-50 p-2.5 text-yellow-600">
                <Scissors size={20} />
              </div>

              <div>
                <p className="text-2xl font-black">
                  R{totalRevenue.toFixed(2)}
                </p>

                <p className="text-sm text-gray-500">
                  Daily value
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* SCHEDULE */}
        <section className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-gray-200 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <h2 className="text-xl font-black">
                {formatDateShort(selectedDate)} Schedule
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                {dayBookings.length === 0
                  ? "No appointments booked."
                  : `${dayBookings.length} appointment${
                      dayBookings.length === 1
                        ? ""
                        : "s"
                    } scheduled.`}
              </p>
            </div>

            <button
              onClick={loadBookings}
              disabled={refreshing}
              className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
            >
              <Clock3
                size={17}
                className={
                  refreshing
                    ? "animate-spin"
                    : ""
                }
              />

              Refresh
            </button>
          </div>

          {/* EMPTY STATE */}
          {dayBookings.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <CalendarDays
                size={48}
                className="mx-auto text-gray-300"
              />

              <h3 className="mt-4 text-lg font-bold">
                No bookings for this date
              </h3>

              <p className="mt-2 text-sm text-gray-500">
                The calendar is currently free.
              </p>

              {!closed && (
                <Link
                  href="/booking"
                  target="_blank"
                  className="mt-5 inline-flex rounded-xl bg-black px-5 py-3 text-sm font-bold text-white"
                >
                  Open Booking Page
                </Link>
              )}
            </div>
          ) : (
            <>
              {/* DESKTOP TIMELINE */}
              <div className="hidden md:block">
                <div className="divide-y divide-gray-100">
                  {dayBookings.map(
                    (booking) => (
                      <div
                        key={booking.id}
                        className="grid grid-cols-[150px_1fr_auto] items-center gap-6 px-6 py-5 transition hover:bg-gray-50"
                      >
                        {/* TIME */}
                        <div>
                          <p className="text-lg font-black">
                            {formatTime(
                              booking.start_time
                            )}
                          </p>

                          <p className="mt-1 text-xs text-gray-400">
                            until{" "}
                            {formatTime(
                              booking.end_time
                            )}
                          </p>
                        </div>

                        {/* CUSTOMER */}
                        <div className="flex items-center gap-4">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100">
                            <User size={20} />
                          </div>

                          <div>
                            <p className="font-bold">
                              {booking.customer
                                ?.full_name ||
                                "Unknown customer"}
                            </p>

                            <p className="mt-1 text-sm text-gray-500">
                              {booking.service
                                ?.name ||
                                "Unknown service"}
                            </p>

                            <p className="mt-1 text-xs text-gray-400">
                              {booking.customer
                                ?.phone ||
                                "No phone number"}
                            </p>
                          </div>
                        </div>

                        {/* ACTIONS */}
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-bold">
                              R
                              {Number(
                                booking.service
                                  ?.price || 0
                              ).toFixed(2)}
                            </p>

                            <span
                              className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-bold capitalize ${
                                booking.status ===
                                "confirmed"
                                  ? "bg-green-100 text-green-700"
                                  : booking.status ===
                                    "pending"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : booking.status ===
                                    "completed"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {booking.status}
                            </span>
                          </div>

                          {(booking.status ===
                            "pending" ||
                            booking.status ===
                              "confirmed") && (
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  updateBookingStatus(
                                    booking.id,
                                    "completed"
                                  )
                                }
                                disabled={
                                  updatingBooking ===
                                  booking.id
                                }
                                className="rounded-lg bg-black px-3 py-2 text-xs font-bold text-white hover:bg-gray-800 disabled:opacity-50"
                              >
                                Complete
                              </button>

                              <button
                                onClick={() =>
                                  updateBookingStatus(
                                    booking.id,
                                    "cancelled"
                                  )
                                }
                                disabled={
                                  updatingBooking ===
                                  booking.id
                                }
                                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* MOBILE TIMELINE */}
              <div className="space-y-3 p-4 md:hidden">
                {dayBookings.map(
                  (booking) => (
                    <div
                      key={booking.id}
                      className="rounded-2xl border border-gray-200 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Clock3
                              size={17}
                              className="text-gray-400"
                            />

                            <p className="text-lg font-black">
                              {formatTime(
                                booking.start_time
                              )}
                            </p>
                          </div>

                          <p className="mt-1 text-xs text-gray-400">
                            until{" "}
                            {formatTime(
                              booking.end_time
                            )}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${
                            booking.status ===
                            "confirmed"
                              ? "bg-green-100 text-green-700"
                              : booking.status ===
                                "pending"
                              ? "bg-yellow-100 text-yellow-700"
                              : booking.status ===
                                "completed"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {booking.status}
                        </span>
                      </div>

                      <div className="mt-4 border-t border-gray-100 pt-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                            <User size={18} />
                          </div>

                          <div>
                            <p className="font-bold">
                              {booking.customer
                                ?.full_name ||
                                "Unknown customer"}
                            </p>

                            <p className="text-sm text-gray-500">
                              {booking.customer
                                ?.phone ||
                                "No phone number"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                              Service
                            </p>

                            <p className="mt-1 text-sm font-semibold">
                              {booking.service
                                ?.name ||
                                "Unknown service"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                              Price
                            </p>

                            <p className="mt-1 text-sm font-semibold">
                              R
                              {Number(
                                booking.service
                                  ?.price || 0
                              ).toFixed(2)}
                            </p>
                          </div>
                        </div>

                        {(booking.status ===
                          "pending" ||
                          booking.status ===
                            "confirmed") && (
                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <button
                              onClick={() =>
                                updateBookingStatus(
                                  booking.id,
                                  "completed"
                                )
                              }
                              disabled={
                                updatingBooking ===
                                booking.id
                              }
                              className="rounded-xl bg-black px-3 py-3 text-sm font-bold text-white disabled:opacity-50"
                            >
                              Complete
                            </button>

                            <button
                              onClick={() =>
                                updateBookingStatus(
                                  booking.id,
                                  "cancelled"
                                )
                              }
                              disabled={
                                updatingBooking ===
                                booking.id
                              }
                              className="rounded-xl border border-red-200 px-3 py-3 text-sm font-bold text-red-600 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            </>
          )}
        </section>

        {/* LEGEND */}
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-black">
            Booking Status
          </h3>

          <div className="mt-4 flex flex-wrap gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="h-3 w-3 rounded-full bg-green-500" />
              Confirmed
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className="h-3 w-3 rounded-full bg-yellow-500" />
              Pending
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className="h-3 w-3 rounded-full bg-blue-500" />
              Completed
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              Cancelled
            </div>
          </div>
        </section>

        {/* FOOTER NAV */}
        <div className="flex flex-wrap justify-center gap-3 py-8">
          <Link
            href="/admin/dashboard"
            className="rounded-xl bg-black px-5 py-3 text-sm font-bold text-white"
          >
            Dashboard
          </Link>

          <Link
            href="/admin/services"
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold hover:bg-gray-50"
          >
            <Settings size={17} />
            Manage Services
          </Link>

          <Link
            href="/booking"
            target="_blank"
            className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold hover:bg-gray-50"
          >
            Customer Booking Page
          </Link>
        </div>
      </div>
    </main>
  );
}