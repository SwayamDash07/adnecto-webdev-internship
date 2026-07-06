import InputField from "@/components/ui/InputField";
import SubmitButton from "@/components/ui/SubmitButton";

export default function PasswordChangeForm({
  action,
}: {
  action: (formData: FormData) => void;
}) {
  return (
    <form action={action} className="auth-form settings-section">
      <h2 className="settings-section-title">Change password</h2>
      <InputField label="Current password" name="currentPassword" type="password" required />
      <InputField label="New password" name="newPassword" type="password" required />
      <InputField label="Confirm new password" name="confirmPassword" type="password" required />
      <SubmitButton label="Update password" />
    </form>
  );
}