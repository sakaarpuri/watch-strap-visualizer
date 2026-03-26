import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://watchstrapper.com"),
  title: {
    default: "Watchstrapper | See Any Strap On Your Watch",
    template: "%s | Watchstrapper"
  },
  description:
    "Upload a watch photo and preview different straps on it before you buy. Compare styles, materials, and fit in one place.",
  applicationName: "Watchstrapper",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    url: "https://watchstrapper.com",
    siteName: "Watchstrapper",
    title: "See Any Strap On Your Watch Before You Buy",
    description:
      "Upload a watch photo, preview different straps on it, and compare fit before you commit.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Watchstrapper share preview"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "See Any Strap On Your Watch Before You Buy",
    description:
      "Upload a watch photo, preview different straps on it, and compare fit before you commit.",
    images: ["/opengraph-image"]
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <footer className="border-t border-[#ead8c0]/70 bg-[#fffaf4] px-4 py-8 text-[#6a5a4b] sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-semibold text-[#3b3128]">Watchstrapper</p>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs uppercase tracking-[0.14em] text-[#7b6a59]">
              <Link href="/straps" className="hover:text-[#3b3128]">
                Straps
              </Link>
              <Link href="/straps/leather" className="hover:text-[#3b3128]">
                Leather
              </Link>
              <Link href="/straps/fabric" className="hover:text-[#3b3128]">
                Fabric
              </Link>
              <Link href="/straps/rubber" className="hover:text-[#3b3128]">
                Rubber
              </Link>
              <Link href="/contact" className="hover:text-[#3b3128]">
                Contact
              </Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
