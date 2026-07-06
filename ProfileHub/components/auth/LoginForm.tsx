import InputField from "@/components/ui/InputField";
import SubmitButton from "@/components/ui/SubmitButton";

export default function LoginForm({
  action,
}: {
  action: (formData: FormData) => void;
}) {
  return (
    <form action={action} className="auth-form">
      <InputField label="Username" name="username" type="text" required />
      <InputField label="Password" name="password" type="password" required />
      <SubmitButton label="Log in" />
    </form>
  );
}