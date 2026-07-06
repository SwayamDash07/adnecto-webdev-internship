import Link from "next/link";
import { requireUser } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/User";
import NavMenu from "@/components/dashboard/NavMenu";
import ProfileEditForm from "@/components/dashboard/settings/ProfileEditForm";
import PasswordChangeForm from "@/components/dashboard/settings/PasswordChangeForm";
import { updateSidebarAction } from "../profile-actions";
import { changePasswordAction } from "./actions";

const errorMessages: Record<string, string> = {
  missing: "Fill in every required field.",
  phone: "Phone number must be exactly 10 digits.",
  email: "Email must be a valid @gmail.com address.",
  dob: "Date of birth can't be in the future.",
  username: "That username is already taken.",
  exists: "That email is already registered.",
  currentPassword: "Current password is incorrect.",
  passwordMismatch: "New passwords do not match.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; error?: string; success?: string }>;
}) {
  const sessionUser = await requireUser();
  const params = await searchParams;
  const errorMessage = params.error ? errorMessages[params.error] : undefined;
  const successMessage = params.success ? "Changes saved." : undefined;

  if (params.section === "profile") {
    await connectDB();
    const user: any = await User.findById(sessionUser._id).lean();

    return (
      <main className="settings-page">
        <div className="dashboard-top-bar">
          <NavMenu variant="back" backHref="/dashboard/settings" />
        </div>
        {errorMessage && <p className="auth-message auth-message-error">{errorMessage}</p>}
        {successMessage && <p className="auth-message auth-message-success">{successMessage}</p>}
        <ProfileEditForm
          action={updateSidebarAction}
          user={{
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
            email: user.email,
            dobInput: new Date(user.dob).toISOString().split("T")[0],
            state: user.state,
            country: user.country,
            phoneNumber: user.phoneNumber,
            profilePicture: user.profilePicture ?? "",
          }}
        />
      </main>
    );
  }

  if (params.section === "password") {
    return (
      <main className="settings-page">
        <div className="dashboard-top-bar">
          <NavMenu variant="back" backHref="/dashboard/settings" />
        </div>
        {errorMessage && <p className="auth-message auth-message-error">{errorMessage}</p>}
        {successMessage && <p className="auth-message auth-message-success">{successMessage}</p>}
        <PasswordChangeForm action={changePasswordAction} />
      </main>
    );
  }

  return (
    <main className="settings-page">
      <div className="dashboard-top-bar">
        <NavMenu variant="back" backHref="/dashboard" />
      </div>
      <h1 className="settings-title">Settings</h1>
      <div className="settings-options">
        <Link href="/dashboard/settings?section=profile" className="settings-option-card">
          Edit personal info
        </Link>
        <Link href="/dashboard/settings?section=password" className="settings-option-card">
          Change your password
        </Link>
      </div>
    </main>
  );
}