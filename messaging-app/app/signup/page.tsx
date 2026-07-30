import Link from "next/link";
import { redirect } from "next/navigation";
import InputField from "@/components/ui/InputField";
import SubmitButton from "@/components/ui/SubmitButton";
import { getCurrentUser } from "@/lib/auth-guard";
import { signupAction } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  missing_fields: "Please fill in every field.",
  invalid_username: "Username must be at least 3 characters, letters, numbers, and underscores only.",
  weak_password: "Password must be at least 8 characters.",
  already_exists: "That username or email is already taken.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/home");
  }

  const params = await searchParams;
  const errorMessage = params.error ? ERROR_MESSAGES[params.error] : null;

  return (
    <div className="auth-shell">
      <div className="auth-layout">
        <section className="auth-hero">
          <span className="landing-kicker">Join the network</span>
          <h1 className="landing-title">Create your Threadline profile.</h1>
          <p className="landing-subtitle">
            Add your name, username, and details once, then use the same account across search, chat, and profile.
          </p>
          <div className="landing-metrics">
            <div className="landing-metric">
              <div className="landing-metric-value">Profile</div>
              <span className="landing-metric-label">Make yourself easy to find</span>
            </div>
            <div className="landing-metric">
              <div className="landing-metric-value">Chat</div>
              <span className="landing-metric-label">Message right away</span>
            </div>
            <div className="landing-metric">
              <div className="landing-metric-value">Connect</div>
              <span className="landing-metric-label">Build your friend list</span>
            </div>
          </div>
        </section>

        <div className="card auth-card">
          <div className="brand">Threadline</div>
          <div className="subtitle">Create an account to start finding people</div>
          {errorMessage && <div className="error-text">{errorMessage}</div>}
          <form action={signupAction}>
            <InputField label="Full name" name="name" placeholder="Your full name" required maxLength={60} />
            <InputField label="Username" name="username" placeholder="Choose a username" required maxLength={24} />
            <InputField label="Email" name="email" type="email" placeholder="you@example.com" required />
            <InputField label="Password" name="password" type="password" placeholder="At least 8 characters" required />
            <SubmitButton label="Create account" />
          </form>
          <div className="auth-switch">
            Already have an account? <Link href="/login">Log in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
