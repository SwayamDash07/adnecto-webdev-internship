"use client";

import { useState } from "react";
import { dismissModerationNoticeAction, submitAppealAction } from "@/app/(app)/moderation/actions";

export default function ModerationNoticeCard({ notice }: { notice: any }) {
  const [closed, setClosed] = useState(false);
  if (closed) return null;
  return <article className={`moderation-notice moderation-notice-${notice.type}`}><div className="moderation-notice-header"><div><strong>{notice.title}</strong><span>{new Date(notice.createdAt).toLocaleDateString()}</span></div><form action={dismissModerationNoticeAction} onSubmit={() => setClosed(true)}><input type="hidden" name="noticeId" value={String(notice._id)} /><button type="submit" className="moderation-notice-close" aria-label="Close notice">Close</button></form></div><p>{notice.message}</p>{notice.reason && <div className="moderation-notice-reason">Reason: {notice.reason}</div>}{notice.type === "ban" && (notice.appealSubmitted ? <div className="moderation-notice-status">Appeal submitted</div> : <form action={submitAppealAction} className="moderation-appeal-form"><input type="hidden" name="noticeId" value={String(notice._id)} /><textarea name="reason" className="text-input" placeholder="Explain why you believe this action should be reconsidered" maxLength={1000} required /><button type="submit" className="submit-button">Appeal decision</button></form>)}</article>;
}
