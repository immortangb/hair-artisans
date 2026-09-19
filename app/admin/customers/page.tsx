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
  return time.slice(0, 5);
}