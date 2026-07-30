import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-guard";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import InputField from "@/components/ui/InputField";
import SubmitButton from "@/components/ui/SubmitButton";
import FriendActionButton from "@/components/friends/FriendActionButton";
import { updateProfileAction } from "./actions";
import { startConversationAction } from "@/app/(app)/chat/actions";
import { blockUserAction } from "@/app/(app)/friends/actions";
import { getFriendStatus, hasBlockedUser } from "@/lib/relationships";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_name: "Name is required and must be under 60 characters.",
  invalid_location: "Location is required and must be under 100 characters.",
  restricted: "Your account is currently restricted from sending friend requests.",
};

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ edit?: string; error?: string }>;
}) {
  const { username } = await params;
  const query = await searchParams;
  const currentUser = await requireUser();

  await connectDB();
  const profileUser = await User.findOne({ username: username.toLowerCase() }).lean<any>();
  if (!profileUser) redirect("/search");

  const isOwnProfile = String(profileUser._id) === String(currentUser._id);
  const editMode = isOwnProfile && query.edit === "true";
  const errorMessage = query.error ? ERROR_MESSAGES[query.error] : null;
  const iBlockedThem = isOwnProfile ? false : await hasBlockedUser(String(currentUser._id), String(profileUser._id));
  const friendStatus = !isOwnProfile && !iBlockedThem ? await getFriendStatus(String(currentUser._id), String(profileUser._id)) : null;
  const avatarUrl = String(profileUser.avatarUrl || "").trim();
  const hobbies = profileUser.hobbies || [];
  const interests = profileUser.interests || [];
  const personalNote = String(profileUser.personalNote || "").trim();
  const hasHobbies = hobbies.length > 0;
  const hasInterests = interests.length > 0;
  const summaryItems = [
    { label: "Location", value: profileUser.location },
    { label: "Music", value: profileUser.musicTaste },
    { label: "Movies / shows", value: profileUser.movieTaste },
    { label: "Favorite food", value: profileUser.favoriteFood },
  ].filter((item) => item.value);

  return (
    <div className={editMode ? "container profile-page profile-edit-page" : "container profile-page"}>
      {!editMode ? (
        <div className="profile-layout">
          <div className="card profile-summary-card">
            <div className="profile-header profile-summary-header">
              <div
                className="avatar profile-avatar profile-avatar-image"
                style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}
              >
                {!avatarUrl && profileUser.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div className="brand" style={{ marginBottom: 2 }}>
                  {profileUser.name}
                </div>
                <div className="user-card-meta">@{profileUser.username}</div>
                {profileUser.bio && <div className="user-card-meta profile-bio">{profileUser.bio}</div>}
              </div>
            </div>

            <div className="profile-summary-grid">
              {summaryItems.map((item) => (
                <div key={item.label} className="profile-summary-item">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>

            {(hasHobbies || hasInterests) && (
              <div className="profile-personal-section">
                {hasHobbies && (
                  <div className="profile-chip-group">
                    <div className="profile-section-title">Hobbies</div>
                    <div className="profile-tags">
                      {hobbies.join(", ")}
                    </div>
                  </div>
                )}
                {hasInterests && (
                  <div className="profile-chip-group">
                    <div className="profile-section-title">Interests</div>
                    <div className="profile-tags">
                      {interests.join(", ")}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="profile-detail-row">
              <div className="profile-detail-panel">
                <div className="profile-section-title">A little more</div>
                <p>{personalNote || "No extra note added yet."}</p>
              </div>
            </div>

            {!isOwnProfile && (
              <div className="profile-primary-actions">
                <form action={startConversationAction}>
                  <input type="hidden" name="targetUsername" value={profileUser.username} />
                  <button type="submit" className="submit-button" style={{ width: "auto", padding: "10px 18px" }}>
                    Message
                  </button>
                </form>
                {friendStatus && (
                  <FriendActionButton
                    status={friendStatus.status}
                    requestId={friendStatus.requestId}
                    targetUsername={profileUser.username}
                  />
                )}
                <form action={blockUserAction}>
                  <input type="hidden" name="targetUsername" value={profileUser.username} />
                  <button type="submit" className="submit-button secondary" style={{ width: "auto", padding: "10px 18px", color: "var(--danger)" }}>
                    Block
                  </button>
                </form>
              </div>
            )}
          </div>

          <div className="profile-sidebar">
            {isOwnProfile ? (
              <div className="card profile-actions-card">
                <div className="profile-section-title" style={{ marginBottom: 12 }}>Quick actions</div>
                <div className="profile-pill-stack">
                  <Link href={`/profile/${username}?edit=true`} className="profile-pill">
                    Edit details
                  </Link>
                  <Link href={`/profile/${username}?edit=true#avatarUrl`} className="profile-pill">
                    Edit picture
                  </Link>
                  <Link href="/profile/settings?section=password" className="profile-pill">
                    Change password
                  </Link>
                  <Link href="/profile/settings?section=blocked" className="profile-pill">
                    Blocked users
                  </Link>
                  <Link href="/profile/settings?section=personal-chats" className="profile-pill">
                    Personal chat moderation
                  </Link>
                  <Link href="/friends" className="profile-pill">
                    Friends
                  </Link>
                </div>
              </div>
            ) : (
              <div className="card profile-actions-card">
                <div className="profile-section-title" style={{ marginBottom: 12 }}>Actions</div>
                <div className="profile-pill-stack">
                  <form action={startConversationAction}>
                    <input type="hidden" name="targetUsername" value={profileUser.username} />
                    <button type="submit" className="profile-pill profile-pill-button">Message</button>
                  </form>
                  {friendStatus && (
                    <FriendActionButton
                      status={friendStatus.status}
                      requestId={friendStatus.requestId}
                      targetUsername={profileUser.username}
                    />
                  )}
                  <form action={blockUserAction}>
                    <input type="hidden" name="targetUsername" value={profileUser.username} />
                    <button type="submit" className="profile-pill profile-pill-button">Block</button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card profile-edit-card">
          <Link href={`/profile/${username}`} className="page-back-link">
            Back to profile
          </Link>
          {errorMessage && <div className="error-text">{errorMessage}</div>}
          <div className="brand" style={{ marginBottom: 16 }}>Edit profile</div>
          <form action={updateProfileAction} className="profile-edit-form">
            <InputField label="Full name" name="name" defaultValue={profileUser.name} required maxLength={60} />
            <InputField
              label="Profile picture URL"
              name="avatarUrl"
              defaultValue={profileUser.avatarUrl || ""}
              maxLength={300}
            />
            <InputField label="Location" name="location" defaultValue={profileUser.location} required maxLength={100} />
            <InputField label="Hobbies (comma separated)" name="hobbies" defaultValue={hobbies.join(", ")} maxLength={300} />
            <InputField label="Interests (comma separated)" name="interests" defaultValue={interests.join(", ")} maxLength={300} />
            <InputField label="Music taste" name="musicTaste" defaultValue={profileUser.musicTaste || ""} maxLength={160} />
            <InputField label="Movies / shows" name="movieTaste" defaultValue={profileUser.movieTaste || ""} maxLength={160} />
            <InputField label="Favorite food" name="favoriteFood" defaultValue={profileUser.favoriteFood || ""} maxLength={120} />
            <div className="field-group profile-edit-bio">
              <label className="field-label" htmlFor="bio">Short bio</label>
              <textarea id="bio" name="bio" defaultValue={profileUser.bio} maxLength={160} rows={2} className="text-input" />
            </div>
            <div className="field-group profile-edit-bio">
              <label className="field-label" htmlFor="personalNote">A little more about you</label>
              <textarea
                id="personalNote"
                name="personalNote"
                defaultValue={personalNote}
                maxLength={420}
                rows={4}
                className="text-input"
              />
            </div>
            <div className="profile-primary-actions profile-edit-actions">
              <SubmitButton label="Save changes" />
              <Link href={`/profile/${username}`} className="submit-button secondary" style={{ padding: "12px 18px" }}>
                Cancel
              </Link>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
