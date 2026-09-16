type BookingEmail = {
  booking_id: number;
  customer_name: string;
  customer_email: string | null;
  service_name: string;
  appointment_date: string;
  start_time: string;
  paid_amount: number;
  balance_amount: number;
  payment_status: string;
};

const BUSINESS_NAME = "Hair Artisans Barbershop";

function formatTime(time: string) {
  const [hourText, minute] = time.slice(0, 5).split(":");
  const hour = Number(hourText);
  return `${hour % 12 || 12}:${minute} ${hour >= 12 ? "PM" : "AM"}`;
}

export async function sendBookingConfirmation(email: BookingEmail) {
  if (!email.customer_email) return false;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.BOOKING_EMAIL_FROM;

  if (!apiKey || !from) {
    console.warn("Booking email was not sent: Resend is not configured.");
    return false;
  }

  const paidLabel = Number(email.balance_amount) <= 0 ? "Paid in full" : "Deposit paid";
  const subject = `${BUSINESS_NAME}: booking confirmed (#HA-${email.booking_id})`;
  const text = [
    `Hi ${email.customer_name},`,
    "",
    `Your appointment at ${BUSINESS_NAME} is confirmed.`,
    `Booking number: HA-${email.booking_id}`,
    `Service: ${email.service_name}`,
    `Date: ${email.appointment_date}`,
    `Time: ${formatTime(email.start_time)}`,
    `${paidLabel}: R${Number(email.paid_amount).toFixed(2)}`,
    `Balance due at the shop: R${Number(email.balance_amount).toFixed(2)}`,
    "",
    "Please arrive a few minutes before your appointment.",
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "Hair-Artisans-Barbershop/1.0",
    },
    body: JSON.stringify({ from, to: [email.customer_email], subject, text }),
  });

  if (!response.ok) {
    throw new Error("The confirmation email could not be sent.");
  }

  return true;
}
