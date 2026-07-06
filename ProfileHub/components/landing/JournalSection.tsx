const entries = [
  {
    label: "Entry 01 — Who you are",
    text: "Your bio isn't a form field, it's your story so far. Write it once, revisit it whenever you change.",
  },
  {
    label: "Entry 02 — What you've done",
    text: "Every role, every milestone — logged like a chapter, not buried in a resume PDF.",
  },
  {
    label: "Entry 03 — What you're becoming",
    text: "Skills evolve. Update yours the moment they do, no waiting for your next resume rewrite.",
  },
];

export default function JournalSection() {
  return (
    <section className="journal-section">
      <div className="journal-heading">
        <span className="journal-eyebrow">A living record</span>
        <h2 className="journal-title">Your career, journaled</h2>
      </div>
      <div className="journal-entries">
        {entries.map((entry) => (
          <div key={entry.label} className="journal-entry">
            <span className="journal-entry-label">{entry.label}</span>
            <p className="journal-entry-text">{entry.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}