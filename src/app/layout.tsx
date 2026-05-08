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
  // iOS uses apple-touch-icon (180x180) for the home-screen icon.
  // The manifest at /manifest.webmanifest covers Android/Chrome.
  icons: {
    // Standard browser favicon — points at the smaller PWA icon so we
    // don't ship a separate file just for tab favicons.
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: "/icons/apple-touch-icon.png",
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
