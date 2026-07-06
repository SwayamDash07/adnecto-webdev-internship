import Link from "next/link";

export default function HeroActions({ isLoggedIn }: { isLoggedIn: boolean }) {
  if (isLoggedIn) {
    return (
      <Link href="/dashboard" className="cta-button">
        Go to dashboard
      </Link>
    );
  }

  return (
    <div className="hero-actions">
      <Link href="/login" className="cta-button-ghost">Log In</Link>
      <Link href="/signup" className="cta-button">Sign Up</Link>
    </div>
  );
}