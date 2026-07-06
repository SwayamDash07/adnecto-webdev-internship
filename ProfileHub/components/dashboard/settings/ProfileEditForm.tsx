import InputField from "@/components/ui/InputField";
import SelectField from "@/components/ui/SelectField";
import SubmitButton from "@/components/ui/SubmitButton";
import { countries } from "@/lib/countries";

type UserData = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  dobInput: string;
  state: string;
  country: string;
  phoneNumber: string;
  profilePicture: string;
};

export default function ProfileEditForm({
  action,
  user,
}: {
  action: (formData: FormData) => void;
  user: UserData;
}) {
  const today = new Date().toISOString().split("T")[0];

  return (
    <form action={action} className="auth-form settings-section">
      <h2 className="settings-section-title">Edit Personal Info</h2>
      <InputField label="Profile picture URL" name="profilePicture" type="text" defaultValue={user.profilePicture} />
      <div className="field-row">
        <InputField label="First name" name="firstName" type="text" required defaultValue={user.firstName} />
        <InputField label="Last name" name="lastName" type="text" required defaultValue={user.lastName} />
      </div>
      <InputField label="Username" name="username" type="text" required defaultValue={user.username} />
      <InputField
        label="Email"
        name="email"
        type="email"
        required
        pattern="[a-zA-Z0-9._%+-]+@gmail\.com"
        defaultValue={user.email}
      />
      <InputField label="Date of birth" name="dob" type="date" required max={today} defaultValue={user.dobInput} />
      <div className="field-row">
        <InputField label="State" name="state" type="text" required defaultValue={user.state} />
        <SelectField label="Country" name="country" options={countries} required defaultValue={user.country} />
      </div>
      <InputField
        label="Phone number"
        name="phoneNumber"
        type="tel"
        required
        pattern="[0-9]{10}"
        maxLength={10}
        defaultValue={user.phoneNumber}
      />
      <SubmitButton label="Save changes" />
    </form>
  );
}