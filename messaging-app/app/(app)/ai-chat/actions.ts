"use server";

import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { createGroqChatCompletion } from "@/lib/groq";
import AiConversation from "@/models/AiConversation";
import User from "@/models/User";

const MAX_MESSAGE_LENGTH = 2000;
const CONTEXT_MESSAGE_COUNT = 20;

export type AiChatMessage = {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type AiChatActionState = {
  messages: AiChatMessage[];
  error: string | null;
};

function serializeMessages(messages: any[]): AiChatMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
    createdAt: new Date(message.createdAt).toISOString(),
  }));
}

function buildProfileSystemPrompt(profile: any) {
  const profileEntries: Array<[string, unknown]> = [
    ["Name", profile?.name],
    ["Location", profile?.location],
    ["Hobbies", Array.isArray(profile?.hobbies) ? profile.hobbies.map(String).join(", ") : ""],
    ["Interests", Array.isArray(profile?.interests) ? profile.interests.map(String).join(", ") : ""],
    ["Music taste", profile?.musicTaste],
    ["Movie taste", profile?.movieTaste],
    ["Favorite food", profile?.favoriteFood],
    ["Bio", profile?.bio],
    ["About", profile?.personalNote],
  ];

  const availableProfileEntries = profileEntries
    .map(([label, value]) => [label, String(value || "").trim()] as [string, string])
    .filter(([, value]) => value.length > 0)
    .map(([label, value]) => label + ": " + value);

  return [
    "You are Nova, a helpful, concise in-app AI assistant.",
    "Use the current user's profile naturally when relevant. Do not force personalization into every reply.",
    "Treat the following profile as reference data for this request only:",
    ...availableProfileEntries,
  ].join("\n");
}

export async function sendMessageToAi(text: string): Promise<AiChatActionState> {
  const currentUser = await requireUser();
  await connectDB();

  const userId = currentUser._id;
  const profile = await User.findById(userId)
    .select("name location hobbies interests musicTaste movieTaste favoriteFood bio personalNote")
    .lean<any>();
  let conversation = await AiConversation.findOne({ userId });

  text = String(text || "").trim();
  if (!text || text.length > MAX_MESSAGE_LENGTH) {
    return {
      messages: serializeMessages(conversation?.messages || []),
      error: "Enter a message under 2,000 characters.",
    };
  }
  if (!conversation) conversation = await AiConversation.create({ userId, messages: [] });

  const userMessage = { role: "user" as const, content: text, createdAt: new Date() };
  const context = [...conversation.messages, userMessage]
    .slice(-CONTEXT_MESSAGE_COUNT)
    .map((message: any) => ({
      role: message.role,
      content: message.content,
    }));
  const systemPrompt = buildProfileSystemPrompt(profile);

  conversation.messages.push(userMessage);

  try {
    const response = await createGroqChatCompletion([
      { role: "system", content: systemPrompt },
      ...context,
    ]);
    conversation.messages.push({ role: "assistant", content: response, createdAt: new Date() });
    await conversation.save();
    return { messages: serializeMessages(conversation.messages), error: null };
  } catch {
    await conversation.save();
    return { messages: serializeMessages(conversation.messages), error: "Nova couldn't respond, try again" };
  }
}

export async function clearAiConversation(): Promise<AiChatActionState> {
  const currentUser = await requireUser();
  await connectDB();
  await AiConversation.deleteOne({ userId: currentUser._id });
  return { messages: [], error: null };
}
