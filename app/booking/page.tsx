"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Mail,
  MessageSquare,
  Phone,
  Scissors,
  User,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  BUSINESS_HOURS,
  BUSINESS_NAME,
  BOOKING_INTERVAL_MINUTES,
  BOOKING_WINDOW_DAYS,
  formatTime,
  getBusinessHours,
  getDateOffset,
  getDayOfWeek,
  getTodaySouthAfrica,
  isBookableDate,
  isTimeStillAvailable,
  minutesToTime,
  timeToMinutes,
} from "@/lib/booking/config";

type Service = {
  id: number;
  name: string;
  price: number;
  duration_minutes: number;
};

type BookedTime = {
  start_time: string;
  end_time: string;
};

type BookingStep = 1 | 2 | 3 | 4 | 5;

type BookingResult = {
  success: boolean;
  bookingId?: number;
  message?: string;
};

const SERVICE_IMAGES: Record<string, string> = {
  "chiskop": "/images/gallery/gallery-01.jpeg",
  "fade cut": "/images/gallery/gallery-02.jpeg",
  "low fade": "/images/gallery/gallery-03.jpeg",
  "brush fade": "/images/gallery/gallery-04.jpeg",
  "tapper fade": "/images/gallery/gallery-05.jpeg",
  "brush fade with dye": "/images/gallery/gallery-06.jpeg",
  "low fade with dye": "/images/gallery/gallery-07.jpeg",
  "high top fade with dye": "/images/gallery/gallery-08.jpeg",
  "mohok fade with dye": "/images/gallery/gallery-09.jpeg",
  "tapper fade with dye": "/images/gallery/gallery-10.jpeg",
  "cut and bleach": "/images/gallery/gallery-11.jpeg",
};

const FALLBACK_SERVICE_IMAGES = [
  "/images/gallery/gallery-01.jpeg",
  "/images/gallery/gallery-02.jpeg",
  "/images/gallery/gallery-03.jpeg",
  "/images/gallery/gallery-04.jpeg",
  "/images/gallery/gallery-05.jpeg",
  "/images/gallery/gallery-06.jpeg",
  "/images/gallery/gallery-07.jpeg",
  "/images/gallery/gallery-08.jpeg",
  "/images/gallery/gallery-09.jpeg",
  "/images/gallery/gallery-10.jpeg",
  "/images/gallery/gallery-11.jpeg",
  "/images/gallery/gallery-12.jpeg",
  "/images/gallery/gallery-13.jpeg",
  "/images/gallery/gallery-14.jpeg",
];

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatRand(price: number): string {
  return `R${Number(price).toFixed(0)}`;
}

function formatDate(dateString: string): string {
  if (!dateString) {
    return "";
  }

  const date = new Date(`${dateString}T12:00:00`);

  return new Intl.DateTimeFormat("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatShortDate(dateString: string): {
  day: string;
  month: string;
  weekday: string;
} {
  const date = new Date(`${dateString}T12:00:00`);

  return {
    day: new Intl.DateTimeFormat("en-ZA", {
      day: "2-digit",
    }).format(date),
    month: new Intl.DateTimeFormat("en-ZA", {
      month: "short",
    }).format(date),
    weekday: new Intl.DateTimeFormat("en-ZA", {
      weekday: "short",
    }).format(date),
  };
}

function getCurrentMinutesSouthAfrica(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Johannesburg",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const hour = Number(
    parts.find((part) => part.type === "hour")?.value ?? "0"
  );

  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? "0"
  );

  return hour * 60 + minute;
}

function getDateList(): string[] {
  const today = getTodaySouthAfrica();
  const dates: string[] = [];

  for (let offset = 0; offset < BOOKING_WINDOW_DAYS; offset += 1) {
    const date = getDateOffset(today, offset);

    if (isBookableDate(date)) {
      dates.push(date);
    }
  }

  return dates;
}

