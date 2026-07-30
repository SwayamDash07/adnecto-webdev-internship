import Link from "next/link";
import { requireUser } from "@/lib/auth-guard";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import InputField from "@/components/ui/InputField";
import SubmitButton from "@/components/ui/SubmitButton";
import { changePasswordAction, updatePersonalChatModerationAction } from "./actions";
import { unblockUserAction } from "@/app/(app)/friends/actions";

const ERROR_MESSAGES: Record<string, string> = {
  weak_password: "New password must be at least 8 characters.",
  wrong_current_password: "Your current password was incorrect.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; section?: string }>;
}) {
  const currentUser = await requireUser();
  const query = await searchParams;
  const section = query.section === "blocked" ? "blocked" : query.section === "password" ? "password" : query.section === "personal-chats" ? "personal-chats" : "all";
  const showPassword = section === "all" || section === "password";
  const showBlocked = section === "all" || section === "blocked";
  const showPersonalChats = section === "all" || section === "personal-chats";
  const title =
    section === "password" ? "Change password" : section === "blocked" ? "Blocked users" : section === "personal-chats" ? "Personal chats" : "Settings";
  await connectDB();

  const userWithBlocked = await User.findById(currentUser._id)
    .populate("blockedUsers", "name username")
    .lean<any>();

  const errorMessage = query.error ? ERROR_MESSAGES[query.error] : null;
  const moderationMode = userWithBlocked?.personalChatModeration || "all";

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <Link href={`/profile/${currentUser.username}`} className="page-back-link">
        Back to profile
      </Link>
      <div className="brand" style={{ marginBottom: 4 }}>{title}</div>

      {showPersonalChats && (
        <div className="card" style={{ marginTop: 20 }}>
          <div id="personal-chats" className="profile-section-title" style={{ marginBottom: 12 }}>Chats to be monitored</div>
          <p className="user-card-meta" style={{ marginBottom: 16 }}>Choose which messages in your personal conversations can be reviewed by the moderation team.</p>
          {query.error === "moderation_invalid" && <div className="error-text">Choose a valid monitoring option.</div>}
          {query.success === "moderation_updated" && <div className="user-card-meta auto-dismiss-success" style={{ color: "var(--success)", marginBottom: 16 }}>Personal chat moderation updated.</div>}
          <form action={updatePersonalChatModerationAction}>
            <div className="field-group">
              <label className="field-label" htmlFor="personalChatModeration">Monitor</label>
              <select id="personalChatModeration" name="personalChatModeration" className="text-input" defaultValue={moderationMode}>
                <option value="strangers">Only messages from strangers</option>
                <option value="all">All personal chats</option>
                <option value="none">No personal chats</option>
              </select>
            </div>
            <SubmitButton label="Save monitoring preference" variant="secondary" />
          </form>
        </div>
      )}

      {showPassword && (
        <div className="card" style={{ marginTop: 20 }}>
          {errorMessage && <div className="error-text">{errorMessage}</div>}
          {query.success === "password_changed" && (
            <div className="user-card-meta auto-dismiss-success" style={{ color: "var(--success)", marginBottom: 16 }}>
              Password updated.
            </div>
          )}
          <div id="password" className="profile-section-title" style={{ marginBottom: 12 }}>Change password</div>
          <form action={changePasswordAction}>
            <InputField label="Current password" name="currentPassword" type="password" required />
            <InputField label="New password" name="newPassword" type="password" required />
            <SubmitButton label="Update password" variant="secondary" />
          </form>
        </div>
      )}

      {showBlocked && (
        <div className="card" style={{ marginTop: 20 }}>
          <div id="blocked" className="profile-section-title" style={{ marginBottom: 12 }}>Blocked users</div>
          {(!userWithBlocked?.blockedUsers || userWithBlocked.blockedUsers.length === 0) && (
            <div className="user-card-meta">You haven't blocked anyone.</div>
          )}
          {userWithBlocked?.blockedUsers?.map((blockedUser: any) => (
            <div key={blockedUser._id} className="friend-row">
              <div className="avatar">{blockedUser.name.charAt(0).toUpperCase()}</div>
              <div style={{ flex: 1 }}>
                <div className="user-card-name">{blockedUser.name}</div>
                <div className="user-card-meta">@{blockedUser.username}</div>
              </div>
              <form action={unblockUserAction}>
                <input type="hidden" name="targetUserId" value={String(blockedUser._id)} />
                <input type="hidden" name="returnTo" value="/profile/settings?section=blocked" />
                <button type="submit" className="submit-button secondary" style={{ width: "auto", padding: "8px 14px" }}>
                  Unblock
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
