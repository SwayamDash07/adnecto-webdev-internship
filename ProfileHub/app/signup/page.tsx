import { redirect } from "next/navigation";
import AuthCard from "@/components/auth/AuthCard";
import AuthToggleLink from "@/components/auth/AuthToggleLink";
import SignupForm from "@/components/auth/SignupForm";
import { getSession } from "@/lib/session";
import { registerAction } from "./actions";

const errorMessages: Record<string, string> = {
  missing: "Fill in every field before continuing.",
  exists: "That email is already registered.",
  username: "That username is already taken.",
  phone: "Phone number must be exactly 10 digits.",
  email: "Email must be a valid @gmail.com address.",
  dob: "Date of birth can't be in the future.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const errorMessage = params.error ? errorMessages[params.error] : undefined;

  return (
    <div className="fade-in-up">
      <AuthCard title="Sign up" error={errorMessage}>
        <SignupForm action={registerAction} />
        <AuthToggleLink question="Already a user?" linkText="Log in" href="/login" />
      </AuthCard>
    </div>
  );
}