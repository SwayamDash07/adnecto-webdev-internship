import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jungle Quiz",
  description: "A fun jungle-themed quiz game",
};

export default function RootLayout({
children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}