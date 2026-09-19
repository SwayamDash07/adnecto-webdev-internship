import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const token = process.env.ADMIN_ROUTE_TOKEN
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return NextResponse.rewrite(new URL('/404', request.url))
  if (pathname.startsWith('/portal/')) {
    if (!token || (pathname !== `/portal/${token}` && !pathname.startsWith(`/portal/${token}/`))) return NextResponse.rewrite(new URL('/404', request.url))

    let response = NextResponse.next({ request })
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll(values: { name: string; value: string; options: CookieOptions }[]) {
            values.forEach(({ name, value, options }) => {
              request.cookies.set(name, value)
              response.cookies.set(name, value, options)
            })
          },
        },
      },
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      const login = new URL('/auth/admin-sign-in', request.url)
      login.searchParams.set('returnTo', pathname + request.nextUrl.search)
      return NextResponse.redirect(login)
    }

    const { data: profile, error } = await supabase.rpc('get_my_admin_profile')
    if (error || !profile?.[0]) {
      const login = new URL('/auth/admin-sign-in', request.url)
      login.searchParams.set('error', 'not_admin')
      return NextResponse.redirect(login)
    }

    const internal = request.nextUrl.clone()
    const portalPrefix = `/portal/${token}`
    internal.pathname = `/admin${pathname.slice(portalPrefix.length) || '/'}`
    const rewritten = NextResponse.rewrite(internal, { request })
    response.cookies.getAll().forEach(cookie => rewritten.cookies.set(cookie))
    return rewritten
  }
  return NextResponse.next()
}

export const config = { matcher: ['/admin/:path*', '/portal/:path*'] }
