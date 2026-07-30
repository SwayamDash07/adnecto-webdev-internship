import Link from "next/link";

export default function PanelTile({
  href,
  icon,
  label,
  subtitle,
  badgeCount,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  subtitle: string;
  badgeCount?: number;
}) {
  return (
    <Link href={href} className="panel-tile">
      <span className="panel-tile-icon-badge">{icon}</span>
      <div className="panel-tile-text">
        <div className="panel-tile-label">{label}</div>
        <div className="panel-tile-subtitle">{subtitle}</div>
      </div>
      {Boolean(badgeCount && badgeCount > 0) && (
        <span className="panel-badge">{badgeCount! > 9 ? "9+" : badgeCount}</span>
      )}
    </Link>
  );
}