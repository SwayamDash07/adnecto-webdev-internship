export default function InputField({
  label,
  name,
  type,
  required,
  pattern,
  maxLength,
  max,
  defaultValue,
}: {
  label: string;
  name: string;
  type: string;
  required?: boolean;
  pattern?: string;
  maxLength?: number;
  max?: string;
  defaultValue?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        className="field-input"
        name={name}
        type={type}
        required={required}
        pattern={pattern}
        maxLength={maxLength}
        max={max}
        defaultValue={defaultValue}
      />
    </label>
  );
}