import Link from "next/link";

type ExperienceEntry = {
  _id: string;
  title: string;
  company: string;
  duration: string;
  description?: string;
};

export default function ExperienceSection({
  experience,
  addAction,
  deleteAction,
  isAdding,
  canEdit,
}: {
  experience: ExperienceEntry[];
  addAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
  isAdding: boolean;
  canEdit: boolean;
}) {
  return (
    <div className="section-card">
      <div className="section-card-header">
        <h2 className="section-card-title">Experience</h2>
        {!isAdding && canEdit && (
          <Link href="/dashboard?mode=edit&edit=experience" className="pencil-button">Add</Link>
        )}
      </div>

      {isAdding && (
        <form action={addAction} className="auth-form">
          <input className="field-input" name="title" placeholder="Role title" required />
          <input className="field-input" name="company" placeholder="Company" required />
          <input className="field-input" name="duration" placeholder="e.g. Jan 2025 - Present" required />
          <textarea className="field-input field-textarea" name="description" rows={3} placeholder="Description" />
          <div className="edit-actions">
            <button type="submit" className="submit-button">Save</button>
            <Link href="/dashboard?mode=edit" className="cancel-button">Cancel</Link>
          </div>
        </form>
      )}

      {experience.length === 0 && !isAdding && (
        <p className="bio-text">No experience added yet.</p>
      )}

      <div className="experience-list">
        {experience.map((entry) => (
          <div key={entry._id} className="experience-item">
            <div className="experience-item-header">
              <div>
                <h3 className="experience-title">{entry.title}</h3>
                <p className="experience-company">{entry.company} · {entry.duration}</p>
              </div>
              {canEdit && (
                <form action={deleteAction}>
                  <input type="hidden" name="experienceId" value={entry._id} />
                  <button type="submit" className="delete-button">Remove</button>
                </form>
              )}
            </div>
            {entry.description && <p className="experience-description">{entry.description}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}