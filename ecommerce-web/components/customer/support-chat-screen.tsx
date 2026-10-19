'use client'

import Link from 'next/link'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { useParams, useRouter, useSearchParams } from 'next/navigation'

import { Headset, Send, X } from 'lucide-react'

import { createSupabaseBrowserClient } from '@/lib/supabase/client'

import { SupportChatMessage, SupportChatThread } from '@/components/shared/support-chat-thread'

import { SUPPORT_CONTACT } from '@/lib/support-config'



const choices={

 undelivered:[['late_delivery','Late delivery'],['change_address_slot','Change address or slot'],['payment_problem','Payment problem'],['other','Other']],

 delivered:[['delivered_damaged','Item damaged or defective'],['wrong_item','Wrong item received'],['missing_item','Item missing'],['quality_problem','Quality problem'],['invoice_problem','Billing or invoice problem'],['other','Other']],

 cancelled:[['refund_not_received','Refund not received'],['cancelled_without_request','Cancelled without my request'],['other','Other']],

 general:[['account_login','Account or login'],['payment_coupon','Payment or coupon'],['product_question','Product question'],['other','Other']],

} as const

const stateOf=(s:string)=>s==='cancelled'?'cancelled':['delivered','returned','refunded'].includes(s)?'delivered':'undelivered'

type Ticket={ticket_id:number;order_id:number|null;subject:string;status:string;issue_type:string}

