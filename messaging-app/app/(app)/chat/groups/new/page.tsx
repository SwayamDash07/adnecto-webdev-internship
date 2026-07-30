import Link from "next/link";
import { requireUser } from "@/lib/auth-guard";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { createGroupAction } from "../../actions";
import GroupMemberPicker from "./GroupMemberPicker";

export default async function CreateGroupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const currentUser = await requireUser();
  const query = await searchParams;
  await connectDB();
  const users = await User.find({ _id: { $ne: currentUser._id } }).select("name username avatarUrl").sort({ name: 1 }).limit(250).lean<any[]>();
  const error = query.error === "name" ? "Add a group name up to 80 characters." : query.error === "members" ? "Choose at least one member." : query.error === "too_many_members" ? "Groups can have up to 256 people." : query.error === "photo" ? "Choose an image under 8MB." : null;
  return <div className="container group-create-page"><Link href="/chat" className="page-back-link">← Back to chats</Link><div className="group-page-heading"><div className="group-create-icon">⌂</div><div><h1>Create a group</h1><p>Start a conversation with the people you choose.</p></div></div>{error && <div className="error-text group-error">{error}</div>}<form action={createGroupAction} className="card group-create-card"><div className="field-group"><label className="field-label" htmlFor="group-name">Group name</label><input id="group-name" name="name" className="text-input" maxLength={80} placeholder="e.g. Weekend plans" required autoFocus /></div><div className="field-group"><label className="field-label" htmlFor="group-description">About this group <span>(optional)</span></label><textarea id="group-description" name="description" className="text-input group-description-input" maxLength={500} placeholder="What is this group about?" /></div><div className="field-group"><label className="field-label" htmlFor="group-photo">Group photo <span>(optional)</span></label><input id="group-photo" name="photo" type="file" accept="image/*" className="text-input group-file-input" /></div><GroupMemberPicker users={JSON.parse(JSON.stringify(users))} currentUserId={String(currentUser._id)} /><div className="group-form-actions"><Link href="/chat" className="submit-button secondary group-cancel">Cancel</Link><button type="submit" className="submit-button group-submit">Create group</button></div></form></div>;
}
