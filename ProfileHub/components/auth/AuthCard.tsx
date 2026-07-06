import Link from "next/link";

export default function AuthCard({
  title,
  error,
  success,
  children,
}: {
  title: string;
  error?: string;
  success?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="auth-page">
      <div className="auth-page-inner">
        <Link href="/" className="nav-back-link">
          ← Back to homepage
        </Link>
        <div className="auth-card">
          <h1 className="auth-title">{title}</h1>
          {error && <p className="auth-message auth-message-error">{error}</p>}
          {success && <p className="auth-message auth-message-success">{success}</p>}
          {children}
        </div>
      </div>
    </main>
  );
}