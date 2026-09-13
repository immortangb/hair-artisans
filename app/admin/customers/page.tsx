"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Mail,
  Phone,
  RefreshCw,
  Search,
  Scissors,
  User,
  Users,
  XCircle,
  LogOut,
} from "lucide-react";
import Link from "next/link";

type Customer = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  created_at: string;
};

type Booking = {
  id: number;
  customer_id: string;
  service_id: number;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  created_at: string;
};

type Service = {
  id: number;
  name: string;
  price: number;
  duration_minutes: number;
};

type CustomerBooking = Booking & {
  serviceName: string;
  servicePrice: number;
};

type CustomerRow = Customer & {
  bookingCount: number;
  totalValue: number;
  lastAppointment: string | null;
  bookings: CustomerBooking[];
};

export default function CustomersPage() {
  const supabase = createClient();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(
    null
  );

  const [error, setError] = useState("");

  // --------------------------------------------------
  // ADMIN CHECK
  // --------------------------------------------------

  async function checkAdmin() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/admin/login";
      return false;
    }

    const { data: adminUser, error: adminError } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminError || !adminUser) {
      await supabase.auth.signOut();
      window.location.href = "/admin/login";
      return false;
    }

    return true;
  }

  // --------------------------------------------------
  // LOAD DATA
  // --------------------------------------------------

  async function loadCustomers(showRefresh = false) {
    try {
      setError("");

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const isAdmin = await checkAdmin();

      if (!isAdmin) return;

      const [
        { data: customerData, error: customerError },
        { data: bookingData, error: bookingError },
        { data: serviceData, error: serviceError },
      ] = await Promise.all([
        supabase
          .from("customers")
          .select("id, full_name, phone, email, created_at")
          .order("full_name", { ascending: true }),

        // IMPORTANT:
        // payment_status has been removed because it does not exist
        // in your bookings table.
        supabase
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
          .order("appointment_date", { ascending: false })
          .order("start_time", { ascending: false }),

        supabase
          .from("services")
          .select("id, name, price, duration_minutes"),
      ]);

      if (customerError) {
        throw new Error(customerError.message);
      }

      if (bookingError) {
        throw new Error(bookingError.message);
      }

      if (serviceError) {
        throw new Error(serviceError.message);
      }

      setCustomers((customerData || []) as Customer[]);
      setBookings((bookingData || []) as Booking[]);
      setServices((serviceData || []) as Service[]);
    } catch (err) {
      console.error("Customer loading error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading customers."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  // --------------------------------------------------
  // CREATE CUSTOMER ROWS
  // --------------------------------------------------

  const customerRows = useMemo<CustomerRow[]>(() => {
    const serviceMap = new Map<number, Service>();

    services.forEach((service) => {
      serviceMap.set(service.id, service);
    });

    const bookingsByCustomer = new Map<string, Booking[]>();

    bookings.forEach((booking) => {
      const existing = bookingsByCustomer.get(booking.customer_id) || [];

      existing.push(booking);

      bookingsByCustomer.set(booking.customer_id, existing);
    });

    return customers.map((customer) => {
      const customerBookings =
        bookingsByCustomer.get(customer.id) || [];

      const enrichedBookings: CustomerBooking[] =
        customerBookings.map((booking) => {
          const service = serviceMap.get(booking.service_id);

          return {
            ...booking,
            serviceName: service?.name || "Unknown service",
            servicePrice: Number(service?.price || 0),
          };
        });

      // Cancelled bookings are not counted in customer value.
      const activeBookings = enrichedBookings.filter(
        (booking) => booking.status !== "cancelled"
      );

      const totalValue = activeBookings.reduce(
        (total, booking) => total + booking.servicePrice,
        0
      );

      const sortedBookings = [...enrichedBookings].sort((a, b) => {
        const dateA = `${a.appointment_date} ${a.start_time}`;
        const dateB = `${b.appointment_date} ${b.start_time}`;

        return dateB.localeCompare(dateA);
      });

      return {
        ...customer,

        bookingCount: activeBookings.length,

        totalValue,

        lastAppointment:
          sortedBookings.length > 0
            ? sortedBookings[0].appointment_date
            : null,

        bookings: sortedBookings,
      };
    });
  }, [customers, bookings, services]);

  // --------------------------------------------------
  // SEARCH
  // --------------------------------------------------

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return customerRows;
    }

    return customerRows.filter((customer) => {
      return (
        customer.full_name.toLowerCase().includes(query) ||
        customer.phone.toLowerCase().includes(query) ||
        (customer.email || "").toLowerCase().includes(query)
      );
    });
  }, [customerRows, search]);

  // --------------------------------------------------
  // STATISTICS
  // --------------------------------------------------

  const totalCustomers = customerRows.length;

  const customersWithBookings = customerRows.filter(
    (customer) => customer.bookingCount > 0
  ).length;

  const totalBookings = customerRows.reduce(
    (total, customer) => total + customer.bookingCount,
    0
  );

  const totalRevenue = customerRows.reduce(
    (total, customer) => total + customer.totalValue,
    0
  );

  // --------------------------------------------------
  // FORMATTERS
  // --------------------------------------------------

  function formatDate(dateString: string | null) {
    if (!dateString) return "No appointments";

    const date = new Date(`${dateString}T12:00:00`);

    return new Intl.DateTimeFormat("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Africa/Johannesburg",
    }).format(date);
  }

  function formatTime(time: string) {
    return time.substring(0, 5);
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
      minimumFractionDigits: 2,
    }).format(value);
  }

  function statusLabel(status: string) {
    switch (status) {
      case "confirmed":
        return "Confirmed";

      case "pending":
        return "Pending";

      case "completed":
        return "Completed";

      case "cancelled":
        return "Cancelled";

      default:
        return status;
    }
  }

  // --------------------------------------------------
  // TOGGLE CUSTOMER
  // --------------------------------------------------

  function toggleCustomer(id: string) {
    setExpandedCustomer((current) =>
      current === id ? null : id
    );
  }

  // --------------------------------------------------
  // LOGOUT
  // --------------------------------------------------

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/admin/login";
  }

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />

            <p className="text-sm text-zinc-400">
              Loading customer information...
            </p>
          </div>
        </div>
      </main>
    );
  }

  // --------------------------------------------------
  // PAGE
  // --------------------------------------------------

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* TOP NAVIGATION */}

      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <Link
              href="/admin/dashboard"
              className="text-xl font-bold tracking-tight"
            >
              Hair <span className="text-zinc-400">Artisans</span>
            </Link>

            <p className="mt-1 text-xs text-zinc-500">
              Admin Panel
            </p>
          </div>

          <nav className="hidden items-center gap-2 md:flex">
            <Link
              href="/admin/dashboard"
              className="rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
            >
              Dashboard
            </Link>

            <Link
              href="/admin/calendar"
              className="rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
            >
              Calendar
            </Link>

            <Link
              href="/admin/services"
              className="rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
            >
              Services
            </Link>

            <Link
              href="/admin/customers"
              className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-black"
            >
              Customers
            </Link>

            <button
              onClick={logout}
              className="ml-2 rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
            >
              Logout
            </button>
          </nav>

          <div className="flex items-center gap-2 md:hidden">
            <Link
              href="/admin/dashboard"
              className="rounded-lg border border-zinc-800 p-2 text-zinc-300"
            >
              <ArrowLeft size={18} />
            </Link>

            <button
              onClick={logout}
              className="rounded-lg border border-zinc-800 p-2 text-zinc-300"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* CONTENT */}

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* PAGE HEADER */}

        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-sm font-medium uppercase tracking-wider text-zinc-500">
              Customer Management
            </p>

            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Customers
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              View your customers, booking history and the value
              of their appointments.
            </p>
          </div>

          <button
            onClick={() => loadCustomers(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-medium transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={refreshing ? "animate-spin" : ""}
            />

            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* ERROR */}

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            <div className="flex items-start gap-3">
              <XCircle
                size={18}
                className="mt-0.5 shrink-0"
              />

              <div>
                <p className="font-medium">
                  Unable to load customers
                </p>

                <p className="mt-1 text-red-300/80">
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* STAT CARDS */}

        <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800">
              <Users size={20} className="text-zinc-300" />
            </div>

            <p className="text-sm text-zinc-500">
              Total Customers
            </p>

            <p className="mt-1 text-2xl font-bold">
              {totalCustomers}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800">
              <User size={20} className="text-zinc-300" />
            </div>

            <p className="text-sm text-zinc-500">
              Active Customers
            </p>

            <p className="mt-1 text-2xl font-bold">
              {customersWithBookings}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800">
              <CalendarDays
                size={20}
                className="text-zinc-300"
              />
            </div>

            <p className="text-sm text-zinc-500">
              Total Bookings
            </p>

            <p className="mt-1 text-2xl font-bold">
              {totalBookings}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800">
              <Scissors
                size={20}
                className="text-zinc-300"
              />
            </div>

            <p className="text-sm text-zinc-500">
              Booking Value
            </p>

            <p className="mt-1 text-xl font-bold sm:text-2xl">
              {formatCurrency(totalRevenue)}
            </p>
          </div>
        </div>

        {/* SEARCH */}

        <div className="mb-6">
          <div className="relative">
            <Search
              size={19}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
            />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search by customer name, phone or email..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-3.5 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-600"
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
            <span>
              Showing {filteredCustomers.length} of{" "}
              {customerRows.length} customers
            </span>

            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-zinc-300 hover:text-white"
              >
                Clear search
              </button>
            )}
          </div>
        </div>

        {/* CUSTOMER LIST */}

        {filteredCustomers.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
            <Users
              className="mx-auto mb-4 text-zinc-600"
              size={40}
            />

            <h2 className="text-lg font-semibold">
              No customers found
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              {search
                ? "Try searching for a different name, phone number or email."
                : "Customers will appear here once they make a booking."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCustomers.map((customer) => {
              const isExpanded =
                expandedCustomer === customer.id;

              return (
                <div
                  key={customer.id}
                  className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50"
                >
                  {/* CUSTOMER SUMMARY */}

                  <button
                    onClick={() =>
                      toggleCustomer(customer.id)
                    }
                    className="w-full text-left transition hover:bg-zinc-900"
                  >
                    <div className="grid gap-4 p-5 md:grid-cols-[2fr_1.5fr_1fr_1fr_auto] md:items-center">
                      {/* CUSTOMER */}

                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-800">
                          <User
                            size={20}
                            className="text-zinc-400"
                          />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {customer.full_name}
                          </p>

                          <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                            <Phone size={12} />

                            <span>{customer.phone}</span>
                          </div>
                        </div>
                      </div>

                      {/* EMAIL */}

                      <div className="hidden min-w-0 md:block">
                        <div className="flex items-center gap-2 text-sm text-zinc-400">
                          <Mail
                            size={15}
                            className="shrink-0"
                          />

                          <span className="truncate">
                            {customer.email || "No email"}
                          </span>
                        </div>
                      </div>

                      {/* BOOKINGS */}

                      <div>
                        <p className="text-xs text-zinc-500">
                          Bookings
                        </p>

                        <p className="mt-1 font-semibold">
                          {customer.bookingCount}
                        </p>
                      </div>

                      {/* VALUE */}

                      <div>
                        <p className="text-xs text-zinc-500">
                          Total Value
                        </p>

                        <p className="mt-1 font-semibold">
                          {formatCurrency(
                            customer.totalValue
                          )}
                        </p>
                      </div>

                      {/* ARROW */}

                      <div className="hidden md:block">
                        {isExpanded ? (
                          <ChevronUp
                            size={20}
                            className="text-zinc-500"
                          />
                        ) : (
                          <ChevronDown
                            size={20}
                            className="text-zinc-500"
                          />
                        )}
                      </div>
                    </div>

                    {/* MOBILE INFO */}

                    <div className="grid grid-cols-2 gap-4 border-t border-zinc-800/70 px-5 py-4 md:hidden">
                      <div>
                        <p className="text-xs text-zinc-500">
                          Email
                        </p>

                        <p className="mt-1 truncate text-sm text-zinc-300">
                          {customer.email || "No email"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-zinc-500">
                          Last Appointment
                        </p>

                        <p className="mt-1 text-sm text-zinc-300">
                          {formatDate(
                            customer.lastAppointment
                          )}
                        </p>
                      </div>
                    </div>
                  </button>

                  {/* BOOKING HISTORY */}

                  {isExpanded && (
                    <div className="border-t border-zinc-800 bg-black/20 p-5">
                      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <div>
                          <h3 className="font-semibold">
                            Booking History
                          </h3>

                          <p className="mt-1 text-xs text-zinc-500">
                            All appointments for{" "}
                            {customer.full_name}
                          </p>
                        </div>

                        <div className="text-sm text-zinc-400">
                          {customer.bookingCount} active{" "}
                          {customer.bookingCount === 1
                            ? "booking"
                            : "bookings"}
                        </div>
                      </div>

                      {customer.bookings.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center">
                          <CalendarDays
                            className="mx-auto mb-3 text-zinc-600"
                            size={30}
                          />

                          <p className="text-sm text-zinc-500">
                            This customer has no booking
                            history.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {customer.bookings.map(
                            (booking) => {
                              return (
                                <div
                                  key={booking.id}
                                  className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4"
                                >
                                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                                    {/* SERVICE */}

                                    <div className="flex items-start gap-3">
                                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-800">
                                        <Scissors
                                          size={17}
                                          className="text-zinc-400"
                                        />
                                      </div>

                                      <div>
                                        <p className="font-medium">
                                          {
                                            booking.serviceName
                                          }
                                        </p>

                                        <p className="mt-1 text-xs text-zinc-500">
                                          Booking #
                                          {booking.id}
                                        </p>
                                      </div>
                                    </div>

                                    {/* DATE/TIME */}

                                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-400">
                                      <div className="flex items-center gap-2">
                                        <CalendarDays
                                          size={15}
                                        />

                                        <span>
                                          {formatDate(
                                            booking.appointment_date
                                          )}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <Clock size={15} />

                                        <span>
                                          {formatTime(
                                            booking.start_time
                                          )}{" "}
                                          –{" "}
                                          {formatTime(
                                            booking.end_time
                                          )}
                                        </span>
                                      </div>
                                    </div>

                                    {/* PRICE + STATUS */}

                                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                                      <div className="text-left sm:text-right">
                                        <p className="font-semibold">
                                          {formatCurrency(
                                            booking.servicePrice
                                          )}
                                        </p>

                                        <span
                                          className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${
                                            booking.status ===
                                            "confirmed"
                                              ? "bg-emerald-500/10 text-emerald-400"
                                              : booking.status ===
                                                "completed"
                                              ? "bg-blue-500/10 text-blue-400"
                                              : booking.status ===
                                                "pending"
                                              ? "bg-yellow-500/10 text-yellow-400"
                                              : "bg-red-500/10 text-red-400"
                                          }`}
                                        >
                                          {booking.status ===
                                            "completed" && (
                                            <CheckCircle2
                                              size={12}
                                            />
                                          )}

                                          {booking.status ===
                                            "cancelled" && (
                                            <XCircle
                                              size={12}
                                            />
                                          )}

                                          {statusLabel(
                                            booking.status
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* FOOTER */}

        <div className="mt-10 border-t border-zinc-800 pt-6">
          <div className="flex flex-col justify-between gap-4 text-xs text-zinc-600 sm:flex-row sm:items-center">
            <p>Hair Artisans Admin Panel</p>

            <div className="flex gap-4">
              <Link
                href="/admin/dashboard"
                className="transition hover:text-zinc-300"
              >
                Dashboard
              </Link>

              <Link
                href="/admin/calendar"
                className="transition hover:text-zinc-300"
              >
                Calendar
              </Link>

              <Link
                href="/admin/services"
                className="transition hover:text-zinc-300"
              >
                Services
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}