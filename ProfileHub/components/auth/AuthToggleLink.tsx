import Link from "next/link";

export default function AuthToggleLink({
  question,
  linkText,
  href,
}: {
  question: string;
  linkText: string;
  href: string;
}) {
  return (
    <p className="auth-toggle">
      {question} <Link href={href}>{linkText}</Link>
    </p>
  );
}