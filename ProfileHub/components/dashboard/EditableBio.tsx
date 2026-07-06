import Link from "next/link";

export default function EditableBio({
  bio,
  action,
  isEditing,
  canEdit,
}: {
  bio: string;
  action: (formData: FormData) => void;
  isEditing: boolean;
  canEdit: boolean;
}) {
  return (
    <div className="section-card">
      <div className="section-card-header">
        <h2 className="section-card-title">Bio</h2>
        {!isEditing && canEdit && (
          <Link href="/dashboard?mode=edit&edit=bio" className="pencil-button">Edit</Link>
        )}
      </div>
      {isEditing ? (
        <form action={action} className="auth-form">
          <textarea className="field-input field-textarea" name="bio" rows={4} defaultValue={bio} />
          <div className="edit-actions">
            <button type="submit" className="submit-button">Save</button>
            <Link href="/dashboard?mode=edit" className="cancel-button">Cancel</Link>
          </div>
        </form>
      ) : (
        <p className="bio-text">{bio || "No bio added yet."}</p>
      )}
    </div>
  );
}