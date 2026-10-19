'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Bell, Check, CheckCheck, ClipboardCheck, MailOpen, Megaphone, Search, Send, ShieldAlert, TriangleAlert, UserRound, X } from 'lucide-react'
import { AdminShell } from './admin-shell'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

type StaffMessage = { message_id:number; recipient_row_id:number; sender_id:string; sender_name:string; message_type:'alert'|'issue'|'announcement'; title:string; body:string; created_at:string; read_at:string|null; acknowledged_at:string|null; done_at:string|null; done_note:string|null }
type SentMessage = { message_id:number; message_type:'alert'|'issue'|'announcement'; title:string; body:string; created_at:string; recipient_count:number; read_count:number; done_count:number; acknowledged_count:number; audience_mode:string|null; audience_roles:string[]|null; audience_label:string|null }
type Target = { user_id:string; full_name:string; role_name:string }
type Recipient = { recipient_id:string; full_name:string; role_name:string; read_at:string|null; done_at:string|null; acknowledged_at:string|null; done_note:string|null }
type RpcFailure = { message?:string; code?:string; hint?:string; details?:string }
type Filter = 'all'|'unread'|'alerts'|'todo'|'done'|'waiting'|'complete'
type AudienceMode = 'everyone'|'roles'|'people'
type NewMessageInput = { type:string; title:string; body:string; audienceMode:AudienceMode; audienceRoles:string[]; recipientIds:string[] }

const STAFF_ROLES=[{key:'store_manager',label:'Store managers',singular:'Store manager'},{key:'customer_support',label:'Customer support',singular:'Customer support'},{key:'picker',label:'Pickers',singular:'Picker'}] as const
const MESSAGE_TYPES=[{key:'announcement',label:'Announcement',description:'General update for the team',Icon:Megaphone,color:'blue'},{key:'alert',label:'Alert',description:'Needs attention soon',Icon:TriangleAlert,color:'red'},{key:'issue',label:'Issue',description:'Something staff need to act on',Icon:ClipboardCheck,color:'amber'}] as const

const dateTime = (value:string) => new Date(value).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})
const friendly = {
  inbox: "We couldn't load your messages. Please try again.",
  sent: "We couldn't load your sent messages. Please try again.",
  recipients: "We couldn't load recipient details. Please try again.",
  targets: "We couldn't load staff recipients. Please try again.",
  send: "We couldn't send this message. Please try again.",
  update: "We couldn't update this message. Please try again.",
  reminder: "We couldn't send reminders. Please try again.",
}

function logRpcError(area:string,error:unknown){
  const value=(error??{}) as RpcFailure
  console.error(`[Messages] ${area} failed`,{message:value.message??String(error),code:value.code,hint:value.hint,details:value.details})
}

