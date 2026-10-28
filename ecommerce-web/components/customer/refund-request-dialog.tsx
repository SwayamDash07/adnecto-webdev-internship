'use client'

import { useMemo, useState } from 'react'
import { X, Plus, Minus, Package } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { money } from '@/lib/formatters'
import { uncroppedProductImage } from '@/lib/product-image'

type Line = { id: number; quantity: number; unit_price: number; gst_amount:number; discount_amount:number; is_returnable:boolean; products: { name: string; product_images: { storage_path: string; sort_order: number | null }[] | null } | null }
const reasons = ['Damaged or defective', 'Wrong item', 'Not as described', 'Changed my mind', 'Other']

export function RefundRequestDialog({ orderId, addressId, pickupAddress, items, feeRefund, pricingAvailable, prepaid, onClose, onSubmitted }: { orderId: number; addressId:number|null; pickupAddress:string; items: Line[]; feeRefund:number; pricingAvailable:boolean; prepaid: boolean; onClose: () => void; onSubmitted: () => void }) {
  const [selected, setSelected] = useState<Record<number, number>>({})
  const [reason, setReason] = useState('Damaged or defective')
  const [requestType, setRequestType] = useState<'return_and_refund'|'refund_only'>('return_and_refund')
  const [pickupSlot, setPickupSlot] = useState('')
  const [addressConfirmed,setAddressConfirmed]=useState(true)
  const [comment, setComment] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const refundOnlyReasons=['Damaged or defective','Wrong item','Not as described']
  const eligibleSlots=useMemo(()=>Array.from({length:3},(_,i)=>{const d=new Date();d.setDate(d.getDate()+i+1);const date=d.toISOString().slice(0,10);return [`${date} | 10:00-12:00`,`${date} | 16:00-18:00`]}).flat(),[])
  const estimate = useMemo(() => items.reduce((sum, item) => sum + Math.round(((Number(item.unit_price)*item.quantity+Number(item.gst_amount)-Number(item.discount_amount))/item.quantity)*(selected[item.id]??0)), 0) + (['Damaged or defective','Wrong item','Not as described'].includes(reason)?feeRefund:0), [items, selected, feeRefund, reason])
  async function submit() {
    setBusy(true); setError('')
    const client = createSupabaseBrowserClient()
    const p_items = Object.entries(selected).filter(([, quantity]) => quantity > 0).map(([order_item_id, quantity]) => ({ order_item_id: Number(order_item_id), quantity }))
    if (!client) { setError('Refund requests are unavailable right now.'); setBusy(false); return }
    if (!pricingAvailable) { setError('This order predates refund price snapshots. Please contact support for help with this request.'); setBusy(false); return }
    const {data:{user}}=await client.auth.getUser()
    if (!user) { setError('Please sign in to submit a refund request.'); setBusy(false); return }
    const photoPaths:string[]=[]
    for (const photo of photos) {
      const path=`refunds/${user.id}/${crypto.randomUUID()}-${photo.name.replace(/[^a-zA-Z0-9._-]/g,'-')}`
      const {error:uploadError}=await client.storage.from('refund-photos').upload(path,photo,{contentType:photo.type,upsert:false})
      if(uploadError){if(photoPaths.length)void client.storage.from('refund-photos').remove(photoPaths);setError(`Photo upload failed: ${uploadError.message}`);setBusy(false);return}
      photoPaths.push(path)
    }
    const { error: rpcError } = await client.rpc('create_refund_request', { p_order_id: orderId, p_reason: reason, p_comment: comment, p_items, p_photos:photoPaths, p_type:requestType, p_pickup_slot:requestType==='return_and_refund'?pickupSlot:null, p_pickup_address_id:requestType==='return_and_refund'?addressId:null })
    if (rpcError) { if(photoPaths.length)void client.storage.from('refund-photos').remove(photoPaths);setError(rpcError.message.includes('RETURN_WINDOW_CLOSED') ? 'The return window has closed.' : rpcError.message); setBusy(false); return }
    setBusy(false); onSubmitted()
  }
  return <div className="refund-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose() }}><section className="refund-modal" role="dialog" aria-modal="true" aria-labelledby="refund-title">
    <header><div><p className="eyebrow">ORDER #{orderId}</p><h2 id="refund-title">Return or refund</h2></div><button type="button" className="refund-close" onClick={onClose} aria-label="Close refund request" disabled={busy}><X size={20}/></button></header>
    <div className="refund-modal-body" aria-live="polite"><fieldset className="refund-type-choice"><legend>How would you like us to resolve this?</legend><label><input type="radio" name="refund-type" checked={requestType==='return_and_refund'} onChange={()=>setRequestType('return_and_refund')}/><span><strong>Return and refund</strong><small>Send the item back and get your money back after we receive it.</small></span></label>{refundOnlyReasons.includes(reason)&&<label><input type="radio" name="refund-type" checked={requestType==='refund_only'} onChange={()=>setRequestType('refund_only')}/><span><strong>Refund only</strong><small>Our team may decide to skip the return.</small></span></label>}</fieldset><fieldset className="refund-items"><legend>Select items and quantities</legend>{items.some(item=>!item.is_returnable)&&<p className="refund-item-policy">Items marked “Not returnable” can only be requested for a refund if they are damaged, wrong, or not as described.</p>}{items.map(item => { const img = [...(item.products?.product_images ?? [])].sort((a,b)=>(a.sort_order??0)-(b.sort_order??0))[0]?.storage_path; const blocked=requestType==='return_and_refund'&&!item.is_returnable&&!refundOnlyReasons.includes(reason); return <div className={`refund-item${blocked?' not-returnable':''}`} key={item.id}><label><input type="checkbox" disabled={blocked} checked={(selected[item.id] ?? 0)>0} onChange={event => setSelected(current => ({...current,[item.id]:event.target.checked?1:0}))}/>{img?<img src={uncroppedProductImage(img)} alt=""/>:<span className="refund-no-image"><Package size={20}/></span>}<strong>{item.products?.name ?? 'Ordered item'}</strong>{!item.is_returnable&&<small className="refund-item-returnability">Not returnable</small>}</label><div className="refund-quantity"><button type="button" aria-label={`Decrease ${item.products?.name ?? 'item'} quantity`} disabled={blocked||!selected[item.id]} onClick={()=>setSelected(current=>({...current,[item.id]:Math.max(0,(current[item.id]??0)-1)}))}><Minus size={14}/></button><span>{selected[item.id]??0}</span><button type="button" aria-label={`Increase ${item.products?.name ?? 'item'} quantity`} disabled={blocked||(selected[item.id]??0)>=item.quantity} onClick={()=>setSelected(current=>({...current,[item.id]:Math.min(item.quantity,(current[item.id]??0)+1)}))}><Plus size={14}/></button><small>of {item.quantity}</small></div></div>})}</fieldset>
    <label className="refund-field">Reason<select value={reason} onChange={event=>{const next=event.target.value;setReason(next);if(!refundOnlyReasons.includes(next))setRequestType('return_and_refund');if(!refundOnlyReasons.includes(next))setSelected(current=>Object.fromEntries(Object.entries(current).filter(([id,q])=>q>0&&items.find(item=>item.id===Number(id))?.is_returnable)))}}>{reasons.map(value=><option key={value}>{value}</option>)}</select></label><label className="refund-field">{reason==='Other'?'Comment (required)':'Comment (optional)'}<textarea maxLength={300} value={comment} onChange={event=>setComment(event.target.value)} placeholder="Add details for our team"/><small>{comment.length}/300</small></label>
    <label className="refund-field">Photos (optional, up to 3)<input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={event=>{const chosen=Array.from(event.target.files??[]);if(chosen.length>3){setError('Choose no more than 3 images.');event.target.value='';return}if(chosen.some(file=>file.size>5*1024*1024)){setError('Each image must be smaller than 5 MB.');event.target.value='';return}if(chosen.some(file=>!['image/png','image/jpeg','image/webp'].includes(file.type))){setError('Choose PNG, JPG or WebP images.');event.target.value='';return}setError('');setPhotos(chosen)}}/><small>{photos.length?photos.map(photo=>photo.name).join(', '):'PNG, JPG or WebP · up to 5 MB each'}</small></label>
    <div className="refund-payment-method"><strong>Refund method</strong><span>{prepaid?'Original payment method':'We’ll contact you about your refund'}</span></div><div className="refund-estimate"><span>Estimated refund</span><strong>{pricingAvailable?money(estimate):'—'}</strong><small>Final amount is confirmed after we check your item.</small></div>{!pricingAvailable&&<p className="refund-error" role="status">This older order has no saved tax and discount breakdown. Please contact support.</p>}{error&&<p className="refund-error" role="alert">{error}</p>}</div>
    <footer><button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancel</button><button type="button" className="primary-button" onClick={()=>void submit()} disabled={busy||!pricingAvailable||estimate<=0||!Object.values(selected).some(q=>q>0)||(reason==='Other'&&!comment.trim())||(requestType==='return_and_refund'&&(!pickupSlot||!addressId||!addressConfirmed))}>{busy?'Submitting…':'Submit request'}</button></footer>
  </section></div>
}
