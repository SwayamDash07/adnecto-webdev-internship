import Link from "next/link";

export default function LoginButton() {
  return (
    <Link href="/login" className="cta-button">
      Sign In
    </Link>
  );
}