function getAvailableTimes(
  dateString: string,
  durationMinutes: number,
  bookedTimes: BookedTime[]
): string[] {
  if (!dateString || durationMinutes <= 0) {
    return [];
  }

  const hours = getBusinessHours(dateString);

  if (!hours || !hours.open || !hours.close) {
    return [];
  }

  const openingMinutes = timeToMinutes(hours.open);
  const closingMinutes = timeToMinutes(hours.close);
  const today = getTodaySouthAfrica();

  const currentMinutes =
    dateString === today ? getCurrentMinutesSouthAfrica() : -1;

  const times: string[] = [];

  for (
    let start = openingMinutes;
    start + durationMinutes <= closingMinutes;
    start += BOOKING_INTERVAL_MINUTES
  ) {
    if (dateString === today && start <= currentMinutes) {
      continue;
    }

    const startTime = minutesToTime(start);

    if (
      isTimeStillAvailable(
        dateString,
        startTime,
        durationMinutes,
        bookedTimes
      )
    ) {
      times.push(startTime);
    }
  }

  return times;
}

export default function BookingPage() {
  return (
    <Suspense fallback={<BookingPageFallback />}>
      <BookingPageInner />
    </Suspense>
  );
}

function BookingPageFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf7f2]">
      <p className="text-sm text-[#70695f]">Loading booking page...</p>
    </main>
  );
}

