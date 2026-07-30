import { updateGroupModerationAction } from "../../actions";

export default function GroupModerationForm({ conversationId, moderationMode }: { conversationId: string; moderationMode: string }) {
  return (
    <form action={updateGroupModerationAction} className="card group-settings-card">
      <input type="hidden" name="conversationId" value={conversationId} />
      <div className="profile-section-title">Moderation permissions</div>
      <p className="user-card-meta">Only the group owner can change whether flagged messages in this group are sent to moderation.</p>
      <div className="field-group">
        <label className="field-label" htmlFor="moderationMode">Monitor</label>
        <select id="moderationMode" name="moderationMode" className="text-input" defaultValue={moderationMode || "all"}>
          <option value="all">Yes</option>
          <option value="none">No</option>
        </select>
      </div>
      <button className="submit-button group-submit">Save moderation permission</button>
    </form>
  );
}
