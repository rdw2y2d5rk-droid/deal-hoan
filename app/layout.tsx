import type { Metadata, Viewport } from "next";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#faf3ef",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://deal-hoan.vercel.app"),
  title: "DealHoàn — Săn deal & hoàn tiền",
  description: "Nền tảng săn deal và hoàn tiền cho người mua sắm thông minh.",
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: "DealHoàn",
    title: "DealHoàn — Săn deal & hoàn tiền",
    description: "Nền tảng săn deal và hoàn tiền cho người mua sắm thông minh.",
    images: [
      {
        url: "/brand/deal-hoan-logo.png",
        width: 1536,
        height: 1024,
        alt: "DealHoàn — Săn deal · Hoàn tiền",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DealHoàn — Săn deal & hoàn tiền",
    description: "Nền tảng săn deal và hoàn tiền cho người mua sắm thông minh.",
    images: ["/brand/deal-hoan-logo.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
