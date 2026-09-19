import Link from "next/link";
import { CheckCircle2, Camera, Scissors } from "lucide-react";

type ConfirmationPageProps = {
  searchParams: Promise<{ booking?: string; payment?: string }>;
};

export default async function BookingConfirmedPage({ searchParams }: ConfirmationPageProps) {
  const { booking, payment } = await searchParams;
  const confirmed = payment === "success" && booking;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f5f0] px-5 py-12 text-[#1c1b19]">
      <section className="w-full max-w-lg rounded-3xl border border-[#ded9cf] bg-white p-8 text-center shadow-sm sm:p-12">
        {confirmed ? (
          <>
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#e7f4ea]">
              <CheckCircle2 className="h-11 w-11 text-green-700" />
            </div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#806a40]">Payment successful</p>
            <h1 className="mt-3 text-3xl font-semibold">Booking confirmed</h1>
            <div className="my-8 rounded-2xl border border-[#ded9cf] bg-[#faf9f6] p-6">
              <p className="text-xs uppercase tracking-wide text-[#77716a]">Your booking number</p>
              <p className="mt-2 text-3xl font-bold tracking-wide">HA-{booking}</p>
            </div>
            <div className="rounded-2xl bg-[#f7f3e9] p-5 text-left">
              <div className="flex gap-3">
                <Camera className="mt-0.5 h-5 w-5 shrink-0 text-[#806a40]" />
                <p className="text-sm leading-6"><strong>Take a screenshot now.</strong><br />Show this confirmation and booking number to your barber when you arrive.</p>
              </div>
            </div>
          </>
        ) : (
          <>
            <Scissors className="mx-auto h-12 w-12 text-[#806a40]" />
            <h1 className="mt-5 text-3xl font-semibold">Payment not confirmed</h1>
            <p className="mt-3 text-[#70695f]">Your payment was not completed. Please return to the booking page and try again.</p>
          </>
        )}
        <Link href="/" className="mt-8 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#1c1b19] px-6 font-medium text-white transition hover:bg-[#34312d]">Back to home</Link>
      </section>
    </main>
  );
}
