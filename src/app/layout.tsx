import type { Metadata, Viewport } from "next";
import "./globals.css";

// Metadata is rendered into the <head> on every page.
// title.template lets sub-pages set just their portion, e.g. "Fuel | Automotive".
export const metadata: Metadata = {
  title: {
    default: "Automotive",
    template: "%s · Automotive",
  },
  description: "Maintenance and metrics for my cars.",
  // PWA bits — full-bleed on iPhone "Add to Home Screen"
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Automotive",
  },
};

// Viewport tag controls how iPhone Safari sizes the page.
// viewportFit=cover lets us paint into the safe-area on notched devices.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg-base text-fg-primary antialiased">
        {children}
      </body>
    </html>
  );
}
