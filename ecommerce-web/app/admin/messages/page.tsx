import { redirect } from 'next/navigation'

export default function StaffMessagesAlias(){redirect(`/portal/${process.env.NEXT_PUBLIC_ADMIN_ROUTE_TOKEN ?? ''}/notifications`)}
