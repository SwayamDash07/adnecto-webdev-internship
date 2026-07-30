type InputFieldProps = {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  maxLength?: number;
  pattern?: string;
};

export default function InputField({
  label,
  name,
  type = "text",
  placeholder,
  required,
  defaultValue,
  maxLength,
  pattern,
}: InputFieldProps) {
  return (
    <div className="field-group">
      <label className="field-label" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        defaultValue={defaultValue}
        maxLength={maxLength}
        pattern={pattern}
        className="text-input"
      />
    </div>
  );
}
