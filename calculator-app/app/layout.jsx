import "./globals.css";

export const metadata = {
  title: "Calculator",
  description: "A simple calculator built with Next.js",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
