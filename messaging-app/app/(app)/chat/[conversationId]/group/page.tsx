import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-guard";
import { connectDB } from "@/lib/db";
import Conversation from "@/models/Conversation";
import User from "@/models/User";
import { addGroupMembersAction, demoteGroupAdminAction, leaveGroupAction, promoteGroupAdminAction, removeGroupMemberAction, updateGroupAction } from "../../actions";
import GroupAddMemberPicker from "./GroupAddMemberPicker";
import GroupModerationForm from "./GroupModerationForm";

export default async function GroupDetailsPage({ params, searchParams }: { params: Promise<{ conversationId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const currentUser = await requireUser();
  const { conversationId } = await params;
  const query = await searchParams;
  await connectDB();
  const conversation: any = await Conversation.findOne({ _id: conversationId, type: "group", participants: currentUser._id }).populate("participants", "name username avatarUrl").populate("creator", "name username").lean();
  if (!conversation) redirect("/chat");
  const participantIds = conversation.participants.map((member: any) => member._id);
  const availableUsers = await User.find({ _id: { $nin: participantIds } }).select("name username avatarUrl").sort({ name: 1 }).limit(250).lean<any[]>();
  const creatorId = String(conversation.creator?._id || conversation.creator);
  const currentUserId = String(currentUser._id);
  const isCreator = creatorId === currentUserId;
  const isAdmin = isCreator || (conversation.admins || []).some((id: any) => String(id) === currentUserId);
  const adminIds = new Set((conversation.admins || []).map((id: any) => String(id)));
  const errorMessages: Record<string, string> = { not_allowed: "You do not have permission for that action.", moderation_not_allowed: "Only the group creator can change moderation permissions.", moderation_invalid: "Choose a valid moderation option.", creator_protected: "The group creator cannot be removed or demoted.", admin_protected: "Only the group creator can remove an admin.", creator_only: "Only the group creator can change admin roles.", creator_leave: "The creator cannot leave the group.", details: "Add a valid group name.", photo: "Group photos must be images under 8MB.", members: "Choose at least one new member.", no_members: "Those people are already in the group.", too_many_members: "Groups can have up to 256 people.", invalid_member: "That person is not in this group." };

  return (
    <div className="container group-details-page">
      <Link href={`/chat/${conversationId}`} className="page-back-link">← Back to group chat</Link>
      <div className="group-details-heading"><div className="avatar group-large-avatar">👥</div><div><h1>{conversation.name}</h1><p>{conversation.description || "No group description"}</p><span>{conversation.participants.length} members · Created by {conversation.creator?.name || "the creator"}</span></div></div>
      {query.error && <div className="error-text group-error">{errorMessages[query.error] || "Unable to complete that action."}</div>}
      {query.success && <div className="group-success">{query.success === "moderation" ? "Moderation permissions updated." : "Group updated."}</div>}
      {isAdmin && <form action={updateGroupAction} className="card group-settings-card"><input type="hidden" name="conversationId" value={conversationId} /><div className="profile-section-title">Group details</div><div className="field-group"><label className="field-label" htmlFor="name">Group name</label><input id="name" name="name" className="text-input" defaultValue={conversation.name} maxLength={80} required /></div><div className="field-group"><label className="field-label" htmlFor="description">Bio</label><textarea id="description" name="description" className="text-input group-description-input" defaultValue={conversation.description} maxLength={500} /></div><div className="field-group"><label className="field-label" htmlFor="photo">Change group photo</label><input id="photo" name="photo" type="file" accept="image/*" className="text-input group-file-input" /></div><button className="submit-button group-submit">Save group details</button></form>}
      {isCreator && <GroupModerationForm conversationId={conversationId} moderationMode={conversation.moderationMode || "all"} />}
      {isAdmin && availableUsers.length > 0 && <form action={addGroupMembersAction} className="card group-members-card"><div className="profile-section-title">Add members</div><GroupAddMemberPicker users={JSON.parse(JSON.stringify(availableUsers))} /><input type="hidden" name="conversationId" value={conversationId} /><button className="submit-button group-submit">Add selected members</button></form>}
      <section className="card group-members-card"><div className="group-members-heading"><div className="profile-section-title">Members</div>{isCreator && <span className="group-role-note">You are the creator</span>}</div><div className="group-members-list">{conversation.participants.map((member: any) => { const memberId = String(member._id); const memberIsCreator = memberId === creatorId; const memberIsAdmin = memberIsCreator || adminIds.has(memberId); const canRemove = isAdmin && !memberIsCreator && (isCreator || !memberIsAdmin); return <div className="group-member-row" key={memberId}><div className="avatar">{member.name.charAt(0).toUpperCase()}</div><div className="group-member-copy"><strong>{member.name}{memberId === currentUserId ? " (You)" : ""}</strong><span>@{member.username}</span></div><div className="group-member-badges">{memberIsCreator && <span className="group-role-badge creator">Creator</span>}{!memberIsCreator && memberIsAdmin && <span className="group-role-badge">Admin</span>}</div><div className="group-member-actions">{isCreator && !memberIsCreator && (memberIsAdmin ? <form action={demoteGroupAdminAction}><input type="hidden" name="conversationId" value={conversationId} /><input type="hidden" name="targetUserId" value={memberId} /><button className="text-action-button">Remove admin</button></form> : <form action={promoteGroupAdminAction}><input type="hidden" name="conversationId" value={conversationId} /><input type="hidden" name="targetUserId" value={memberId} /><button className="text-action-button">Make admin</button></form>)}{canRemove && <form action={removeGroupMemberAction}><input type="hidden" name="conversationId" value={conversationId} /><input type="hidden" name="targetUserId" value={memberId} /><button className="text-action-button danger">Remove</button></form>}</div></div>})}</div></section>
      {!isCreator && <form action={leaveGroupAction} className="group-leave-form"><input type="hidden" name="conversationId" value={conversationId} /><button className="text-action-button danger">Leave group</button></form>}
    </div>
  );
}
