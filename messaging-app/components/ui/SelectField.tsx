type SelectFieldProps = {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
};

export default function SelectField({ label, name, options, defaultValue }: SelectFieldProps) {
  return (
    <div className="field-group">
      <label className="field-label" htmlFor={name}>
        {label}
      </label>
      <select id={name} name={name} defaultValue={defaultValue} className="select-input">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
