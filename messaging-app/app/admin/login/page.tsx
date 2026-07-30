import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-auth-guard";
import { loginAdminAction } from "./actions";
import { adminPath } from "@/lib/admin-route";

const errors: Record<string, string> = {
  missing_fields: "Enter your admin username and password.",
  invalid_credentials: "Those admin credentials are incorrect.",
};

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCurrentAdmin()) redirect(adminPath("/dashboard"));
  const query = await searchParams;

  return (
    <div className="admin-login">
      <div className="admin-login-card">
        <div className="admin-brand">Threadline Control</div>
        <h1 className="admin-title" style={{ marginTop: 28 }}>Admin sign in</h1>
        <p className="admin-muted">This access point is separate from user accounts.</p>
        {query.error && <div className="admin-alert">{errors[query.error] || "Unable to sign in."}</div>}
        <form action={loginAdminAction} className="admin-form">
          <div className="admin-field"><label htmlFor="username">Username</label><input id="username" name="username" className="admin-input" required /></div>
          <div className="admin-field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" className="admin-input" required /></div>
          <button type="submit" className="admin-button">Sign in</button>
        </form>
      </div>
    </div>
  );
}
