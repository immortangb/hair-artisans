import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hair Artisan's | Professional Haircuts",
  description:
    "Book your appointment with Hair Artisan's. Choose your service, date and time in just a few simple steps.",
  keywords: [
    "Hair Artisan's",
    "haircuts",
    "barber",
    "hair salon",
    "haircut booking",
  ],
  openGraph: {
    title: "Hair Artisan's | Professional Haircuts",
    description:
      "Professional haircuts crafted with precision. Book your appointment online.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}