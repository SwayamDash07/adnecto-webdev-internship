const features = [
  {
    title: "One Profile",
    description: "A single place for your bio, skills, and experience. All in one view.",
  },
  {
    title: "Full Control",
    description: "Edit anything you entered at signup, anytime, including your password.",
  },
  {
    title: "Built to Last",
    description: "Your data stays secured server-side, nothing exposed to the browser.",
  },
];

export default function FeaturesSection() {
  return (
    <section className="features-section">
      <div className="features-heading">
        <span className="features-eyebrow">Why this exists</span>
        <h2 className="features-title">Everything about you, in one place</h2>
      </div>
      <div className="features-grid">
        {features.map((feature) => (
          <div key={feature.title} className="feature-card">
            <h3 className="feature-title">{feature.title}</h3>
            <p className="feature-description">{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}