export function AdminStaffMessages(){
  const client=useMemo(()=>createSupabaseBrowserClient(),[])
  const [role,setRole]=useState('')
  const [inbox,setInbox]=useState<StaffMessage[]>([])
  const [sent,setSent]=useState<SentMessage[]>([])
  const [targets,setTargets]=useState<Target[]>([])
  const [recipients,setRecipients]=useState<Recipient[]>([])
  const [selected,setSelected]=useState<StaffMessage|null>(null)
  const [sentSelected,setSentSelected]=useState<SentMessage|null>(null)
  const [mode,setMode]=useState<'inbox'|'sent'>('sent')
  const [inboxFilter,setInboxFilter]=useState<Filter>('all')
  const [sentFilter,setSentFilter]=useState<Filter>('all')
  const [inboxLoading,setInboxLoading]=useState(true)
  const [sentLoading,setSentLoading]=useState(true)
  const [inboxError,setInboxError]=useState('')
  const [sentError,setSentError]=useState('')
  const [detailError,setDetailError]=useState('')
  const [composeError,setComposeError]=useState('')
  const [composeErrorKind,setComposeErrorKind]=useState<'targets'|'send'|''>('')
  const [targetsLoading,setTargetsLoading]=useState(false)
  const [noteOpen,setNoteOpen]=useState(false)
  const [note,setNote]=useState('')
  const [toast,setToast]=useState('')
  const [undoRow,setUndoRow]=useState<number|null>(null)
  const [compose,setCompose]=useState(false)
  const [busy,setBusy]=useState(false)

  const loadInbox=useCallback(async()=>{
    setInboxLoading(true);setInboxError('')
    if(!client){setInboxError(friendly.inbox);setInboxLoading(false);return}
    try{
      const {data,error}=await client.rpc('staff_list_admin_messages')
      if(error){logRpcError('staff_list_admin_messages',error);setInboxError(friendly.inbox)}
      else{const rows=(data??[]) as StaffMessage[];setInbox(rows);setSelected(current=>current?rows.find(row=>row.recipient_row_id===current.recipient_row_id)??null:rows[0]??null)}
    }catch(error){logRpcError('staff_list_admin_messages',error);setInboxError(friendly.inbox)}
    finally{setInboxLoading(false)}
  },[client])

  const loadSent=useCallback(async()=>{
    if(!client)return
    setSentLoading(true);setSentError('')
    try{
      const {data,error}=await client.rpc('admin_list_sent_staff_messages')
      if(error){logRpcError('admin_list_sent_staff_messages',error);setSentError(friendly.sent)}
      else{const rows=(data??[]) as SentMessage[];setSent(rows);setSentSelected(current=>current?rows.find(row=>row.message_id===current.message_id)??null:rows[0]??null)}
    }catch(error){logRpcError('admin_list_sent_staff_messages',error);setSentError(friendly.sent)}
    finally{setSentLoading(false)}
  },[client])

  const loadTargets=useCallback(async()=>{
    if(!client){setTargets([]);setComposeError(friendly.targets);setComposeErrorKind('targets');return}
    setTargetsLoading(true);setComposeError('');setComposeErrorKind('')
    try{const {data,error}=await client.rpc('admin_list_staff_message_targets');if(error){logRpcError('admin_list_staff_message_targets',error);setTargets([]);setComposeError(friendly.targets);setComposeErrorKind('targets')}else setTargets((data??[]) as Target[])}
    catch(error){logRpcError('admin_list_staff_message_targets',error);setTargets([]);setComposeError(friendly.targets);setComposeErrorKind('targets')}
    finally{setTargetsLoading(false)}
  },[client])

  const loadRecipients=useCallback(async(id:number)=>{
    if(!client)return
    setDetailError('')
    try{const {data,error}=await client.rpc('admin_staff_message_recipients',{p_message_id:id});if(error){logRpcError('admin_staff_message_recipients',error);setDetailError(friendly.recipients)}else setRecipients((data??[]) as Recipient[])}
    catch(error){logRpcError('admin_staff_message_recipients',error);setDetailError(friendly.recipients)}
  },[client])

  useEffect(()=>{
    if(!client){setInboxLoading(false);setSentLoading(false);return}
    let active=true
    void (async()=>{
      try{
        const {data,error}=await client.rpc('get_my_admin_profile')
        if(!active)return
        if(error)logRpcError('get_my_admin_profile',error)
        const currentRole=String(data?.[0]?.role_name??'');setRole(currentRole)
        if(currentRole==='super_admin'){setMode('sent');await Promise.all([loadInbox(),loadSent()])}
        else{setMode('inbox');setSentLoading(false);await loadInbox()}
      }catch(error){if(active){logRpcError('get_my_admin_profile',error);setMode('inbox');setSentLoading(false);void loadInbox()}}
    })()
    return()=>{active=false}
  },[client,loadInbox,loadSent])

  useEffect(()=>{
    if(!client)return
    const channel=client.channel('admin-staff-messages-live').on('postgres_changes',{event:'*',schema:'public',table:'admin_message_recipients'},()=>{
      void loadInbox()
      if(role==='super_admin'){void loadSent();if(sentSelected)void loadRecipients(sentSelected.message_id)}
    }).subscribe()
    return()=>{void channel.unsubscribe()}
  },[client,loadInbox,loadRecipients,loadSent,role,sentSelected])

  async function updateRecipient(rowId:number,action:'read'|'acknowledge'|'done'|'undo',messageNote:string|null=null){
    if(!client)return false
    try{const {error}=await client.rpc('staff_update_admin_message',{p_recipient_row_id:rowId,p_action:action,p_done_note:messageNote});if(error){logRpcError(`staff_update_admin_message:${action}`,error);setInboxError(friendly.update);return false}return true}
    catch(error){logRpcError(`staff_update_admin_message:${action}`,error);setInboxError(friendly.update);return false}
  }
  async function chooseInbox(row:StaffMessage){setSelected(row);setNoteOpen(false);if(!row.read_at){const ok=await updateRecipient(row.recipient_row_id,'read');if(ok)await loadInbox()}}
  async function markDone(){if(!selected)return;setBusy(true);const ok=await updateRecipient(selected.recipient_row_id,'done',note);setBusy(false);if(!ok)return;setNoteOpen(false);setNote('');setToast('Marked as done');setUndoRow(selected.recipient_row_id);window.setTimeout(()=>{setToast('');setUndoRow(null)},10000);await loadInbox()}
  async function undo(){if(undoRow===null)return;const ok=await updateRecipient(undoRow,'undo');setToast(ok?'Completion undone':'We could not undo this completion.');setUndoRow(null);window.setTimeout(()=>setToast(''),2500);await loadInbox()}
  async function acknowledge(){if(!selected)return;const ok=await updateRecipient(selected.recipient_row_id,'acknowledge');if(ok)await loadInbox()}
  async function sendMessage(input:NewMessageInput){
    if(!client||busy)return false
    setBusy(true);setComposeError('');setComposeErrorKind('')
    try{
      const {data,error}=await client.rpc('admin_send_staff_message',{p_type:input.type,p_title:input.title,p_body:input.body,p_recipient_ids:input.audienceMode==='people'?input.recipientIds:[],p_audience_mode:input.audienceMode,p_audience_roles:input.audienceMode==='roles'?input.audienceRoles:null})
      if(error){logRpcError('admin_send_staff_message',error);setComposeError(friendly.send);setComposeErrorKind('send');return false}
      const sentCount=Number((data as {recipient_count?:number}|null)?.recipient_count??0)
      setCompose(false);setToast(`Sent to ${sentCount} ${sentCount===1?'person':'people'}`);window.setTimeout(()=>setToast(''),3000);await loadSent();return true
    }catch(error){logRpcError('admin_send_staff_message',error);setComposeError(friendly.send);setComposeErrorKind('send');return false}finally{setBusy(false)}
  }
  async function remind(message:SentMessage){if(!client)return;setBusy(true);setSentError('');try{const {data,error}=await client.rpc('admin_remind_staff_message',{p_message_id:message.message_id});if(error){logRpcError('admin_remind_staff_message',error);setSentError(friendly.reminder)}else{setToast(`Reminder sent to ${data} staff member${data===1?'':'s'}`);window.setTimeout(()=>setToast(''),3000)}}catch(error){logRpcError('admin_remind_staff_message',error);setSentError(friendly.reminder)}finally{setBusy(false)}}

  const admin=role==='super_admin'
  const unread=inbox.filter(item=>!item.read_at).length
  const todos=inbox.filter(item=>item.message_type!=='announcement'&&!item.done_at).length
  const inboxCounts:Record<'all'|'unread'|'alerts'|'todo'|'done',number>={all:inbox.length,unread,alerts:inbox.filter(item=>item.message_type==='alert').length,todo:todos,done:inbox.filter(item=>Boolean(item.done_at)).length}
  const inboxFilters:Array<{key:'all'|'unread'|'alerts'|'todo'|'done';label:string}>=[{key:'all',label:'All'},{key:'unread',label:'Unread'},{key:'alerts',label:'Alerts'},{key:'todo',label:'To do'},{key:'done',label:'Done'}]
  const visibleInbox=inbox.filter(item=>inboxFilter==='unread'?!item.read_at:inboxFilter==='alerts'?item.message_type==='alert':inboxFilter==='todo'?item.message_type!=='announcement'&&!item.done_at:inboxFilter==='done'?Boolean(item.done_at):true)
  const waitingCount=sent.filter(item=>item.message_type==='announcement'?item.acknowledged_count<item.recipient_count:item.done_count<item.recipient_count).length
  const completeCount=sent.filter(item=>item.recipient_count>0&&(item.message_type==='announcement'?item.acknowledged_count===item.recipient_count:item.done_count===item.recipient_count)).length
  const visibleSent=sent.filter(item=>sentFilter==='waiting'?(item.message_type==='announcement'?item.acknowledged_count<item.recipient_count:item.done_count<item.recipient_count):sentFilter==='complete'?item.recipient_count>0&&(item.message_type==='announcement'?item.acknowledged_count===item.recipient_count:item.done_count===item.recipient_count):true)
  const openComposer=()=>{setCompose(true);setComposeError('');setComposeErrorKind('');void loadTargets()}

  return <AdminShell eyebrow="OPERATIONS" title="Messages" description={admin?'Send updates and track staff acknowledgements.':'Updates and requests from your admin.'} action={admin?<button type="button" className="primary-button staff-message-new" onClick={openComposer}><Send size={17}/>New message</button>:<span className="staff-message-todo-count">{todos} to do</span>}>
    <section className="staff-messages-panel">
      {admin?<div className="staff-message-tabs" role="tablist" aria-label="Message folders">
        <button type="button" role="tab" aria-selected={mode==='sent'} className={mode==='sent'?'active':''} onClick={()=>setMode('sent')}>Sent<span className="staff-message-tab-count">{sent.length}</span></button>
        {inbox.length>0&&<button type="button" role="tab" aria-selected={mode==='inbox'} className={mode==='inbox'?'active':''} onClick={()=>setMode('inbox')}>Inbox<span className="staff-message-tab-count">{inbox.length}</span></button>}
      </div>:<div className="staff-message-inbox-heading"><h2>Inbox</h2>{unread>0&&<span className="staff-message-tab-count">{unread} unread</span>}</div>}

      {mode==='inbox'?<>
        <div className="staff-message-filters" role="group" aria-label="Filter inbox">
          {inboxFilters.map(({key,label})=><button type="button" key={key} className={inboxFilter===key?'active':''} onClick={()=>setInboxFilter(key)}>{label}<span className="staff-message-filter-count">{inboxCounts[key]}</span></button>)}
        </div>
        <div className="staff-message-layout">
          <div className="staff-message-list" aria-label="Inbox messages">
            {inboxLoading?<div className="staff-message-skeleton-list">{Array.from({length:5},(_,i)=><i key={i}/>)}</div>:inboxError?<InlineError message={inboxError} onRetry={()=>void loadInbox()}/>:visibleInbox.length===0?inbox.length===0?<EmptyList admin={false}/>:<EmptyFilter onClear={()=>setInboxFilter('all')}/>:visibleInbox.map(row=><button type="button" key={row.recipient_row_id} className={`staff-message-row ${row.done_at?'done':''} ${selected?.recipient_row_id===row.recipient_row_id?'selected':''}`} onClick={()=>void chooseInbox(row)}><span className="staff-message-row-copy"><strong>{row.title}</strong><small>{row.message_type} · {dateTime(row.created_at)}</small></span>{row.done_at&&<span className="staff-message-done-chip"><Check size={12}/>Done</span>}</button>)}
          </div>
          <article className="staff-message-detail" aria-label="Message details">
            {inboxLoading?<DetailSkeleton/>:selected?<><div className="staff-message-detail-top"><span className={`staff-message-type ${selected.message_type}`}>{selected.message_type}</span><time>{dateTime(selected.created_at)}</time></div><h2>{selected.title}</h2><p className="staff-message-sender">From {selected.sender_name}</p><p className="staff-message-body">{selected.body}</p>
              {selected.message_type!=='announcement'&&!selected.done_at&&!selected.acknowledged_at&&<div className="staff-message-urgent"><ShieldAlert size={17}/><span>Urgent message · Please review and mark as done when handled.</span></div>}
              {inboxError&&<InlineError message={inboxError} onRetry={()=>void loadInbox()}/>}
              {selected.message_type==='announcement'?selected.acknowledged_at?<p className="staff-message-confirmed"><CheckCheck size={15}/>Acknowledged on {dateTime(selected.acknowledged_at)}</p>:<button type="button" className="primary-button staff-message-action" onClick={()=>void acknowledge()}><Check size={17}/>Got it</button>:selected.done_at?<div className="staff-message-done-state"><p><CheckCheck size={15}/>Done on {dateTime(selected.done_at)}</p>{selected.done_note&&<small>{selected.done_note}</small>}</div>:noteOpen?<div className="staff-message-note-panel"><label>Add a note for your admin (optional)<input maxLength={200} value={note} onChange={event=>setNote(event.target.value)}/><small>{note.length}/200</small></label><div><button type="button" className="secondary-button" disabled={busy} onClick={()=>{setNoteOpen(false);setNote('')}}>Cancel</button><button type="button" className="primary-button" disabled={busy} onClick={()=>void markDone()}>{busy?'Saving…':'Confirm'}</button></div></div>:<button type="button" className="primary-button staff-message-action" onClick={()=>setNoteOpen(true)}><Check size={17}/>Mark as done</button>}
            </>:<EmptyDetail/>}
          </article>
        </div>
      </>:<>
        <div className="staff-message-filters" role="group" aria-label="Filter sent messages">
          {[{key:'all' as const,label:'All',count:sent.length},{key:'waiting' as const,label:'Waiting on staff',count:waitingCount},{key:'complete' as const,label:'Complete',count:completeCount}].map(({key,label,count})=><button type="button" key={key} className={sentFilter===key?'active':''} onClick={()=>setSentFilter(key)}>{label}<span className="staff-message-filter-count">{count}</span></button>)}
        </div>
        <div className="staff-message-layout sent-layout">
          <div className="staff-message-list" aria-label="Sent messages">
            {sentLoading?<div className="staff-message-skeleton-list">{Array.from({length:5},(_,i)=><i key={i}/>)}</div>:sentError?<InlineError message={sentError} onRetry={()=>void loadSent()}/>:visibleSent.length===0?sent.length===0?<EmptyList admin onCreate={openComposer}/>:<EmptyFilter onClear={()=>setSentFilter('all')}/>:visibleSent.map(row=><button type="button" className={`staff-message-row ${sentSelected?.message_id===row.message_id?'selected':''}`} key={row.message_id} onClick={()=>{setSentSelected(row);setRecipients([]);void loadRecipients(row.message_id)}}><span className="staff-message-row-copy"><strong>{row.title}</strong><small>{row.message_type} · {row.read_count} of {row.recipient_count} read - {row.message_type==='announcement'?`${row.acknowledged_count} of ${row.recipient_count} acknowledged`:`${row.done_count} of ${row.recipient_count} done`}</small><small className="staff-message-audience">To: {row.audience_label||`${row.recipient_count} ${row.recipient_count===1?'person':'people'}`}</small></span><span className={`staff-message-type ${row.message_type}`}>{row.message_type}</span></button>)}
          </div>
          <article className="staff-message-detail" aria-label="Sent message details">
            {sentLoading?<DetailSkeleton/>:sentError?<EmptyDetail/>:sentSelected?<><h2>{sentSelected.title}</h2><p className="staff-message-body">{sentSelected.body}</p><div className="staff-message-sent-summary">{sentSelected.read_count} of {sentSelected.recipient_count} read - {sentSelected.message_type==='announcement'?`${sentSelected.acknowledged_count} of ${sentSelected.recipient_count} acknowledged`:`${sentSelected.done_count} of ${sentSelected.recipient_count} done`}</div>
              {detailError?<InlineError message={detailError} onRetry={()=>void loadRecipients(sentSelected.message_id)}/>:<div className="staff-message-recipient-table"><div><b>Name</b><b>Role</b><b>Read</b><b>{sentSelected.message_type==='announcement'?'Acknowledged':'Done'}</b></div>{recipients.map((row,index)=><div key={row.recipient_id||index}><span>{row.full_name}{row.done_note&&<small>{row.done_note}</small>}</span><span>{row.role_name}</span><span>{row.read_at?dateTime(row.read_at):'Not yet'}</span><span>{(sentSelected.message_type==='announcement'?row.acknowledged_at:row.done_at)?dateTime((sentSelected.message_type==='announcement'?row.acknowledged_at:row.done_at)!):'Not yet'}</span></div>)}</div>}
              {sentSelected.message_type!=='announcement'&&<button type="button" className="secondary-button" disabled={busy} onClick={()=>void remind(sentSelected)}>Remind those not done</button>}{sentError&&<InlineError message={sentError} onRetry={()=>void loadSent()}/>}
            </>:<EmptyDetail/>}
          </article>
        </div>
      </>}
    </section>

    {toast&&<div className="staff-message-toast" role="status">{toast}{undoRow!==null&&<button type="button" onClick={()=>void undo()}>Undo</button>}</div>}
    {compose&&<NewMessageDrawer targets={targets} targetsLoading={targetsLoading} error={composeError} errorKind={composeErrorKind} busy={busy} onRetry={()=>composeErrorKind==='targets'?void loadTargets():undefined} onClose={()=>setCompose(false)} onSend={sendMessage}/ >}
  </AdminShell>
}

