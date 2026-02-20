import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Watch Strap Visualizer (Inspiration Mode)",
  description: "Preview strap aesthetics behind your watch photo."
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
