"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  DollarSign,
  LogOut,
  RefreshCw,
  Search,
  Settings,
  Users,
  XCircle,
  Scissors,
} from "lucide-react";

type Booking = {
  id: number;
  customer_id: string;
  service_id: number;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  created_at: string;
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

type FilterType =
  | "all"
  | "today"
  | "upcoming"
  | "completed"
  | "cancelled";

function getSouthAfricaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatDate(dateString: string) {
  if (!dateString) return "-";

  const date = new Date(`${dateString}T00:00:00`);

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
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

export default function AdminDashboard() {
  const supabase = createClient();

  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [filter, setFilter] = useState<FilterType>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [updatingBooking, setUpdatingBooking] = useState<number | null>(null);

  const [adminName, setAdminName] = useState("Admin");

  async function checkAdminAndLoad() {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/admin/login";
        return;
      }

      const { data: adminUser, error: adminError } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (adminError || !adminUser) {
        await supabase.auth.signOut();
        window.location.href = "/admin/login";
        return;
      }

      setAdminName(
        user.email ? user.email.split("@")[0] : "Admin"
      );

      await loadBookings();
    } catch (error) {
      console.error("Dashboard error:", error);
      alert("Unable to load the dashboard.");
    } finally {
      setLoading(false);
    }
  }

  async function loadBookings() {
    try {
      const { data: bookingData, error: bookingError } = await supabase
        .from("bookings")
        .select(
          `
          id,
          customer_id,
          service_id,
          appointment_date,
          start_time,
          end_time,
          status,
          created_at
        `
        )
        .order("appointment_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (bookingError) {
        console.error("Bookings error:", bookingError);
        throw bookingError;
      }

      const safeBookings = (bookingData || []) as Booking[];

      if (safeBookings.length === 0) {
        setBookings([]);
        return;
      }

      const customerIds = [
        ...new Set(safeBookings.map((booking) => booking.customer_id)),
      ];

      const serviceIds = [
        ...new Set(safeBookings.map((booking) => booking.service_id)),
      ];

      const [{ data: customersData, error: customersError }, { data: servicesData, error: servicesError }] =
        await Promise.all([
          supabase
            .from("customers")
            .select("id, full_name, phone, email")
            .in("id", customerIds),

          supabase
            .from("services")
            .select("id, name, price, duration_minutes")
            .in("id", serviceIds),
        ]);

      if (customersError) {
        console.error("Customers error:", customersError);
        throw customersError;
      }

      if (servicesError) {
        console.error("Services error:", servicesError);
        throw servicesError;
      }

      const customerMap = new Map<string, Customer>();

      (customersData || []).forEach((customer) => {
        customerMap.set(customer.id, customer as Customer);
      });

      const serviceMap = new Map<number, Service>();

      (servicesData || []).forEach((service) => {
        serviceMap.set(service.id, service as Service);
      });

      const combinedBookings: BookingRow[] = safeBookings.map((booking) => ({
        ...booking,
        customer: customerMap.get(booking.customer_id),
        service: serviceMap.get(booking.service_id),
      }));

      setBookings(combinedBookings);
    } catch (error) {
      console.error("Failed to load bookings:", error);
      alert("Failed to load bookings. Please try again.");
    }
  }

  async function refreshDashboard() {
    try {
      setRefreshing(true);
      await loadBookings();
    } finally {
      setRefreshing(false);
    }
  }

  async function updateBookingStatus(
    bookingId: number,
    newStatus: "completed" | "cancelled"
  ) {
    const booking = bookings.find((item) => item.id === bookingId);

    if (!booking) return;

    const action =
      newStatus === "completed" ? "mark this booking as completed" : "cancel this booking";

    const confirmed = window.confirm(
      `Are you sure you want to ${action}?\n\nCustomer: ${
        booking.customer?.full_name || "Unknown customer"
      }\nDate: ${formatDate(booking.appointment_date)}\nTime: ${formatTime(
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
        console.error("Status update error:", error);
        alert("Could not update the booking.");
        return;
      }

      await loadBookings();
    } catch (error) {
      console.error(error);
      alert("Something went wrong while updating the booking.");
    } finally {
      setUpdatingBooking(null);
    }
  }

  async function logout() {
    const confirmed = window.confirm("Are you sure you want to log out?");

    if (!confirmed) return;

    try {
      setLoggingOut(true);

      await supabase.auth.signOut();

      window.location.href = "/admin/login";
    } catch (error) {
      console.error("Logout error:", error);
      alert("Could not log out.");
      setLoggingOut(false);
    }
  }

  useEffect(() => {
    void checkAdminAndLoad();

    const intervalId = window.setInterval(() => {
      void loadBookings();
    }, 10000);

    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = getSouthAfricaToday();

  const stats = useMemo(() => {
    const total = bookings.length;

    const todayBookings = bookings.filter(
      (booking) => booking.appointment_date === today
    );

    const upcoming = bookings.filter(
      (booking) =>
        booking.appointment_date >= today &&
        booking.status !== "cancelled" &&
        booking.status !== "completed"
    );

    const completed = bookings.filter(
      (booking) => booking.status === "completed"
    );

    const cancelled = bookings.filter(
      (booking) => booking.status === "cancelled"
    );

    const completedRevenue = completed.reduce(
      (totalAmount, booking) =>
        totalAmount + Number(booking.service?.price || 0),
      0
    );

    return {
      total,
      today: todayBookings.length,
      upcoming: upcoming.length,
      completed: completed.length,
      cancelled: cancelled.length,
      completedRevenue,
    };
  }, [bookings, today]);

  const latestBooking = useMemo(() => {
    if (bookings.length === 0) return null;

    return [...bookings].sort((a, b) =>
      String(b.created_at).localeCompare(String(a.created_at))
    )[0];
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return bookings.filter((booking) => {
      let matchesFilter = true;

      if (filter === "today") {
        matchesFilter = booking.appointment_date === today;
      }

      if (filter === "upcoming") {
        matchesFilter =
          booking.appointment_date >= today &&
          booking.status !== "cancelled" &&
          booking.status !== "completed";
      }

      if (filter === "completed") {
        matchesFilter = booking.status === "completed";
      }

      if (filter === "cancelled") {
        matchesFilter = booking.status === "cancelled";
      }

      if (!matchesFilter) return false;

      if (!search) return true;

      const customerName =
        booking.customer?.full_name?.toLowerCase() || "";

      const phone = booking.customer?.phone?.toLowerCase() || "";

      const email = booking.customer?.email?.toLowerCase() || "";

      const serviceName =
        booking.service?.name?.toLowerCase() || "";

      return (
        customerName.includes(search) ||
        phone.includes(search) ||
        email.includes(search) ||
        serviceName.includes(search)
      );
    });
  }, [bookings, filter, searchTerm, today]);

  function getStatusClasses(status: Booking["status"]) {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-700";

      case "pending":
        return "bg-yellow-100 text-yellow-700";

      case "completed":
        return "bg-blue-100 text-blue-700";

      case "cancelled":
        return "bg-red-100 text-red-700";

      default:
        return "bg-gray-100 text-gray-700";
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-black" />
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      {/* TOP NAVIGATION */}
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
                Admin Dashboard
              </p>
            </div>

            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/admin/dashboard"
                className="rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                Dashboard
              </Link>

              <Link
                href="/admin/services"
                className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                <Settings size={16} />
                Services
              </Link>
              <Link href="/admin/gallery" className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700">Our Work</Link>
              <Link href="/admin/website" className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700">Website</Link>
              <Link href="/admin/calendar" className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700">Calendar</Link>
              <Link href="/admin/customers" className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700">Customers</Link>

              <button
                onClick={logout}
                disabled={loggingOut}
                className="flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                <LogOut size={16} />
                {loggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>

            {/* MOBILE NAV */}
            <div className="flex items-center gap-2 md:hidden">
              <Link
                href="/admin/services"
                className="rounded-xl border border-gray-200 p-2.5 text-gray-700"
                aria-label="Manage services"
              >
                <Settings size={19} />
              </Link>

              <button
                onClick={logout}
                disabled={loggingOut}
                className="rounded-xl border border-red-200 p-2.5 text-red-600 disabled:opacity-50"
                aria-label="Logout"
              >
                <LogOut size={19} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* WELCOME */}
        <div className="mb-8">
          <p className="text-sm font-medium text-gray-500">
            Welcome back
          </p>

          <h2 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
            {adminName}
          </h2>

          <p className="mt-2 text-gray-600">
            Here is what is happening with your bookings.
          </p>
        </div>

        {latestBooking && (
          <section className="mb-8 rounded-3xl border border-green-200 bg-green-50 p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-green-700">Latest booking</p>
                <h3 className="mt-1 text-2xl font-black text-gray-900">
                  {latestBooking.customer?.full_name || "Customer"}
                </h3>
                <p className="mt-1 text-sm text-gray-700">
                  {latestBooking.customer?.phone || "No phone"}
                  {latestBooking.customer?.email ? ` · ${latestBooking.customer.email}` : ""}
                </p>
              </div>
              <div className="grid gap-2 text-sm md:text-right">
                <p><strong>Service:</strong> {latestBooking.service?.name || "Unknown service"}</p>
                <p><strong>Date:</strong> {formatDate(latestBooking.appointment_date)}</p>
                <p><strong>Time:</strong> {formatTime(latestBooking.start_time)} – {formatTime(latestBooking.end_time)}</p>
                <p><strong>Status:</strong> <span className="font-bold capitalize">{latestBooking.status}</span></p>
              </div>
            </div>
          </section>
        )}

        {/* QUICK ACTIONS */}
        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/admin/services"
            className="group flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Management
              </p>

              <h3 className="mt-1 text-lg font-bold">
                Manage Services
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Add, edit or deactivate services
              </p>
            </div>

            <Settings
              size={24}
              className="text-gray-400 transition group-hover:rotate-45 group-hover:text-black"
            />
          </Link>

          <Link href="/admin/calendar" className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div><p className="text-xs font-bold uppercase tracking-wider text-gray-500">Bookings</p><h3 className="mt-1 text-lg font-bold">Calendar</h3><p className="mt-1 text-sm text-gray-500">See today&apos;s reserved chairs</p></div>
            <CalendarDays size={24} />
          </Link>

          <Link href="/admin/customers" className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div><p className="text-xs font-bold uppercase tracking-wider text-gray-500">Customers</p><h3 className="mt-1 text-lg font-bold">Customer details</h3><p className="mt-1 text-sm text-gray-500">Names, phones and booking history</p></div>
            <Users size={24} />
          </Link>

          <Link href="/admin/gallery" className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div><p className="text-xs font-bold uppercase tracking-wider text-gray-500">Website</p><h3 className="mt-1 text-lg font-bold">Our Work</h3><p className="mt-1 text-sm text-gray-500">Add or remove hairstyle photos</p></div>
            <Scissors size={24} />
          </Link>

          <Link href="/admin/website" className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div><p className="text-xs font-bold uppercase tracking-wider text-gray-500">Website</p><h3 className="mt-1 text-lg font-bold">Homepage picture</h3><p className="mt-1 text-sm text-gray-500">Change the main homepage photo</p></div>
            <Settings size={24} />
          </Link>

          <button
            onClick={refreshDashboard}
            disabled={refreshing}
            className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Data
              </p>

              <h3 className="mt-1 text-lg font-bold">
                Refresh Bookings
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Get the latest booking information
              </p>
            </div>

            <RefreshCw
              size={24}
              className={refreshing ? "animate-spin" : ""}
            />
          </button>

          <Link
            href="/booking"
            target="_blank"
            className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:col-span-2 lg:col-span-1"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Customer Website
              </p>

              <h3 className="mt-1 text-lg font-bold">
                Open Booking Page
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                View what your customers see
              </p>
            </div>

            <CalendarDays size={24} />
          </Link>
        </div>

        {/* STATS */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="rounded-xl bg-gray-100 p-2.5">
                <CalendarDays size={20} />
              </div>

              <span className="text-xs font-semibold text-gray-400">
                ALL
              </span>
            </div>

            <p className="mt-5 text-3xl font-black">
              {stats.total}
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Total bookings
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
                <Clock3 size={20} />
              </div>

              <span className="text-xs font-semibold text-blue-500">
                TODAY
              </span>
            </div>

            <p className="mt-5 text-3xl font-black">
              {stats.today}
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Today&apos;s bookings
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="rounded-xl bg-green-50 p-2.5 text-green-600">
                <Users size={20} />
              </div>

              <span className="text-xs font-semibold text-green-500">
                UPCOMING
              </span>
            </div>

            <p className="mt-5 text-3xl font-black">
              {stats.upcoming}
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Upcoming bookings
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">
                <CheckCircle2 size={20} />
              </div>

              <span className="text-xs font-semibold text-indigo-500">
                DONE
              </span>
            </div>

            <p className="mt-5 text-3xl font-black">
              {stats.completed}
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Completed bookings
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="rounded-xl bg-yellow-50 p-2.5 text-yellow-600">
                <DollarSign size={20} />
              </div>

              <span className="text-xs font-semibold text-yellow-600">
                REVENUE
              </span>
            </div>

            <p className="mt-5 text-3xl font-black">
              R{stats.completedRevenue.toFixed(2)}
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Completed services
            </p>
          </div>
        </div>

        {/* BOOKINGS SECTION */}
        <section className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-black">
                  Bookings
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Manage your customer appointments.
                </p>
              </div>

              {/* SEARCH */}
              <div className="relative w-full lg:max-w-sm">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) =>
                    setSearchTerm(event.target.value)
                  }
                  placeholder="Search customer, phone or service..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-black focus:bg-white"
                />
              </div>
            </div>

            {/* FILTERS */}
            <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
              {[
                ["all", "All"],
                ["today", "Today"],
                ["upcoming", "Upcoming"],
                ["completed", "Completed"],
                ["cancelled", "Cancelled"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() =>
                    setFilter(value as FilterType)
                  }
                  className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                    filter === value
                      ? "bg-black text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* MOBILE CARDS */}
          <div className="space-y-3 p-4 md:hidden">
            {filteredBookings.length === 0 ? (
              <div className="rounded-xl bg-gray-50 p-8 text-center">
                <CalendarDays
                  size={32}
                  className="mx-auto text-gray-300"
                />

                <p className="mt-3 font-semibold text-gray-700">
                  No bookings found
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  Try changing your filter or search.
                </p>
              </div>
            ) : (
              filteredBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="rounded-2xl border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold">
                        {booking.customer?.full_name ||
                          "Unknown customer"}
                      </h3>

                      <p className="mt-1 text-sm text-gray-500">
                        {booking.customer?.phone || "No phone"}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${getStatusClasses(
                        booking.status
                      )}`}
                    >
                      {booking.status}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-400">
                        SERVICE
                      </p>

                      <p className="mt-1 font-semibold">
                        {booking.service?.name || "Unknown service"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-400">
                        PRICE
                      </p>

                      <p className="mt-1 font-semibold">
                        R{Number(booking.service?.price || 0).toFixed(2)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-400">
                        DATE
                      </p>

                      <p className="mt-1 font-semibold">
                        {formatDate(booking.appointment_date)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-400">
                        TIME
                      </p>

                      <p className="mt-1 font-semibold">
                        {formatTime(booking.start_time)}
                      </p>
                    </div>
                  </div>

                  {(booking.status === "pending" ||
                    booking.status === "confirmed") && (
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() =>
                          updateBookingStatus(
                            booking.id,
                            "completed"
                          )
                        }
                        disabled={updatingBooking === booking.id}
                        className="flex-1 rounded-xl bg-black px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
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
                        disabled={updatingBooking === booking.id}
                        className="flex-1 rounded-xl border border-red-200 px-3 py-2.5 text-sm font-semibold text-red-600 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* DESKTOP TABLE */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1000px]">
              <thead className="bg-gray-50">
                <tr className="border-b border-gray-200 text-left">
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">
                    Customer
                  </th>

                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">
                    Service
                  </th>

                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">
                    Date
                  </th>

                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">
                    Time
                  </th>

                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">
                    Price
                  </th>

                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">
                    Status
                  </th>

                  <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-16 text-center"
                    >
                      <CalendarDays
                        size={40}
                        className="mx-auto text-gray-300"
                      />

                      <p className="mt-4 font-semibold text-gray-700">
                        No bookings found
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        Try changing your filter or search.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((booking) => (
                    <tr
                      key={booking.id}
                      className="transition hover:bg-gray-50"
                    >
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-bold">
                            {booking.customer?.full_name ||
                              "Unknown customer"}
                          </p>

                          <p className="mt-1 text-sm text-gray-500">
                            {booking.customer?.phone || "No phone"}
                          </p>

                          {booking.customer?.email && (
                            <p className="mt-0.5 text-xs text-gray-400">
                              {booking.customer.email}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-semibold">
                          {booking.service?.name ||
                            "Unknown service"}
                        </p>

                        <p className="mt-1 text-xs text-gray-400">
                          {booking.service?.duration_minutes || 0} min
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-medium">
                          {formatDate(
                            booking.appointment_date
                          )}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-medium">
                          {formatTime(booking.start_time)}
                        </p>

                        <p className="mt-1 text-xs text-gray-400">
                          to {formatTime(booking.end_time)}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-bold">
                          R
                          {Number(
                            booking.service?.price || 0
                          ).toFixed(2)}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold capitalize ${getStatusClasses(
                            booking.status
                          )}`}
                        >
                          {booking.status}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        {(booking.status === "pending" ||
                          booking.status === "confirmed") && (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() =>
                                updateBookingStatus(
                                  booking.id,
                                  "completed"
                                )
                              }
                              disabled={
                                updatingBooking === booking.id
                              }
                              className="flex items-center gap-1.5 rounded-lg bg-black px-3 py-2 text-xs font-bold text-white transition hover:bg-gray-800 disabled:opacity-50"
                            >
                              <CheckCircle2 size={14} />
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
                                updatingBooking === booking.id
                              }
                              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                            >
                              <XCircle size={14} />
                              Cancel
                            </button>
                          </div>
                        )}

                        {booking.status === "completed" && (
                          <div className="flex justify-end">
                            <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
                              <CheckCircle2 size={14} />
                              Completed
                            </span>
                          </div>
                        )}

                        {booking.status === "cancelled" && (
                          <div className="flex justify-end">
                            <span className="flex items-center gap-1 text-xs font-semibold text-red-500">
                              <XCircle size={14} />
                              Cancelled
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* RESULTS FOOTER */}
          <div className="border-t border-gray-200 bg-gray-50 px-5 py-4">
            <div className="flex flex-col gap-2 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing{" "}
                <strong className="text-gray-900">
                  {filteredBookings.length}
                </strong>{" "}
                of{" "}
                <strong className="text-gray-900">
                  {bookings.length}
                </strong>{" "}
                bookings
              </span>

              <span>
                Today:{" "}
                <strong className="text-gray-900">
                  {formatDate(today)}
                </strong>
              </span>
            </div>
          </div>
        </section>

        {/* BOTTOM NAV */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 pb-8">
          <Link
            href="/admin/dashboard"
            className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white"
          >
            Dashboard
          </Link>

          <Link
            href="/admin/services"
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Settings size={17} />
            Manage Services
          </Link>

          <Link
            href="/booking"
            target="_blank"
            className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Customer Booking Page
          </Link>
        </div>
      </div>
    </main>
  );
}