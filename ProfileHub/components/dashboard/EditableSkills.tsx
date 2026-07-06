import Link from "next/link";

export default function EditableSkills({
  skills,
  action,
  isEditing,
  canEdit,
}: {
  skills: string[];
  action: (formData: FormData) => void;
  isEditing: boolean;
  canEdit: boolean;
}) {
  return (
    <div className="section-card">
      <div className="section-card-header">
        <h2 className="section-card-title">Skills</h2>
        {!isEditing && canEdit && (
          <Link href="/dashboard?mode=edit&edit=skills" className="pencil-button">Edit</Link>
        )}
      </div>
      {isEditing ? (
        <form action={action} className="auth-form">
          <input
            className="field-input"
            name="skills"
            placeholder="Comma separated, e.g. React, Node.js, MongoDB"
            defaultValue={skills.join(", ")}
          />
          <div className="edit-actions">
            <button type="submit" className="submit-button">Save</button>
            <Link href="/dashboard?mode=edit" className="cancel-button">Cancel</Link>
          </div>
        </form>
      ) : skills.length > 0 ? (
        <div className="skills-list">
          {skills.map((skill) => (
            <span key={skill} className="skill-tag">{skill}</span>
          ))}
        </div>
      ) : (
        <p className="bio-text">No skills added yet.</p>
      )}
    </div>
  );
}