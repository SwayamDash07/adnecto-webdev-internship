import { toggleThemeAction } from "@/lib/theme-actions";

export default function ThemeToggle({ theme }: { theme: string }) {
  return (
    <form action={toggleThemeAction} className="theme-toggle-form">
      <button type="submit" className="theme-toggle-button">
        {theme === "light" ? "Dark mode" : "Light mode"}
      </button>
    </form>
  );
}