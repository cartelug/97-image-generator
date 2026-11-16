import type { Metadata, Viewport } from "next";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./globals.css";
import "./polish.css";
import { Preloader } from "@/components/Preloader";

export const metadata: Metadata = {
  title: { default: "97 IMAGE GENERATOR", template: "%s · 97 IMAGE GENERATOR" },
  description: "Generate extraordinary. Design without limits. The official AI creative studio by THE 97 World.",
  applicationName: "97 Image Generator",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "97 Images", statusBarStyle: "black-translucent" },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#0a0a0b", viewportFit: "cover", width: "device-width", initialScale: 1 };

const bootScript = `try{if(sessionStorage.getItem('97ig.boot'))document.documentElement.dataset.boot='seen'}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>
        <Preloader />
        {children}
      </body>
    </html>
  );
}
