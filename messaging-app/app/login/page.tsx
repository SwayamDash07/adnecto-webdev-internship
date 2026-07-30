import Link from "next/link";
import { redirect } from "next/navigation";
import InputField from "@/components/ui/InputField";
import SubmitButton from "@/components/ui/SubmitButton";
import { getCurrentUser } from "@/lib/auth-guard";
import { loginAction } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  missing_fields: "Please enter your username/email and password.",
  invalid_credentials: "That username/email or password is incorrect.",
};

export default async function LoginPage({
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
          <span className="landing-kicker">Private, focused messaging</span>
          <h1 className="landing-title">Welcome back.</h1>
          <p className="landing-subtitle">
            Log in to pick up conversations, search people, and keep your network moving without the clutter.
          </p>
          <div className="landing-metrics">
            <div className="landing-metric">
              <div className="landing-metric-value">Inbox</div>
              <span className="landing-metric-label">One clean place for chats</span>
            </div>
            <div className="landing-metric">
              <div className="landing-metric-value">Friends</div>
              <span className="landing-metric-label">Find people you already know</span>
            </div>
            <div className="landing-metric">
              <div className="landing-metric-value">Fast</div>
              <span className="landing-metric-label">Jump right back in</span>
            </div>
          </div>
        </section>

        <div className="card auth-card">
          <div className="brand">Threadline</div>
          <div className="subtitle">Log in to continue your conversations</div>
          {errorMessage && <div className="error-text">{errorMessage}</div>}
          <form action={loginAction}>
            <InputField label="Username or email" name="identifier" placeholder="swayamd" required />
            <InputField label="Password" name="password" type="password" placeholder="Your password" required />
            <SubmitButton label="Log in" />
          </form>
          <div className="auth-switch">
            New here? <Link href="/signup">Create an account</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
