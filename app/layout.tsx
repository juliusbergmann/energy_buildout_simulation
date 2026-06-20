import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Austria Electricity Buildout Simulator",
  description: "Explore Austria's 15-minute electricity balance under generation capacity buildout scenarios."
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
