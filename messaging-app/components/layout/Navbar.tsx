import Link from "next/link";
import { cookies } from "next/headers";
import { toggleThemeAction } from "./theme-actions";
import { logoutAction } from "@/app/login/actions";
import { SunIcon, MoonIcon } from "@/components/ui/icons";
import NavLinks from "./NavLinks";
import NotificationBell from "@/components/notifications/NotificationBell";

export default async function Navbar({
  userName,
}: {
  userName: string;
}) {
  const cookieStore = await cookies();
  const theme = cookieStore.get("threadline_theme")?.value === "light" ? "light" : "dark";

  return (
    <nav className="navbar">
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/home" className="brand" style={{ fontSize: 18, marginBottom: 0 }}>
          Threadline
        </Link>
        <span className="nav-username">{userName}</span>
      </div>
      <NavLinks />
      <div className="nav-actions">
        <NotificationBell />
        <form action={toggleThemeAction}>
          <button type="submit" className="theme-toggle-circle" aria-label="Toggle theme">
            {theme === "light" ? <MoonIcon /> : <SunIcon />}
          </button>
        </form>
        <form action={logoutAction}>
          <button type="submit" className="logout-button">
            Log out
          </button>
        </form>
      </div>
    </nav>
  );
}
