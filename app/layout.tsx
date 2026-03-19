import type { Metadata } from "next";
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
      <body>{children}</body>
    </html>
  );
}
