type SubmitButtonProps = {
  label: string;
  variant?: "primary" | "secondary";
};

export default function SubmitButton({ label, variant = "primary" }: SubmitButtonProps) {
  return (
    <button type="submit" className={variant === "primary" ? "submit-button" : "submit-button secondary"}>
      {label}
    </button>
  );
}