function BookingPageInner() {
  const searchParams = useSearchParams();

  const supabase = useMemo(() => createClient(), []);

  const initialServiceId = searchParams.get("service") ?? "";

  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);

  const [step, setStep] = useState<BookingStep>(1);

  const [selectedServiceId, setSelectedServiceId] =
    useState<string>(initialServiceId);

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");

  const [bookedTimes, setBookedTimes] = useState<BookedTime[]>([]);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] =
    useState<BookingResult | null>(null);

  const [errorMessage, setErrorMessage] = useState("");

  const [visibleDateStart, setVisibleDateStart] = useState(0);

  const dates = useMemo(() => getDateList(), []);

  const selectedService = useMemo(
    () =>
      services.find(
        (service) => String(service.id) === selectedServiceId
      ) ?? null,
    [services, selectedServiceId]
  );

  const visibleDates = useMemo(
    () => dates.slice(visibleDateStart, visibleDateStart + 10),
    [dates, visibleDateStart]
  );

  const loadServices = useCallback(async () => {
    setLoadingServices(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("services")
      .select("id, name, price, duration_minutes")
      .eq("active", true)
      .order("sort_order");

    if (error) {
      console.error("Could not load services:", error);
      setErrorMessage("We could not load the services. Please try again.");
      setLoadingServices(false);
      return;
    }

    setServices((data ?? []) as Service[]);
    setLoadingServices(false);
  }, [supabase]);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  const loadAvailability = useCallback(
    async (dateString: string) => {
      if (!dateString || !selectedService) {
        setBookedTimes([]);
        setAvailableTimes([]);
        return;
      }

      setLoadingAvailability(true);

      const { data, error } = await supabase.rpc("get_booked_times", {
        p_appointment_date: dateString,
      });

      if (error) {
        console.error("Could not load availability:", error);
        setBookedTimes([]);
        setAvailableTimes([]);
        setLoadingAvailability(false);
        setErrorMessage(
          "We could not load availability. Please refresh and try again."
        );
        return;
      }

      const bookings = Array.isArray(data)
        ? (data as BookedTime[])
        : [];

      setBookedTimes(bookings);

      const times = getAvailableTimes(
        dateString,
        selectedService.duration_minutes,
        bookings
      );

      setAvailableTimes(times);
      setLoadingAvailability(false);

      if (selectedTime && !times.includes(selectedTime)) {
        setSelectedTime("");
      }
    },
    [selectedService, selectedTime, supabase]
  );

  useEffect(() => {
    if (!selectedDate || !selectedService) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadAvailability(selectedDate);
    }, 0);

    const intervalId = window.setInterval(() => {
      void loadAvailability(selectedDate);
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [loadAvailability, selectedDate, selectedService]);

  const handleServiceSelect = (service: Service) => {
    setSelectedServiceId(String(service.id));
    setSelectedDate("");
    setSelectedTime("");
    setAvailableTimes([]);
    setBookedTimes([]);
    setErrorMessage("");
    setStep(2);
  };

  const handleDateSelect = (date: string) => {
    if (!isBookableDate(date)) {
      return;
    }

    setSelectedDate(date);
    setSelectedTime("");
    setAvailableTimes([]);
    setErrorMessage("");
    setStep(3);
  };

  const handleTimeSelect = (time: string) => {
    if (!availableTimes.includes(time)) {
      return;
    }

    setSelectedTime(time);
    setErrorMessage("");
    setStep(4);
  };

  const validateDetails = (): boolean => {
    const trimmedName = fullName.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();

    if (trimmedName.length < 2) {
      setErrorMessage("Please enter your full name.");
      return false;
    }

    if (trimmedPhone.length < 7) {
      setErrorMessage("Please enter a valid phone number.");
      return false;
    }

    if (
      trimmedEmail.length > 0 &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
    ) {
      setErrorMessage("Please enter a valid email address.");
      return false;
    }

    if (!selectedService) {
      setErrorMessage("Please select a service.");
      return false;
    }

    if (!selectedDate) {
      setErrorMessage("Please select a date.");
      return false;
    }

    if (!selectedTime) {
      setErrorMessage("Please select a time.");
      return false;
    }

    setErrorMessage("");
    return true;
  };

  const handleDetailsContinue = () => {
    if (!validateDetails()) {
      return;
    }

    setStep(5);
  };

  const handleConfirmBooking = async () => {
    if (!selectedService || !selectedDate || !selectedTime) {
      setErrorMessage("Please complete all booking details.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const { data, error } = await supabase.rpc(
        "create_hair_artisans_booking",
        {
          p_full_name: fullName.trim(),
          p_phone: phone.trim(),
          p_email: email.trim() || null,
          p_notes: notes.trim() || null,
          p_service_id: selectedService.id,
          p_appointment_date: selectedDate,
          p_start_time: selectedTime,
        }
      );

      if (error) {
        console.error("Booking error:", error);

        setErrorMessage(
          error.message?.toLowerCase().includes("available")
            ? "That time is no longer available. Please choose another time."
            : "We could not complete your booking. Please try again."
        );

        await loadAvailability(selectedDate);
        setStep(3);
        return;
      }

      const rawId =
        typeof data === "object" &&
        data !== null &&
        "id" in data
          ? data.id
          : data;

      const bookingId = Number(rawId);

      if (!Number.isFinite(bookingId) || bookingId <= 0) {
        console.error("Unexpected booking response:", data);

        setErrorMessage(
          "Your booking may have been created, but we could not retrieve the booking number. Please contact the shop."
        );

        return;
      }

      setBookingResult({
        success: true,
        bookingId,
      });
    } catch (error) {
      console.error("Unexpected booking error:", error);

      setErrorMessage(
        "Something went wrong while creating your booking. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => {
    setErrorMessage("");

    if (step === 2) {
      setStep(1);
      return;
    }

    if (step === 3) {
      setStep(2);
      return;
    }

    if (step === 4) {
      setStep(3);
      return;
    }

    if (step === 5) {
      setStep(4);
    }
  };

  const resetBooking = () => {
    setSelectedServiceId("");
    setSelectedDate("");
    setSelectedTime("");
    setBookedTimes([]);
    setAvailableTimes([]);
    setFullName("");
    setPhone("");
    setEmail("");
    setNotes("");
    setBookingResult(null);
    setErrorMessage("");
    setStep(1);
  };

  if (bookingResult?.success) {
    return (
      <main className="min-h-screen bg-[#f7f5f0] text-[#1c1b19]">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-5 py-16">
          <div className="w-full rounded-3xl border border-[#ded9cf] bg-white p-8 text-center shadow-sm sm:p-12">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#efe7d5]">
              <CheckCircle2 className="h-10 w-10 text-[#806a40]" />
            </div>

            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#806a40]">
              Booking confirmed
            </p>

            <h1 className="mb-4 text-3xl font-semibold sm:text-4xl">
              You&apos;re booked!
            </h1>

            <p className="mx-auto mb-8 max-w-xl leading-7 text-[#66615a]">
              Thanks, {fullName.trim()}. Your appointment at{" "}
              {BUSINESS_NAME} has been booked successfully.
            </p>

            <div className="mx-auto mb-8 max-w-md rounded-2xl border border-[#ded9cf] bg-[#faf9f6] p-6 text-left">
              <div className="mb-5 flex items-center justify-between border-b border-[#e4e0d8] pb-4">
                <span className="text-sm text-[#77716a]">
                  Booking number
                </span>

                <span className="font-semibold">
                  HA-{bookingResult.bookingId}
                </span>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Scissors className="mt-0.5 h-5 w-5 shrink-0 text-[#806a40]" />

                  <div>
                    <p className="text-xs uppercase tracking-wide text-[#88827a]">
                      Service
                    </p>
                    <p className="font-medium">
                      {selectedService?.name}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-[#806a40]" />

                  <div>
                    <p className="text-xs uppercase tracking-wide text-[#88827a]">
                      Date
                    </p>
                    <p className="font-medium">
                      {formatDate(selectedDate)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-[#806a40]" />

                  <div>
                    <p className="text-xs uppercase tracking-wide text-[#88827a]">
                      Time
                    </p>
                    <p className="font-medium">
                      {formatTime(selectedTime)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <p className="mb-8 text-sm leading-6 text-[#77716a]">
              Please arrive a few minutes before your appointment.
              If you need to make a change, contact the shop directly.
            </p>

            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/"
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#1c1b19] px-6 font-medium text-white transition hover:bg-[#34312d]"
              >
                Back to home
              </Link>

              <button
                type="button"
                onClick={resetBooking}
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#d5d0c7] bg-white px-6 font-medium text-[#1c1b19] transition hover:bg-[#f5f2ec]"
              >
                Make another booking
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f5f0] text-[#1c1b19]">
      <header className="border-b border-[#ded9cf] bg-[#f7f5f0]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight"
          >
            {BUSINESS_NAME}
          </Link>

          <Link
            href="/"
            className="text-sm font-medium text-[#66615a] transition hover:text-[#1c1b19]"
          >
            Back to home
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="mb-10 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#806a40]">
            Book your appointment
          </p>

          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            Choose your time. We&apos;ll handle the rest.
          </h1>

          <p className="mx-auto mt-4 max-w-2xl leading-7 text-[#6f6961]">
            Select your service, choose a convenient date and time,
            then enter your details to confirm your appointment.
          </p>
        </div>

        <div className="mb-10">
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            {[
              { number: 1, label: "Service" },
              { number: 2, label: "Date" },
              { number: 3, label: "Time" },
              { number: 4, label: "Details" },
              { number: 5, label: "Confirm" },
            ].map((item, index) => {
              const active = step === item.number;
              const complete = step > item.number;

              return (
                <div
                  key={item.number}
                  className="flex flex-1 items-center"
                >
                  <div className="flex flex-col items-center">
                    <div
                      className={[
                        "flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition",
                        active
                          ? "border-[#1c1b19] bg-[#1c1b19] text-white"
                          : complete
                            ? "border-[#806a40] bg-[#806a40] text-white"
                            : "border-[#d5d0c7] bg-white text-[#8a847c]",
                      ].join(" ")}
                    >
                      {complete ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        item.number
                      )}
                    </div>

                    <span
                      className={[
                        "mt-2 hidden text-xs font-medium sm:block",
                        active || complete
                          ? "text-[#1c1b19]"
                          : "text-[#969087]",
                      ].join(" ")}
                    >
                      {item.label}
                    </span>
                  </div>

                  {index < 4 && (
                    <div
                      className={[
                        "mx-2 h-px flex-1 sm:mx-4",
                        complete
                          ? "bg-[#806a40]"
                          : "bg-[#ddd8cf]",
                      ].join(" ")}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {errorMessage && (
          <div className="mx-auto mb-6 max-w-4xl rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm leading-6 text-red-800">
            {errorMessage}
          </div>
        )}

        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_320px]">
          <section className="min-w-0">
            {step === 1 && (
              <div className="rounded-3xl border border-[#ded9cf] bg-white p-5 shadow-sm sm:p-8">
                <div className="mb-7">
                  <p className="mb-2 text-sm font-medium text-[#806a40]">
                    Step 1 of 5
                  </p>

                  <h2 className="text-2xl font-semibold">
                    Choose your service
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-[#77716a]">
                    Select the haircut or service you&apos;d like to
                    book.
                  </p>
                </div>

                {loadingServices ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[1, 2, 3, 4].map((item) => (
                      <div
                        key={item}
                        className="h-72 animate-pulse rounded-2xl bg-[#efede8]"
                      />
                    ))}
                  </div>
                ) : services.length === 0 ? (
                  <div className="rounded-2xl border border-[#ded9cf] bg-[#faf9f6] p-8 text-center">
                    <Scissors className="mx-auto mb-3 h-8 w-8 text-[#806a40]" />
                    <p className="font-medium">
                      No services are currently available.
                    </p>
                    <p className="mt-2 text-sm text-[#77716a]">
                      Please try again later.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {services.map((service, index) => {
                      const serviceKey = service.name
                        .trim()
                        .toLowerCase();

                      const image =
                        SERVICE_IMAGES[serviceKey] ??
                        FALLBACK_SERVICE_IMAGES[
                          index % FALLBACK_SERVICE_IMAGES.length
                        ];

                      const selected =
                        selectedServiceId === String(service.id);

                      return (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => handleServiceSelect(service)}
                          className={[
                            "group overflow-hidden rounded-2xl border bg-white text-left transition",
                            selected
                              ? "border-[#806a40] ring-2 ring-[#806a40]/20"
                              : "border-[#ded9cf] hover:-translate-y-0.5 hover:border-[#b9aa8c] hover:shadow-md",
                          ].join(" ")}
                        >
                          <div className="relative aspect-[4/3] overflow-hidden bg-[#eeeae2]">
                            <Image
                              src={image}
                              alt={service.name}
                              fill
                              sizes="(max-width: 640px) 100vw, 50vw"
                              className="object-cover transition duration-500 group-hover:scale-105"
                              onError={(event) => {
                                event.currentTarget.src =
                                  "/images/service-default.jpg";
                              }}
                            />

                            {selected && (
                              <div className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#806a40] text-white shadow">
                                <Check className="h-4 w-4" />
                              </div>
                            )}
                          </div>

                          <div className="p-5">
                            <div className="flex items-start justify-between gap-4">
                              <h3 className="font-semibold">
                                {service.name}
                              </h3>

                              <span className="shrink-0 font-semibold text-[#806a40]">
                                {formatRand(service.price)}
                              </span>
                            </div>

                            <div className="mt-3 flex items-center gap-2 text-sm text-[#77716a]">
                              <Clock3 className="h-4 w-4" />
                              <span>
                                {service.duration_minutes} minutes
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="rounded-3xl border border-[#ded9cf] bg-white p-5 shadow-sm sm:p-8">
                <div className="mb-7">
                  <button
                    type="button"
                    onClick={goBack}
                    className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-[#6f6961] transition hover:text-[#1c1b19]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </button>

                  <p className="mb-2 text-sm font-medium text-[#806a40]">
                    Step 2 of 5
                  </p>

                  <h2 className="text-2xl font-semibold">
                    Choose a date
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-[#77716a]">
                    We&apos;re open Wednesday through Sunday, from
                    09:00 to 17:00.
                  </p>
                </div>

                <div className="mb-7 grid grid-cols-2 gap-3 rounded-2xl bg-[#faf9f6] p-4 sm:grid-cols-5">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[#918a81]">
                      Wednesday
                    </p>
                    <p className="mt-1 text-sm font-medium">09:00–17:00</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-[#918a81]">
                      Thursday
                    </p>
                    <p className="mt-1 text-sm font-medium">09:00–17:00</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-[#918a81]">
                      Friday
                    </p>
                    <p className="mt-1 text-sm font-medium">09:00–17:00</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-[#918a81]">
                      Saturday
                    </p>
                    <p className="mt-1 text-sm font-medium">09:00–17:00</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-[#918a81]">
                      Sunday
                    </p>
                    <p className="mt-1 text-sm font-medium">09:00–17:00</p>
                  </div>
                </div>

                <div className="mb-5 flex items-center justify-between">
                  <button
                    type="button"
                    disabled={visibleDateStart === 0}
                    onClick={() =>
                      setVisibleDateStart((current) =>
                        Math.max(0, current - 10)
                      )
                    }
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d8d3ca] bg-white px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Previous
                  </button>

                  <span className="text-sm text-[#77716a]">
                    Available dates
                  </span>

                  <button
                    type="button"
                    disabled={
                      visibleDateStart + 10 >= dates.length
                    }
                    onClick={() =>
                      setVisibleDateStart((current) =>
                        Math.min(
                          Math.max(0, dates.length - 10),
                          current + 10
                        )
                      )
                    }
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d8d3ca] bg-white px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {visibleDates.map((date) => {
                    const dateInfo = formatShortDate(date);
                    const selected = selectedDate === date;
                    const day = getDayOfWeek(date);
                    const today = date === getTodaySouthAfrica();

                    return (
                      <button
                        key={date}
                        type="button"
                        onClick={() => handleDateSelect(date)}
                        disabled={!isBookableDate(date)}
                        className={[
                          "relative rounded-2xl border p-4 text-left transition",
                          selected
                            ? "border-[#806a40] bg-[#806a40] text-white shadow-sm"
                            : "border-[#ded9cf] bg-white hover:border-[#b9aa8c] hover:bg-[#faf9f6]",
                        ].join(" ")}
                      >
                        {today && (
                          <span
                            className={[
                              "absolute right-2 top-2 text-[10px] font-semibold uppercase tracking-wide",
                              selected
                                ? "text-white/80"
                                : "text-[#806a40]",
                            ].join(" ")}
                          >
                            Today
                          </span>
                        )}

                        <span
                          className={[
                            "block text-xs font-medium uppercase",
                            selected
                              ? "text-white/75"
                              : "text-[#918a81]",
                          ].join(" ")}
                        >
                          {DAYS[day]}
                        </span>

                        <span className="mt-1 block text-3xl font-semibold">
                          {dateInfo.day}
                        </span>

                        <span
                          className={[
                            "mt-1 block text-sm",
                            selected
                              ? "text-white/80"
                              : "text-[#77716a]",
                          ].join(" ")}
                        >
                          {dateInfo.month}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {dates.length === 0 && (
                  <div className="rounded-2xl border border-[#ded9cf] bg-[#faf9f6] p-8 text-center">
                    No bookable dates are currently available.
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="rounded-3xl border border-[#ded9cf] bg-white p-5 shadow-sm sm:p-8">
                <div className="mb-7">
                  <button
                    type="button"
                    onClick={goBack}
                    className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-[#6f6961] transition hover:text-[#1c1b19]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </button>

                  <p className="mb-2 text-sm font-medium text-[#806a40]">
                    Step 3 of 5
                  </p>

                  <h2 className="text-2xl font-semibold">
                    Choose a time
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-[#77716a]">
                    Available times for {formatDate(selectedDate)}.
                    Appointments use 30-minute start intervals.
                  </p>
                </div>

                <div className="mb-7 flex flex-wrap gap-3">
                  <div className="inline-flex items-center gap-2 rounded-xl bg-[#faf9f6] px-4 py-3 text-sm">
                    <Scissors className="h-4 w-4 text-[#806a40]" />
                    <span>{selectedService?.name}</span>
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-xl bg-[#faf9f6] px-4 py-3 text-sm">
                    <Clock3 className="h-4 w-4 text-[#806a40]" />
                    <span>
                      {selectedService?.duration_minutes} minutes
                    </span>
                  </div>
                </div>

                {loadingAvailability ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {Array.from({ length: 12 }).map((_, index) => (
                      <div
                        key={index}
                        className="h-12 animate-pulse rounded-xl bg-[#efede8]"
                      />
                    ))}
                  </div>
                ) : availableTimes.length === 0 ? (
                  <div className="rounded-2xl border border-[#ded9cf] bg-[#faf9f6] p-8 text-center">
                    <Clock3 className="mx-auto mb-3 h-8 w-8 text-[#806a40]" />

                    <h3 className="font-semibold">
                      No times available
                    </h3>

                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#77716a]">
                      There are no available appointments for this
                      service on this date. Please choose another date.
                    </p>

                    <button
                      type="button"
                      onClick={goBack}
                      className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#1c1b19] px-5 text-sm font-medium text-white"
                    >
                      Choose another date
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                      {availableTimes.map((time) => {
                        const selected = selectedTime === time;

                        return (
                          <button
                            key={time}
                            type="button"
                            onClick={() => handleTimeSelect(time)}
                            className={[
                              "min-h-12 rounded-xl border px-4 text-sm font-semibold transition",
                              selected
                                ? "border-[#806a40] bg-[#806a40] text-white"
                                : "border-[#d9d4cb] bg-white hover:border-[#806a40] hover:bg-[#faf9f6]",
                            ].join(" ")}
                          >
                            {formatTime(time)}
                          </button>
                        );
                      })}
                    </div>

                    <p className="mt-6 text-xs leading-5 text-[#89837b]">
                      Times are shown in South African time. Times that
                      have already passed today are automatically
                      removed.
                    </p>
                  </>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="rounded-3xl border border-[#ded9cf] bg-white p-5 shadow-sm sm:p-8">
                <div className="mb-7">
                  <button
                    type="button"
                    onClick={goBack}
                    className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-[#6f6961] transition hover:text-[#1c1b19]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </button>

                  <p className="mb-2 text-sm font-medium text-[#806a40]">
                    Step 4 of 5
                  </p>

                  <h2 className="text-2xl font-semibold">
                    Your details
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-[#77716a]">
                    Enter your contact details so we can identify your
                    appointment.
                  </p>
                </div>

                <div className="space-y-5">
                  <div>
                    <label
                      htmlFor="fullName"
                      className="mb-2 block text-sm font-medium"
                    >
                      Full name
                    </label>

                    <div className="relative">
                      <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#969087]" />

                      <input
                        id="fullName"
                        type="text"
                        value={fullName}
                        onChange={(event) =>
                          setFullName(event.target.value)
                        }
                        placeholder="Your full name"
                        autoComplete="name"
                        className="min-h-13 w-full rounded-xl border border-[#d8d3ca] bg-white pl-12 pr-4 outline-none transition placeholder:text-[#aaa49c] focus:border-[#806a40] focus:ring-2 focus:ring-[#806a40]/10"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="phone"
                      className="mb-2 block text-sm font-medium"
                    >
                      Phone number
                    </label>

                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#969087]" />

                      <input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(event) =>
                          setPhone(event.target.value)
                        }
                        placeholder="Your phone number"
                        autoComplete="tel"
                        className="min-h-13 w-full rounded-xl border border-[#d8d3ca] bg-white pl-12 pr-4 outline-none transition placeholder:text-[#aaa49c] focus:border-[#806a40] focus:ring-2 focus:ring-[#806a40]/10"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="email"
                      className="mb-2 block text-sm font-medium"
                    >
                      Email address
                      <span className="ml-2 font-normal text-[#969087]">
                        Optional
                      </span>
                    </label>

                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#969087]" />

                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(event) =>
                          setEmail(event.target.value)
                        }
                        placeholder="you@example.com"
                        autoComplete="email"
                        className="min-h-13 w-full rounded-xl border border-[#d8d3ca] bg-white pl-12 pr-4 outline-none transition placeholder:text-[#aaa49c] focus:border-[#806a40] focus:ring-2 focus:ring-[#806a40]/10"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="notes"
                      className="mb-2 block text-sm font-medium"
                    >
                      Notes
                      <span className="ml-2 font-normal text-[#969087]">
                        Optional
                      </span>
                    </label>

                    <div className="relative">
                      <MessageSquare className="pointer-events-none absolute left-4 top-4 h-5 w-5 text-[#969087]" />

                      <textarea
                        id="notes"
                        value={notes}
                        onChange={(event) =>
                          setNotes(event.target.value)
                        }
                        placeholder="Anything we should know before your appointment?"
                        rows={4}
                        className="w-full resize-none rounded-xl border border-[#d8d3ca] bg-white py-3 pl-12 pr-4 outline-none transition placeholder:text-[#aaa49c] focus:border-[#806a40] focus:ring-2 focus:ring-[#806a40]/10"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDetailsContinue}
                    className="flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#1c1b19] px-5 font-semibold text-white transition hover:bg-[#34312d]"
                  >
                    Continue to confirmation
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="rounded-3xl border border-[#ded9cf] bg-white p-5 shadow-sm sm:p-8">
                <div className="mb-7">
                  <button
                    type="button"
                    onClick={goBack}
                    className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-[#6f6961] transition hover:text-[#1c1b19]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </button>

                  <p className="mb-2 text-sm font-medium text-[#806a40]">
                    Step 5 of 5
                  </p>

                  <h2 className="text-2xl font-semibold">
                    Confirm your appointment
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-[#77716a]">
                    Check your details below before confirming your
                    booking.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl bg-[#faf9f6] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex gap-3">
                        <Scissors className="mt-0.5 h-5 w-5 shrink-0 text-[#806a40]" />

                        <div>
                          <p className="text-xs uppercase tracking-wide text-[#918a81]">
                            Service
                          </p>

                          <p className="mt-1 font-semibold">
                            {selectedService?.name}
                          </p>

                          <p className="mt-1 text-sm text-[#77716a]">
                            {selectedService?.duration_minutes} minutes
                          </p>
                        </div>
                      </div>

                      <span className="font-semibold text-[#806a40]">
                        {selectedService
                          ? formatRand(selectedService.price)
                          : ""}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-[#faf9f6] p-5">
                    <div className="flex gap-3">
                      <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-[#806a40]" />

                      <div>
                        <p className="text-xs uppercase tracking-wide text-[#918a81]">
                          Date
                        </p>

                        <p className="mt-1 font-semibold">
                          {formatDate(selectedDate)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-[#faf9f6] p-5">
                    <div className="flex gap-3">
                      <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-[#806a40]" />

                      <div>
                        <p className="text-xs uppercase tracking-wide text-[#918a81]">
                          Time
                        </p>

                        <p className="mt-1 font-semibold">
                          {formatTime(selectedTime)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-[#faf9f6] p-5">
                    <div className="flex gap-3">
                      <User className="mt-0.5 h-5 w-5 shrink-0 text-[#806a40]" />

                      <div>
                        <p className="text-xs uppercase tracking-wide text-[#918a81]">
                          Customer
                        </p>

                        <p className="mt-1 font-semibold">
                          {fullName}
                        </p>

                        <p className="mt-1 text-sm text-[#77716a]">
                          {phone}
                        </p>

                        {email && (
                          <p className="mt-1 text-sm text-[#77716a]">
                            {email}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {notes.trim() && (
                    <div className="rounded-2xl bg-[#faf9f6] p-5">
                      <div className="flex gap-3">
                        <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-[#806a40]" />

                        <div>
                          <p className="text-xs uppercase tracking-wide text-[#918a81]">
                            Notes
                          </p>

                          <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                            {notes}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-7 rounded-2xl border border-[#dcd5c8] bg-[#f7f3e9] p-5">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#806a40]" />

                    <div>
                      <p className="font-semibold">
                        No payment required
                      </p>

                      <p className="mt-1 text-sm leading-6 text-[#70695f]">
                        Your appointment is confirmed directly with the
                        barbershop. There is no online payment or
                        deposit required.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmBooking}
                  disabled={submitting}
                  className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#1c1b19] px-5 font-semibold text-white transition hover:bg-[#34312d] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Confirming booking...
                    </>
                  ) : (
                    <>
                      Confirm appointment
                      <Check className="h-5 w-5" />
                    </>
                  )}
                </button>
              </div>
            )}
          </section>

          <aside className="h-fit lg:sticky lg:top-6">
            <div className="rounded-3xl border border-[#ded9cf] bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#efe7d5]">
                  <Scissors className="h-5 w-5 text-[#806a40]" />
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-[#918a81]">
                    Your booking
                  </p>

                  <h2 className="font-semibold">
                    Appointment summary
                  </h2>
                </div>
              </div>

              {!selectedService ? (
                <div className="rounded-2xl bg-[#faf9f6] p-5 text-sm leading-6 text-[#77716a]">
                  Select a service to get started.
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[#918a81]">
                      Service
                    </p>

                    <div className="mt-2 flex items-start justify-between gap-3">
                      <p className="font-semibold">
                        {selectedService.name}
                      </p>

                      <span className="font-semibold text-[#806a40]">
                        {formatRand(selectedService.price)}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-[#77716a]">
                      {selectedService.duration_minutes} minutes
                    </p>
                  </div>

                  <div className="h-px bg-[#e4dfd6]" />

                  <div>
                    <p className="text-xs uppercase tracking-wide text-[#918a81]">
                      Date
                    </p>

                    <p className="mt-2 text-sm font-medium">
                      {selectedDate
                        ? formatDate(selectedDate)
                        : "Not selected"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-[#918a81]">
                      Time
                    </p>

                    <p className="mt-2 text-sm font-medium">
                      {selectedTime
                        ? formatTime(selectedTime)
                        : "Not selected"}
                    </p>
                  </div>

                  <div className="h-px bg-[#e4dfd6]" />

                  <div className="rounded-2xl bg-[#faf9f6] p-4">
                    <div className="flex items-start gap-3">
                      <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-[#806a40]" />

                      <div>
                        <p className="text-sm font-semibold">
                          Opening hours
                        </p>

                        <p className="mt-1 text-sm leading-6 text-[#77716a]">
                          Wednesday – Sunday
                          <br />
                          09:00 – 17:00
                        </p>

                        <p className="mt-2 text-xs text-[#969087]">
                          Monday and Tuesday closed
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-[#f7f3e9] p-4 text-sm leading-6 text-[#70695f]">
                    <strong className="font-semibold text-[#1c1b19]">
                      30-minute booking intervals.
                    </strong>{" "}
                    Your service duration is automatically checked so
                    the appointment finishes before closing time.
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}