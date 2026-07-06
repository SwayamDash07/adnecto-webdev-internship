import { redirect } from "next/navigation";
import AuthCard from "@/components/auth/AuthCard";
import AuthToggleLink from "@/components/auth/AuthToggleLink";
import LoginForm from "@/components/auth/LoginForm";
import { getSession } from "@/lib/session";
import { loginAction } from "./actions";

const errorMessages: Record<string, string> = {
  missing: "Enter your username and password.",
  invalid: "Incorrect username or password.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const errorMessage = params.error ? errorMessages[params.error] : undefined;
  const successMessage = params.success ? "Account created. Log in to continue." : undefined;

  return (
    <div className="fade-in-up">
      <AuthCard title="Log in" error={errorMessage} success={successMessage}>
        <LoginForm action={loginAction} />
        <AuthToggleLink question="New user?" linkText="Sign up" href="/signup" />
      </AuthCard>
    </div>
  );
}