"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  Clock,
  Scissors,
  ShieldCheck,
  Users,
} from "lucide-react";
import { createClient } from "../lib/supabase/client";
import RecentWork from "@/components/home/RecentWork";

type Service = {
  id: number;
  name: string;
  price: number;
  duration_minutes: number;
  image_url: string | null;
};

const serviceImages: Record<string, string> = {
  "classic haircut": "/images/classic-haircut.jpg",
  "haircut & beard": "/images/haircut-beard.jpg",
  "haircut and beard": "/images/haircut-beard.jpg",
  "kids haircut": "/images/kids-haircut.jpg",
};

function getServiceImage(serviceName: string) {
  const name = serviceName.trim().toLowerCase();

  if (serviceImages[name]) {
    return serviceImages[name];
  }

  if (name.includes("beard")) {
    return "/images/haircut-beard.jpg";
  }

  if (name.includes("kids") || name.includes("kid")) {
    return "/images/kids-haircut.jpg";
  }

  return "/images/service-default.jpg";
}

export default function Home() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroImage, setHeroImage] = useState("/images/hero.jpg");

  useEffect(() => {
    async function loadServices() {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("services")
        .select("id, name, price, duration_minutes, image_url")
        .eq("active", true)
        .order("sort_order");

      if (error) {
        console.error("Error loading services:", error);
      }

      setServices(data || []);

      const { data: heroSetting, error: heroError } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "hero_image_url")
        .maybeSingle();

      if (!heroError && heroSetting?.value) setHeroImage(heroSetting.value);
      setLoading(false);
    }

    loadServices();
  }, []);

  return (
    <main className="min-h-screen bg-[#f7f5f0] text-[#1c1b19]">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1c1b19] text-white">
            <Scissors className="h-5 w-5" />
          </span>

          <span className="text-xl font-bold tracking-tight">
            Hair Artisan's Barbershop
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Link href="#our-work" className="hidden rounded-full px-4 py-2.5 text-sm font-semibold sm:block">
            Our Work
          </Link>
          <Link
            href="/booking"
            className="hidden rounded-full border border-[#d8d3c9] bg-white px-5 py-2.5 text-sm font-semibold transition hover:bg-[#eeeae2] sm:block"
          >
            Book Now
          </Link>
        </div>
      </header>


      {/* ======================================================
          HERO
      ====================================================== */}

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-10 sm:pt-16">
        <div className="mx-auto max-w-4xl text-center">

          <div className="mx-auto h-48 w-48 overflow-hidden rounded-full border-4 border-white shadow-2xl sm:h-56 sm:w-56">
            <img
              src={heroImage}
              alt="Hair Artisan's Barbershop"
              className="h-full w-full object-cover"
            />
          </div>

          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.35em] text-[#9b8251]">
            Professional Haircuts
          </p>

          <h1 className="mt-3 text-5xl font-bold uppercase tracking-tight sm:text-7xl">
            Hair Artisan's Barbershop
          </h1>

          <div className="mt-5 flex items-center justify-center gap-4">
            <span className="h-px w-12 bg-[#c9c2b5]" />

            <span className="text-xs font-semibold uppercase tracking-[0.35em] text-[#777168]">
              Precision • Style • Confidence
            </span>

            <span className="h-px w-12 bg-[#c9c2b5]" />
          </div>

          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-[#777168]">
            Professional haircuts crafted with precision. Choose your service,
            pick your time and book your chair in just a few steps.
          </p>

          <Link
            href="/booking"
            className="group mx-auto mt-10 flex max-w-2xl items-center gap-4 rounded-2xl bg-[#1c1b19] p-4 pl-5 text-left text-white shadow-xl transition hover:-translate-y-0.5"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
              <CalendarCheck className="h-6 w-6" />
            </span>

            <span className="flex-1">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-white/50">
                Ready when you are
              </span>

              <span className="block text-lg font-semibold">
                Book an appointment
              </span>
            </span>

            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 transition group-hover:bg-white/10">
              <ArrowRight className="h-5 w-5" />
            </span>
          </Link>
        </div>


        {/* ====================================================
            FEATURES
        ==================================================== */}

        <div className="mx-auto mt-8 grid max-w-2xl overflow-hidden rounded-2xl border border-[#ded9d0] bg-white shadow-sm sm:grid-cols-3">

          <div className="p-6 text-center">
            <Clock className="mx-auto h-5 w-5 text-[#9b8251]" />

            <h3 className="mt-3 font-semibold">
              Choose your time
            </h3>

            <p className="mt-1 text-sm text-[#777168]">
              Book around your schedule
            </p>
          </div>

          <div className="border-t border-[#ded9d0] p-6 text-center sm:border-l sm:border-t-0">
            <ShieldCheck className="mx-auto h-5 w-5 text-[#9b8251]" />

            <h3 className="mt-3 font-semibold">
              Simple booking
            </h3>

            <p className="mt-1 text-sm text-[#777168]">
              No payment required
            </p>
          </div>

          <div className="border-t border-[#ded9d0] p-6 text-center sm:border-l sm:border-t-0">
            <Users className="mx-auto h-5 w-5 text-[#9b8251]" />

            <h3 className="mt-3 font-semibold">
              One-on-one service
            </h3>

            <p className="mt-1 text-sm text-[#777168]">
              Your chair is reserved
            </p>
          </div>

        </div>
      </section>


      {/* ======================================================
          SERVICES
      ====================================================== */}

      <section className="border-t border-[#ded9d0] bg-white px-6 py-20">
        <div className="mx-auto max-w-6xl">

          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#9b8251]">
              Our Services
            </p>

            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
              Choose your style
            </h2>

            <p className="mx-auto mt-4 max-w-xl text-[#777168]">
              Select a service below and choose a date and time that works
              for you.
            </p>
          </div>


          {loading ? (
            <div className="mt-12 text-center text-[#777168]">
              Loading services...
            </div>
          ) : services.length === 0 ? (
            <div className="mt-12 rounded-2xl border border-[#ded9d0] bg-[#f7f5f0] p-10 text-center">
              <p className="font-semibold">
                No services are currently available.
              </p>

              <p className="mt-2 text-sm text-[#777168]">
                Please check back later.
              </p>
            </div>
          ) : (
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">

              {services.map((service) => (
                <div
                  key={service.id}
                  className="group overflow-hidden rounded-2xl border border-[#ded9d0] bg-[#f7f5f0] shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >

                  <div className="aspect-[4/3] overflow-hidden bg-[#e8e3da]">

                    <img
                      src={service.image_url || getServiceImage(service.name)}
                      alt={service.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      onError={(event) => {
                        event.currentTarget.src =
                          "/images/service-default.jpg";
                      }}
                    />

                  </div>

                  <div className="p-6">

                    <h3 className="text-xl font-bold">
                      {service.name}
                    </h3>

                    <div className="mt-3 flex items-center justify-between">

                      <span className="text-2xl font-bold">
                        R{Number(service.price).toFixed(0)}
                      </span>

                      <span className="flex items-center gap-1 text-sm text-[#777168]">
                        <Clock className="h-4 w-4" />
                        {service.duration_minutes} min
                      </span>

                    </div>

                    <Link
                      href={`/booking?service=${service.id}`}
                      className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1c1b19] px-5 py-3 font-semibold text-white transition hover:opacity-90"
                    >
                      Book this service
                      <ArrowRight className="h-4 w-4" />
                    </Link>

                  </div>
                </div>
              ))}

            </div>
          )}

        </div>
      </section>


      {/* ======================================================
          OUR WORK / GALLERY — now managed from Dashboard > Recent Work
      ====================================================== */}

      <RecentWork />


      {/* ======================================================
          OPENING HOURS
      ====================================================== */}

      <section className="px-6 py-20">

        <div className="mx-auto max-w-3xl rounded-3xl bg-[#1c1b19] p-8 text-white shadow-xl sm:p-12">

          <div className="text-center">

            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#c8aa73]">
              Opening Hours
            </p>

            <h2 className="mt-3 text-3xl font-bold">
              We're ready when you are
            </h2>

          </div>


          <div className="mx-auto mt-10 max-w-md space-y-4">

            {[
              ["Monday", "Closed"],
              ["Tuesday", "Closed"],
              ["Wednesday", "09:00 – 17:00"],
              ["Thursday", "09:00 – 17:00"],
              ["Friday", "09:00 – 17:00"],
              ["Saturday", "09:00 – 17:00"],
              ["Sunday", "09:00 – 17:00"],
            ].map(([day, hours]) => (

              <div
                key={day}
                className="flex items-center justify-between border-b border-white/10 pb-3"
              >

                <span className="font-medium">
                  {day}
                </span>

                <span
                  className={`text-sm ${
                    hours === "Closed"
                      ? "text-red-300"
                      : "text-white/60"
                  }`}
                >
                  {hours}
                </span>

              </div>

            ))}

          </div>

        </div>

      </section>


      {/* ======================================================
          FINAL CTA
      ====================================================== */}

      <section className="border-t border-[#ded9d0] bg-white px-6 py-20 text-center">

        <Check className="mx-auto h-8 w-8 text-[#9b8251]" />

        <h2 className="mt-4 text-3xl font-bold">
          Ready for your next haircut?
        </h2>

        <p className="mx-auto mt-3 max-w-lg text-[#777168]">
          Booking is quick, simple and completely free.
        </p>

        <Link
          href="/booking"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#1c1b19] px-7 py-3.5 font-semibold text-white transition hover:opacity-90"
        >
          Book an appointment
          <ArrowRight className="h-4 w-4" />
        </Link>

      </section>


      {/* ======================================================
          FOOTER
      ====================================================== */}

      <footer className="bg-[#f7f5f0] px-6 py-10 text-center text-sm text-[#777168]">

        <div className="flex items-center justify-center gap-2">

          <Scissors className="h-4 w-4" />

          <span className="font-semibold text-[#1c1b19]">
            Hair Artisan's Barbershop
          </span>

        </div>

        <p className="mt-3">
          © {new Date().getFullYear()} Hair Artisan's Barbershop. All rights reserved.
        </p>

      </footer>

    </main>
  );
}