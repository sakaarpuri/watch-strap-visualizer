import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://watchstrapper.com"),
  title: {
    default: "Watchstrapper",
    template: "%s | Watchstrapper"
  },
  description: "Preview strap aesthetics behind your watch photo.",
  applicationName: "Watchstrapper"
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
