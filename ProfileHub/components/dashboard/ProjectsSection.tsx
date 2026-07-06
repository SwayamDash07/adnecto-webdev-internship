import Link from "next/link";

type ProjectEntry = {
  _id: string;
  title: string;
  description?: string;
  link?: string;
};

export default function ProjectsSection({
  projects,
  addAction,
  deleteAction,
  isAdding,
  canEdit,
}: {
  projects: ProjectEntry[];
  addAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
  isAdding: boolean;
  canEdit: boolean;
}) {
  if (projects.length === 0 && !isAdding && !canEdit) {
    return null;
  }

  return (
    <div className="section-card">
      <div className="section-card-header">
        <h2 className="section-card-title">Projects</h2>
        {!isAdding && canEdit && (
          <Link href="/dashboard?mode=edit&edit=project" className="pencil-button">Add</Link>
        )}
      </div>

      {isAdding && (
        <form action={addAction} className="auth-form">
          <input className="field-input" name="title" placeholder="Project title" required />
          <textarea className="field-input field-textarea" name="description" rows={3} placeholder="Description (optional)" />
          <input className="field-input" name="link" placeholder="Link, e.g. GitHub or live demo (optional)" />
          <div className="edit-actions">
            <button type="submit" className="submit-button">Save</button>
            <Link href="/dashboard?mode=edit" className="cancel-button">Cancel</Link>
          </div>
        </form>
      )}

      {projects.length === 0 && !isAdding && canEdit && (
        <p className="bio-text">No projects added yet.</p>
      )}

      <div className="experience-list">
        {projects.map((entry) => (
          <div key={entry._id} className="experience-item">
            <div className="experience-item-header">
              <div>
                <h3 className="experience-title">{entry.title}</h3>
                {entry.link && (
                  <a href={entry.link} target="_blank" rel="noopener noreferrer" className="project-link">
                    {entry.link}
                  </a>
                )}
              </div>
              {canEdit && (
                <form action={deleteAction}>
                  <input type="hidden" name="projectId" value={entry._id} />
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