import Link from "next/link";

type EducationEntry = {
  _id: string;
  degree: string;
  institution: string;
  duration: string;
  description?: string;
};

export default function EducationSection({
  education,
  addAction,
  deleteAction,
  isAdding,
  canEdit,
}: {
  education: EducationEntry[];
  addAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
  isAdding: boolean;
  canEdit: boolean;
}) {
  if (education.length === 0 && !isAdding && !canEdit) {
    return null;
  }

  return (
    <div className="section-card">
      <div className="section-card-header">
        <h2 className="section-card-title">Education</h2>
        {!isAdding && canEdit && (
          <Link href="/dashboard?mode=edit&edit=education" className="pencil-button">Add</Link>
        )}
      </div>

      {isAdding && (
        <form action={addAction} className="auth-form">
          <input className="field-input" name="degree" placeholder="Degree, e.g. B.Tech Computer Science" required />
          <input className="field-input" name="institution" placeholder="Institution" required />
          <input className="field-input" name="duration" placeholder="e.g. 2022 - 2026" required />
          <textarea className="field-input field-textarea" name="description" rows={3} placeholder="Description (optional)" />
          <div className="edit-actions">
            <button type="submit" className="submit-button">Save</button>
            <Link href="/dashboard?mode=edit" className="cancel-button">Cancel</Link>
          </div>
        </form>
      )}

      {education.length === 0 && !isAdding && canEdit && (
        <p className="bio-text">No education added yet.</p>
      )}

      <div className="experience-list">
        {education.map((entry) => (
          <div key={entry._id} className="experience-item">
            <div className="experience-item-header">
              <div>
                <h3 className="experience-title">{entry.degree}</h3>
                <p className="experience-company">{entry.institution} · {entry.duration}</p>
              </div>
              {canEdit && (
                <form action={deleteAction}>
                  <input type="hidden" name="educationId" value={entry._id} />
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