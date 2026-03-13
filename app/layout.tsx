import type { Metadata } from "next";
import { Rye, Courier_Prime } from "next/font/google";
import "./globals.css";

const rye = Rye({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-heading",
});

const courierPrime = Courier_Prime({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "The Kintai Saloon",
  description: "勤怠管理 — Western Style",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${rye.variable} ${courierPrime.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