function NewMessageDrawer({targets,targetsLoading,error,errorKind,busy,onRetry,onClose,onSend}:{targets:Target[];targetsLoading:boolean;error:string;errorKind:'targets'|'send'|'';busy:boolean;onRetry:()=>void;onClose:()=>void;onSend:(input:NewMessageInput)=>Promise<boolean>}){
  const [type,setType]=useState<'alert'|'issue'|'announcement'>('alert')
  const [title,setTitle]=useState('')
  const [body,setBody]=useState('')
  const [mode,setMode]=useState<AudienceMode>('people')
  const [roles,setRoles]=useState<string[]>([])
  const [people,setPeople]=useState<string[]>([])
  const [search,setSearch]=useState('')
  const [roleFilter,setRoleFilter]=useState('all')
  const [showAllSelected,setShowAllSelected]=useState(false)
  const [errors,setErrors]=useState<{title?:string;body?:string;recipients?:string}>({})
  const titleRef=useRef<HTMLInputElement>(null)
  const bodyRef=useRef<HTMLTextAreaElement>(null)
  const recipientRef=useRef<HTMLDivElement>(null)
  const roleCounts=Object.fromEntries(STAFF_ROLES.map(role=>[role.key,targets.filter(person=>person.role_name===role.key).length])) as Record<string,number>
  const resolved=mode==='everyone'?targets:mode==='roles'?targets.filter(person=>roles.includes(person.role_name)):targets.filter(person=>people.includes(person.user_id))
  const filtered=targets.filter(person=>(roleFilter==='all'||person.role_name===roleFilter)&&`${person.full_name} ${person.role_name.replaceAll('_',' ')}`.toLowerCase().includes(search.trim().toLowerCase()))
  const rolesWithMembers=Array.from(new Set(targets.map(person=>person.role_name))).map(key=>STAFF_ROLES.find(role=>role.key===key)?.label??key.replaceAll('_',' '))
  function close(){if(busy)return;if((title.trim()||body.trim()||people.length||roles.length)&&!window.confirm('Discard this message?'))return;onClose()}
  useEffect(()=>{const handleKey=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();close()}};window.addEventListener('keydown',handleKey);return()=>window.removeEventListener('keydown',handleKey)})
  function setModeAndClearRoles(next:AudienceMode){if(mode==='roles'&&next!=='roles')setRoles([]);setMode(next);setErrors(current=>({...current,recipients:undefined}))}
  function validateTitle(){const valid=Boolean(title.trim());setErrors(current=>({...current,title:valid?undefined:'Add a title'}));return valid}
  function validateBody(){const valid=Boolean(body.trim());setErrors(current=>({...current,body:valid?undefined:'Add a message'}));return valid}
  async function submit(){const titleOk=validateTitle(),bodyOk=validateBody(),recipientsOk=resolved.length>0;setErrors(current=>({...current,recipients:recipientsOk?undefined:'Choose who to send this to'}));if(!titleOk){titleRef.current?.focus();return}if(!bodyOk){bodyRef.current?.focus();return}if(!recipientsOk){recipientRef.current?.focus();return}await onSend({type,title:title.trim(),body:body.trim(),audienceMode:mode,audienceRoles:roles,recipientIds:people})}
  const radioKey=<T extends string>(event:React.KeyboardEvent<HTMLButtonElement>,items:readonly T[],current:T,set:(value:T)=>void)=>{if(!['ArrowRight','ArrowLeft','ArrowDown','ArrowUp'].includes(event.key))return;event.preventDefault();const index=items.indexOf(current);const forward=event.key==='ArrowRight'||event.key==='ArrowDown';const nextIndex=(index+(forward?1:-1)+items.length)%items.length;set(items[nextIndex]);event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus()}
  return <div className="staff-message-modal-backdrop" onMouseDown={event=>{if(event.currentTarget===event.target)close()}}><section className="staff-message-compose" role="dialog" aria-modal="true" aria-labelledby="staff-message-compose-title" aria-describedby="staff-message-compose-subtitle">
    <header className="staff-compose-header"><div><h2 id="staff-message-compose-title">New message</h2><p id="staff-message-compose-subtitle">Send an announcement, alert or issue to your team</p></div><button type="button" onClick={close} aria-label="Close"><X size={18}/></button></header>
    <div className="staff-compose-body">
      <section className="staff-compose-field"><div className="staff-compose-label">Type</div><div className="staff-compose-type-cards" role="radiogroup" aria-label="Message type">{MESSAGE_TYPES.map(({key,label,description,Icon,color})=><button type="button" role="radio" aria-checked={type===key} tabIndex={type===key?0:-1} key={key} className={`staff-compose-type-card ${color} ${type===key?'selected':''}`} onClick={()=>setType(key)} onKeyDown={event=>radioKey(event,MESSAGE_TYPES.map(item=>item.key),type,setType)}><Icon size={17}/><span><strong>{label}</strong><small>{description}</small></span>{type===key&&<Check size={15} className="staff-compose-selected-check"/>}</button>)}</div></section>
      <label className="staff-compose-field"><span className="staff-compose-label">Title</span><input ref={titleRef} maxLength={80} value={title} placeholder="e.g. Order #11 is running late" aria-invalid={Boolean(errors.title)} onChange={event=>{setTitle(event.target.value);if(event.target.value.trim())setErrors(current=>({...current,title:undefined}))}} onBlur={()=>void validateTitle()}/><small className="staff-compose-counter">{title.length}/80</small>{errors.title&&<small className="staff-compose-error">{errors.title}</small>}</label>
      <label className="staff-compose-field"><span className="staff-compose-label">Message</span><textarea ref={bodyRef} rows={5} maxLength={500} value={body} placeholder="Tell your team what happened and what you need them to do" aria-invalid={Boolean(errors.body)} onChange={event=>{setBody(event.target.value);if(event.target.value.trim())setErrors(current=>({...current,body:undefined}))}} onBlur={()=>void validateBody()}/><small className="staff-compose-counter">{body.length}/500</small>{errors.body&&<small className="staff-compose-error">{errors.body}</small>}</label>
      <section className="staff-compose-field staff-compose-send-to" ref={recipientRef} tabIndex={-1} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null)&&!resolved.length)setErrors(current=>({...current,recipients:'Choose who to send this to'}))}}><div className="staff-compose-label">Send to</div>
        <div className="staff-compose-audience-cards" role="radiogroup" aria-label="Choose recipients">{([{key:'everyone',label:'Everyone',sub:'All staff',count:targets.length},{key:'roles',label:'By role',sub:'Specific roles',count:null},{key:'people',label:'Individual staff',sub:'Pick people',count:null}] as const).map(({key,label,sub,count})=><button type="button" role="radio" aria-checked={mode===key} tabIndex={mode===key?0:-1} className={`staff-compose-audience-card ${mode===key?'selected':''}`} key={key} onClick={()=>setModeAndClearRoles(key)} onKeyDown={event=>radioKey(event,['everyone','roles','people'],mode,setModeAndClearRoles)}><strong>{label}</strong><span>{count===null?sub:`${count} ${count===1?'person':'people'}`}</span>{mode===key&&<Check size={14}/>}</button>)}</div>
        <div className="staff-compose-audience-content" key={mode}>{targetsLoading?<div className="staff-compose-staff-skeleton" aria-label="Loading staff"><i/><i/><i/></div>:errorKind==='targets'?<InlineError message={friendly.targets} onRetry={onRetry}/>:<>
          {mode==='everyone'&&<p className="staff-compose-helper">{rolesWithMembers.length?`${rolesWithMembers.join(', ')}.`:'No staff roles currently have active members.'}</p>}
          {mode==='roles'&&<div className="staff-compose-role-picker"><div className="staff-compose-role-chips">{STAFF_ROLES.map(role=>{const count=roleCounts[role.key]??0;const selected=roles.includes(role.key);return <button type="button" key={role.key} aria-pressed={selected} disabled={!count} title={!count?'No staff in this role':undefined} className={`staff-compose-role-chip ${selected?'selected':''}`} onClick={()=>setRoles(current=>selected?current.filter(key=>key!==role.key):[...current,role.key])}>{selected&&<Check size={13}/>} {role.label} <span>{count}</span></button>})}</div><button type="button" className="staff-compose-text-link" onClick={()=>setRoles(STAFF_ROLES.filter(role=>(roleCounts[role.key]??0)>0).map(role=>role.key))}>Select all roles</button>{resolved.length>0&&<div className="staff-compose-resolved">{resolved.slice(0,1).map(person=><span key={person.user_id}>{person.full_name} · {STAFF_ROLES.find(role=>role.key===person.role_name)?.singular??person.role_name}</span>)}{resolved.length>1&&<span>+{resolved.length-1} more</span>}</div>}</div>}
          {mode==='people'&&<div className="staff-compose-people-picker">{people.length>0&&<div className="staff-compose-selected-people">{(people.length>6&&!showAllSelected?people.slice(0,6):people).map(id=>{const person=targets.find(item=>item.user_id===id);return person&&<button type="button" className="staff-compose-person-chip" key={id} onClick={()=>setPeople(current=>current.filter(value=>value!==id))}>{person.full_name}<X size={12}/></button>})}{people.length>6&&<button type="button" className="staff-compose-text-link" onClick={()=>setShowAllSelected(value=>!value)}>{showAllSelected?'Show less':`+${people.length-6} more`}</button>}</div>}
            <div className="staff-compose-search-row"><label className="staff-compose-search"><Search size={15}/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search by name or role" aria-label="Search staff by name or role"/></label><select aria-label="Filter staff by role" value={roleFilter} onChange={event=>setRoleFilter(event.target.value)}><option value="all">All roles</option>{STAFF_ROLES.map(role=><option key={role.key} value={role.key}>{role.label}</option>)}</select></div>
            <div className="staff-compose-list-actions"><span>{filtered.length} staff shown</span><div><button type="button" className="staff-compose-text-link" onClick={()=>setPeople(current=>Array.from(new Set([...current,...filtered.map(person=>person.user_id)])))}>Select all shown</button><button type="button" className="staff-compose-text-link" onClick={()=>setPeople([])}>Clear</button></div></div>
            <div className="staff-compose-staff-list" role="group" aria-label="Staff recipients">{filtered.length===0?<p className="staff-compose-no-results">No staff match your search</p>:filtered.map(person=>{const checked=people.includes(person.user_id);const initials=person.full_name.split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();return <label key={person.user_id} className={`staff-compose-staff-row ${checked?'selected':''}`}><span className="staff-compose-avatar">{initials||<UserRound size={15}/>}</span><span className="staff-compose-person-info"><strong>{person.full_name}</strong><small>{STAFF_ROLES.find(role=>role.key===person.role_name)?.singular??person.role_name.replaceAll('_',' ')}</small></span><input type="checkbox" checked={checked} onChange={event=>setPeople(current=>event.target.checked?[...current,person.user_id]:current.filter(id=>id!==person.user_id))}/></label>})}</div>
          </div>}
          <p className="staff-compose-audience-summary">Sending to {resolved.length} {resolved.length===1?'person':'people'}</p>
        </>}</div>{errors.recipients&&<small className="staff-compose-error">{errors.recipients}</small>}
      </section>
      {errorKind==='send'&&error&&<InlineError message={error} onRetry={()=>void submit()}/ >}
    </div>
    <footer className="staff-compose-footer"><div className="staff-compose-footer-summary"><strong>Sending to {resolved.length} {resolved.length===1?'person':'people'}</strong>{!resolved.length?<small>{targets.length?'Choose who to send this to':'No one to send this to'}</small>:!title.trim()?<small>Add a title</small>:!body.trim()?<small>Add a message</small>:null}</div><div><button type="button" className="secondary-button" disabled={busy} onClick={close}>Cancel</button><button type="button" className="primary-button" disabled={busy||!title.trim()||!body.trim()||!resolved.length} onClick={()=>void submit()}>{busy?'Sending…':'Send message'}</button></div></footer>
  </section></div>
}

function InlineError({message,onRetry}:{message:string;onRetry:()=>void}){return <div className="staff-message-inline-error" role="alert"><AlertTriangle size={16}/><span>{message}</span><button type="button" onClick={onRetry}>Retry</button></div>}
function EmptyList({admin,onCreate}:{admin:boolean;onCreate?:()=>void}){return <div className="staff-message-empty"><Bell size={22}/><strong>No messages yet</strong><span>{admin?'Messages you send will appear here':'Announcements and alerts from your admins will appear here'}</span>{admin&&onCreate&&<button type="button" className="primary-button" onClick={onCreate}>New message</button>}</div>}
function EmptyFilter({onClear}:{onClear:()=>void}){return <div className="staff-message-empty"><Bell size={22}/><strong>No messages match this filter</strong><button type="button" className="staff-message-clear-filter" onClick={onClear}>Clear filter</button></div>}
function EmptyDetail(){return <div className="staff-message-empty staff-message-empty-detail"><MailOpen size={24}/><strong>Select a message to read it</strong></div>}
function DetailSkeleton(){return <div className="staff-message-detail-skeleton"><i/><i/><i/><i/></div>}
