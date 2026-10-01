import type { Metadata } from "next";
import { AuthProvider } from "@/app/components/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "CoutureAI Studio | AI-Powered Garment Photoshoot Generator",
  description:
    "Generate hyper-realistic AI model photoshoots for Indian ethnic & western garments. Upload swatches, choose models, and create stunning catalog images.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body
        className="min-h-full flex flex-col font-sans bg-cream text-charcoal selection:bg-accent-border"
        suppressHydrationWarning
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
