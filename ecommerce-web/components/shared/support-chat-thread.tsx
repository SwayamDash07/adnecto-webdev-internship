'use client'

import { useEffect, useRef, useState } from 'react'
import { Bot, CircleDot, LockKeyhole } from 'lucide-react'

export type SupportChatMessage = {
  id: string | number
  sender_id?: string | null
  sender_role: 'customer' | 'staff' | 'system'
  body: string
  is_internal?: boolean
  created_at: string
  sender_name?: string | null
  message_kind?: 'message' | 'assistant' | 'event' | null
  delivery_state?: 'sending' | 'sent' | 'failed'
}

function dayName(value: string, now: Date) {
  const date = new Date(value)
  const istDay = (input: Date) => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(input)
    return Date.UTC(Number(parts.find(part => part.type === 'year')?.value), Number(parts.find(part => part.type === 'month')?.value) - 1, Number(parts.find(part => part.type === 'day')?.value))
  }
  const diff = Math.round((istDay(now) - istDay(date)) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
}
const timeLabel = (value: string) => new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })
const firstName = (value?: string | null) => value?.trim().split(/\s+/)[0] || 'Support'
const isAssistant = (m: SupportChatMessage) => m.message_kind === 'assistant' || (m.sender_role === 'system' && m.sender_name === 'Cartly Assistant')
const isEvent = (m: SupportChatMessage) => m.message_kind === 'event' || (m.sender_role === 'system' && !isAssistant(m))
const groupKey = (m: SupportChatMessage) => m.is_internal ? 'internal' : isEvent(m) ? `event-${m.id}` : isAssistant(m) ? 'assistant' : m.sender_role

export function SupportChatThread({ messages, viewerRole, onRetry, initialNow }: { messages: SupportChatMessage[]; viewerRole: 'customer' | 'staff'; onRetry?: (message: SupportChatMessage) => void; initialNow?: string }) {
  const [now] = useState(() => new Date(initialNow ?? new Date().toISOString()))
  const scroller = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)
  const [showNew, setShowNew] = useState(false)
  const visible = messages.filter(message => viewerRole === 'staff' || !message.is_internal)
  const lastOwn = [...visible].reverse().find(message => message.sender_role === viewerRole && !message.is_internal)
  const groups: SupportChatMessage[][] = []
  for (const message of visible) {
    const previous = groups.at(-1)?.at(-1)
    if (previous && groupKey(previous) === groupKey(message) && dayName(previous.created_at, now) === dayName(message.created_at, now)) groups.at(-1)!.push(message)
    else groups.push([message])
  }
  useEffect(() => {
    const pane = scroller.current
    if (!pane) return
    if (atBottom.current) {
      pane.scrollTo({ top: pane.scrollHeight, behavior: 'smooth' })
      setShowNew(false)
    } else setShowNew(true)
  }, [messages.length])
  function handleScroll() {
    const pane = scroller.current
    if (!pane) return
    atBottom.current = pane.scrollHeight - pane.scrollTop - pane.clientHeight < 48
    if (atBottom.current) setShowNew(false)
  }
  function jumpToLatest() {
    atBottom.current = true
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
    setShowNew(false)
  }
  return <div className="support-chat-log-wrap">
    <div className="support-chat-thread" role="log" aria-live="polite" aria-relevant="additions text" onScroll={handleScroll} ref={scroller}>
      {groups.map((group, index) => {
        const first = group[0]
        const previous = groups[index - 1]?.[0]
        const dayChanged = !previous || dayName(previous.created_at, now) !== dayName(first.created_at, now)
        const own = first.sender_role === viewerRole
        const event = isEvent(first)
        const assistant = isAssistant(first)
        const sender = first.sender_role === 'staff' ? (viewerRole === 'customer' ? firstName(first.sender_name) : (first.sender_name || 'A support agent')) : first.sender_role === 'customer' ? firstName(first.sender_name || 'Customer') : 'Cartly Assistant'
        return <div className="support-chat-day-group" key={`${first.id}-${index}`}>
          {dayChanged && <div className="support-chat-date"><span>{dayName(first.created_at, now)}</span></div>}
          {event ? <div className="support-chat-event" aria-label={`Event: ${first.body}`}><CircleDot size={14}/><span>{first.body}</span></div> : first.is_internal ? <div className="support-chat-internal"><LockKeyhole size={15}/><span><strong>Internal note - only staff can see this</strong>{group.map(message => <p key={message.id}>{message.body}</p>)}</span><time>{timeLabel(first.created_at)}</time></div> : <div className={`support-chat-message-group ${own ? 'own' : 'other'} ${assistant ? 'assistant-group' : first.sender_role}`}>
            {assistant ? <div className="support-chat-group-label"><span className="support-assistant-avatar"><Bot size={14}/></span><strong>Cartly Assistant</strong></div> : !own && (first.sender_role === 'staff' || first.sender_role === 'customer') ? <div className="support-chat-group-label"><strong>{sender}</strong>{first.sender_role==='staff'&&<span className="support-chip">Support</span>}</div> : null}
            {group.map(message => <article key={message.id} className={`support-chat-bubble ${own ? 'own' : 'other'} ${assistant ? 'assistant' : message.sender_role}`} aria-label={`${assistant ? 'Cartly Assistant' : own ? 'You' : first.sender_role === 'staff' ? `Support, ${sender}` : 'Customer'}: ${message.body}`}>
              <p>{message.body}</p><time>{timeLabel(message.created_at)}</time>
              {message === lastOwn && message.delivery_state && <small className={`support-chat-delivery ${message.delivery_state}`}>{message.delivery_state === 'sending' ? 'Sending…' : message.delivery_state === 'failed' ? <>Not sent · <button onClick={() => onRetry?.(message)}>Retry</button></> : 'Sent'}</small>}
            </article>)}
          </div>}
        </div>
      })}
      <div className="support-chat-end" />
    </div>
    {showNew && <button type="button" className="support-chat-new-messages" onClick={jumpToLatest}>New messages ↓</button>}
  </div>
}
