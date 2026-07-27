import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "P1 Driving English Coach",
  description:
    "把通勤時間變成英文口說練習：出發前設定、行進間只用聲音、抵達後看回顧。",
  // The favicon comes from `app/icon.svg` via Next's file convention, which
  // resolves the basePath correctly on GitHub Pages. Don't hardcode it here.
};

export const viewport: Viewport = {
  themeColor: "#0b0f14",
  // Cover the notch so the driving screen can use the full display.
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
