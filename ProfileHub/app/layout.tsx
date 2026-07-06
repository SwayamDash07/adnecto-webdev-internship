import "./globals.css";
import { getTheme } from "@/lib/theme";
import ThemeToggle from "@/components/ThemeToggle";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = await getTheme();

  return (
    <html lang="en" data-theme={theme}>
      <body>
        <div className="theme-toggle-wrapper">
          <ThemeToggle theme={theme} />
        </div>
        {children}
      </body>
    </html>
  );
}