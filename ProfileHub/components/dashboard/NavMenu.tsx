import Link from "next/link";

type NavLink = {
  label: string;
  href: string;
};

let navIdCounter = 0;

export default function NavMenu({
  variant,
  links,
  backHref,
}: {
  variant: "menu" | "back";
  links?: NavLink[];
  backHref?: string;
}) {
  if (variant === "back") {
    return (
      <Link href={backHref ?? "/dashboard/settings"} className="nav-back-link">
        ← Back
      </Link>
    );
  }

  navIdCounter += 1;
  const inputId = `nav-toggle-${navIdCounter}`;

  return (
    <div className="nav-menu-wrapper">
      <input type="checkbox" id={inputId} className="nav-toggle-checkbox" />
      <label htmlFor={inputId} className="nav-menu-trigger" aria-label="Menu">
        <span className="nav-bar-icon" />
        <span className="nav-bar-icon" />
      </label>
      <div className="nav-menu-panel">
        {(links ?? []).map((link) => (
          <Link key={link.href + link.label} href={link.href} className="nav-menu-link">
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}