"use client";

import { useState, useTransition } from "react";
import { clearAiConversation, sendMessageToAi, type AiChatActionState, type AiChatMessage } from "./actions";

function MessageList({ messages }: { messages: AiChatMessage[] }) {
  return <div className="ai-chat-messages">{messages.length === 0 ? <div className="ai-chat-empty"><div className="ai-chat-empty-icon">✦</div><strong>Say hi to Nova</strong><span>Your conversation is private to this account.</span></div> : messages.map((message, index) => <div className={`ai-chat-message-row ${message.role === "user" ? "mine" : "theirs"}`} key={`${message.createdAt}-${index}`}><div className={`ai-chat-message-bubble ${message.role === "user" ? "mine" : "theirs"}`}>{message.content}</div></div>)}</div>;
}

export default function AiChatPanel({ initialMessages }: { initialMessages: AiChatMessage[] }) {
  const [state, setState] = useState<AiChatActionState>({ messages: initialMessages, error: null });
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = text.trim();
    if (!message || pending) return;
    setText("");
    startTransition(() => {
      sendMessageToAi(message).then(setState).catch(() => setState((current) => ({ ...current, error: "Nova couldn't respond, try again" })));
    });
  }

  function handleClear() {
    if (pending || !window.confirm("Clear your conversation with Nova?")) return;
    startTransition(() => {
      clearAiConversation().then(setState).catch(() => setState((current) => ({ ...current, error: "Nova couldn't clear the conversation, try again" })));
    });
  }

  return <div className="ai-chat-card"><div className="ai-chat-toolbar"><span>Private conversation</span><button type="button" className="ai-chat-clear-button" onClick={handleClear} disabled={pending}>Clear conversation</button></div><MessageList messages={state.messages} />{pending && <div className="ai-chat-thinking" aria-live="polite">Nova is thinking<span className="ai-chat-thinking-dots"><i>.</i><i>.</i><i>.</i></span></div>}{state.error && <div className="ai-chat-error">{state.error}</div>}<form onSubmit={handleSubmit} className="ai-chat-input-form"><input name="text" value={text} onChange={(event) => setText(event.target.value)} className="text-input" placeholder="Message Nova" maxLength={2000} autoComplete="off" required /><button type="submit" className="chat-send-button" disabled={pending}>{pending ? "Thinking…" : "Send"}</button></form></div>;
}

