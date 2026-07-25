import type { Metadata } from "next";
import "./globals.css";

const deploymentOrigin =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(deploymentOrigin),
  title: "MoveMail — a message worth moving for",
  description:
    "Turn a family message into three gentle, seated movements. Complete them to open your postcard.",
  applicationName: "MoveMail",
  openGraph: {
    title: "MoveMail — a message worth moving for",
    description:
      "Turn a family message into three gentle, seated movements. Complete them to open your postcard.",
    type: "website",
    locale: "en_GB",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "MoveMail: a family message opening into a gentle coastal movement story",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MoveMail — a message worth moving for",
    description:
      "Three gentle movements unlock one personal family message.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