export function SupportChatScreen({ initialTicket = null, initialMessages = [], initialOrderId = null, initialOrderStatus = '', initialError = '', initialNow = '2000-01-01T00:00:00.000Z' }: { initialTicket?: Ticket | null; initialMessages?: SupportChatMessage[]; initialOrderId?: number | null; initialOrderStatus?: string; initialError?: string; initialNow?: string }){

 const params=useParams<{id?:string}>(),query=useSearchParams(),router=useRouter(),client=createSupabaseBrowserClient()

 const id=Array.isArray(params.id)?params.id[0]:params.id

 const [orderId,setOrderId]=useState<number|null>(initialOrderId),[orderStatus,setOrderStatus]=useState(initialOrderStatus),[ticket,setTicket]=useState<Ticket|null>(initialTicket),[messages,setMessages]=useState<SupportChatMessage[]>(initialMessages),[reason,setReason]=useState(''),[text,setText]=useState(''),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(initialError),[live,setLive]=useState(false),[typing,setTyping]=useState(false),[otherPrompt,setOtherPrompt]=useState(false)

 const mode=id==='new'||!id?'new':'existing'

 const options=choices[orderId===null?'general':stateOf(orderStatus)]

 const refresh=useCallback(async()=>{if(!client)return; if(mode==='existing'&&id&&/^\d+$/.test(id)){const {data,error:e}=await client.rpc('customer_list_support_tickets');if(e){setError(e.message);return}const t=((data??[]) as Ticket[]).find(row=>row.ticket_id===Number(id));if(!t){setError('This support chat could not be found.');setLoading(false);return}setTicket(t);setOrderId(t.order_id);const {data:m,error:me}=await client.rpc('customer_support_chat_messages',{p_ticket_id:Number(id)});if(me)setError(me.message);else setMessages((m??[]) as SupportChatMessage[]);await client.rpc('customer_mark_support_ticket_read',{p_ticket_id:Number(id)})}else{const oid=query.get('order');if(oid&&/^\d+$/.test(oid)){const {data,error:e}=await client.from('orders').select('id,status').eq('id',Number(oid)).maybeSingle();if(e||!data){setError('We could not find that order.');}else{setOrderId(Number(data.id));setOrderStatus(data.status)}}else{setOrderId(null);setOrderStatus('')}}setLoading(false)},[client,id,mode,query])

 useEffect(()=>{if(initialTicket&&client)void client.rpc('customer_mark_support_ticket_read',{p_ticket_id:initialTicket.ticket_id})},[client,initialTicket?.ticket_id])

 useEffect(()=>{if(!client)return;let active=true;const topic=`support-chat-${id||'new'}-${crypto.randomUUID()}`;const channel=client.channel(topic).on('postgres_changes',{event:'*',schema:'public',table:'support_ticket_events'},payload=>{if(id&&String((payload.new as any)?.ticket_id)===id)void refresh()}).on('postgres_changes',{event:'*',schema:'public',table:'support_tickets'},payload=>{if(id&&String((payload.new as any)?.id)===id)void refresh()});channel.subscribe(status=>{if(active)setLive(status==='SUBSCRIBED')});const timer=window.setInterval(()=>void refresh(),30000);const focus=()=>void refresh();window.addEventListener('focus',focus);return()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',focus);void client.removeChannel(channel)}},[client,id,refresh])

 const greeting=useMemo<SupportChatMessage[]>(()=>{if(mode!=='new'||messages.length)return[];return[{id:'greeting',sender_role:'system',message_kind:'assistant',sender_name:'Cartly Assistant',body:'Hi there, sorry you’re having trouble. What is this about?',created_at:initialNow}]},[mode,messages.length,initialNow])

 async function choose(value:string){if(!client||busy)return;setReason(value);setTyping(true);setBusy(true);window.setTimeout(async()=>{setTyping(false);if(value==='other'){setOtherPrompt(true);setBusy(false);return}const {data,error:e}=await client.rpc('customer_start_support_chat',{p_order_id:orderId,p_issue_type:value});if(e){setError(e.message);setBusy(false);return}const n=Number(data);if(n<0){router.replace(`/customer/support/chat/${Math.abs(n)}?duplicate=1`);setBusy(false);return}router.replace(`/customer/support/chat/${n}`);setBusy(false);await refresh()},400)}

 async function send(){if(!client||!text.trim()||busy)return;setBusy(true);setError('');let activeTicket=ticket;if(!activeTicket&&reason==='other'){const {data,error:e}=await client.rpc('customer_start_support_chat',{p_order_id:orderId,p_issue_type:'other'});if(e){setError(e.message);setBusy(false);return}const n=Number(data);if(n<0){router.replace(`/customer/support/chat/${Math.abs(n)}`);setBusy(false);return}const {data:rows}=await client.rpc('customer_list_support_tickets');activeTicket=((rows??[]) as Ticket[]).find(row=>row.ticket_id===n)??null;setTicket(activeTicket);router.replace(`/customer/support/chat/${n}`)}const tid=activeTicket?.ticket_id??Number(id);const {error:e}=await client.rpc('customer_send_support_chat_message',{p_ticket_id:tid,p_body:text.trim()});if(e)setError(e.message);else{setText('');setOtherPrompt(false);await refresh()}setBusy(false)}

 if(loading)return <main className="support-chat-page support-chat-loading"><p>Loading support chat-</p></main>

 return <main className="support-chat-page">

  <header className="support-chat-header">


   <span className="support-chat-headset"><Headset size={20}/></span>

   <div className="support-chat-heading"><strong>Cartly Support</strong><small>{ticket?`${ticket.subject}${orderId?` - Order #${orderId}`:''}`:orderId?`Order #${orderId}`:'General question'}</small></div>

   <span className={`support-chat-status ${ticket?.status==='resolved'?'resolved':ticket?.status==='in_progress'?'joined':'waiting'}`}>{ticket?.status==='resolved'?'Resolved':ticket?.status==='in_progress'?'Support joined':'Waiting for support'}</span>

   <button className="support-chat-close" type="button" aria-label="Close support chat" title="Back to support" onClick={()=>router.push('/customer/support')}><X size={18}/></button>

  </header>

  {error&&<p className="support-chat-error" role="alert">{error}</p>}

  <div className={`support-chat-live ${live?'connected':''}`}><i/>{live?'Live':'Connecting to support...'}</div>

  <section className="support-chat-content">

   <SupportChatThread viewerRole="customer" initialNow={initialNow} messages={[...(query.get('duplicate')?[{id:'duplicate',sender_role:'system' as const,message_kind:'event' as const,body:'You already have an open complaint for this order.',created_at:initialNow}]:[]),...greeting,...messages]}/>

   {typing&&<p className="support-chat-typing">Cartly Assistant is typing...</p>}

   {mode==='new'&&!reason&&<div className="support-chat-choices">{options.map(([value,label])=><button key={value} type="button" disabled={busy} onClick={()=>void choose(value)}>{label}</button>)}</div>}

   {otherPrompt&&mode==='new'&&<p className="support-chat-assistant-prompt">Please tell us what happened.</p>}

   {mode==='existing'&&ticket?.status==='resolved'?<button className="primary-button support-chat-reopen" onClick={async()=>{const {error:e}=await client?.rpc('customer_reopen_support_ticket',{p_ticket_id:ticket.ticket_id})??{};if(e)setError(e.message);else void refresh()}}>Reopen complaint</button>:<footer className="support-chat-composer">

    {ticket?.status==='open'&&<small className="support-chat-waiting">Waiting for support. We'll notify you when someone joins.</small>}

    <div className="support-chat-compose-box"><textarea value={text} maxLength={1000} disabled={mode==='new'&&!reason||Boolean(ticket&&ticket.status==='resolved')} placeholder={mode==='new'&&!reason?'Choose an option above':otherPrompt?'Please tell us what happened':'Write a message...'} onChange={e=>{setText(e.target.value);e.currentTarget.style.height='auto';e.currentTarget.style.height=`${Math.min(e.currentTarget.scrollHeight,120)}px`}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send()}}}/></div>

    <button className={text.trim()&&!busy?'ready':''} aria-label="Send message" disabled={!text.trim()||busy} onClick={()=>void send()}><Send size={18}/></button>

   </footer>}

   <p className="support-chat-contact">Need help urgently? <a href={`tel:${SUPPORT_CONTACT.phone.replaceAll(' ','')}`}>Call {SUPPORT_CONTACT.phone}</a><span>{SUPPORT_CONTACT.hours}</span></p>

  </section>

 </main>

}

