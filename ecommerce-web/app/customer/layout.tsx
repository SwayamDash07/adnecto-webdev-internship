// Customer data is scoped to the current session; never share a rendered
// customer subtree between users.
export const dynamic = 'force-dynamic'

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return children
}
