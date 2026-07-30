import { requireUser } from "@/lib/auth-guard";
import { connectDB } from "@/lib/db";
import AiConversation from "@/models/AiConversation";
import AiChatPanel from "./AiChatPanel";

export const dynamic = "force-dynamic";

export default async function AiChatPage() {
  const currentUser = await requireUser();
  await connectDB();
  const conversation = await AiConversation.findOne({ userId: currentUser._id }).lean<any>();
  const messages = (conversation?.messages || []).map((message: any) => ({
    role: message.role,
    content: message.content,
    createdAt: new Date(message.createdAt).toISOString(),
  }));

  return <div className="container ai-chat-page"><div className="ai-chat-heading"><div className="ai-chat-heading-icon">✦</div><div><h1>Nova</h1><p>A private AI assistant for this account.</p></div></div><AiChatPanel initialMessages={messages} /></div>;
}

