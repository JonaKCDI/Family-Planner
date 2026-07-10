import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";
import "@/components/ui-system/foundation.css";
import "@/components/ui-system/interactions.css";
import "@/components/ui-system/page-patterns.css";

export const metadata: Metadata = {
  title: "Familien-App",
  description: "Familien- und Alltagsorganisation für Zuhause",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Familie"
  },
  other: {
    "apple-mobile-web-app-capable": "yes"
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#256f68"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
