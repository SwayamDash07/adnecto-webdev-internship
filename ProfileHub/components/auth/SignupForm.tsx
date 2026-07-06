import InputField from "@/components/ui/InputField";
import SelectField from "@/components/ui/SelectField";
import SubmitButton from "@/components/ui/SubmitButton";
import { countries } from "@/lib/countries";

export default function SignupForm({
  action,
}: {
  action: (formData: FormData) => void;
}) {
  const today = new Date().toISOString().split("T")[0];

  return (
    <form action={action} className="auth-form">
      <div className="field-row">
        <InputField label="First name" name="firstName" type="text" required />
        <InputField label="Last name" name="lastName" type="text" required />
      </div>
      <InputField label="Username" name="username" type="text" required />
      <InputField
        label="Email"
        name="email"
        type="email"
        required
        pattern="[a-zA-Z0-9._%+-]+@gmail\.com"
      />
      <InputField label="Password" name="password" type="password" required />
      <InputField label="Date of birth" name="dob" type="date" required max={today} />
      <div className="field-row">
        <InputField label="State" name="state" type="text" required />
        <SelectField label="Country" name="country" options={countries} required />
      </div>
      <InputField
        label="Phone number"
        name="phoneNumber"
        type="tel"
        required
        pattern="[0-9]{10}"
        maxLength={10}
      />
      <SubmitButton label="Sign up" />
    </form>
  );
}