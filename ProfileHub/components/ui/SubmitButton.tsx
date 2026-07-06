export default function SubmitButton({ label }: { label: string }) {
  return (
    <button type="submit" className="submit-button">
      {label}
    </button>
  );
}