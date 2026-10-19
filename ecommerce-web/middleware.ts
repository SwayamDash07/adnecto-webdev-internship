import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const protectedPathHeader = 'x-cartly-protected-path'
const protectedCustomerRoutes = ['/customer/account', '/customer/dashboard', '/customer/checkout', '/customer/orders', '/customer/support']

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const token = process.env.ADMIN_ROUTE_TOKEN
  const requestHeaders = new Headers(request.headers)
  let internalPath = pathname

  // Keep the internal admin tree inaccessible directly. Portal paths are
  // rewritten below; the server layout performs authentication/authorization.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return NextResponse.rewrite(new URL('/404', request.url))
  }

  const isPortal = pathname.startsWith('/portal/')
  const isDirectStaffRoute = ['/delivery', '/picker', '/inventory'].some(
    route => pathname === route || pathname.startsWith(`${route}/`),
  )
  const isProtectedCustomerRoute = protectedCustomerRoutes.some(route => pathname === route || pathname.startsWith(`${route}/`))
  if (isPortal) {
    if (!token || (pathname !== `/portal/${token}` && !pathname.startsWith(`/portal/${token}/`))) {
      return NextResponse.rewrite(new URL('/404', request.url))
    }
    internalPath = pathname.slice(`/portal/${token}`.length) || '/'
  }

  if (isPortal || isDirectStaffRoute) {
    requestHeaders.set(protectedPathHeader, internalPath)
  } else {
    requestHeaders.delete(protectedPathHeader)
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } })
  let user: { id: string } | null = null
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values: { name: string; value: string; options: CookieOptions }[]) {
          values.forEach(({ name, value }) => request.cookies.set(name, value))
          requestHeaders.set('cookie', request.cookies.toString())
          response = NextResponse.next({ request: { headers: requestHeaders } })
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    })
    try {
      // This is the only Supabase operation in middleware: refresh session cookies.
      const result = await supabase.auth.getUser()
      user = result.data.user
    } catch (error) {
      console.error('[middleware] Supabase session refresh failed', error instanceof Error ? error.message : error)
    }
  }

  // Resolve anonymous protected requests before the admin loading boundary can
  // start a streamed 200 response containing a client-side redirect meta tag.
  if ((isPortal || isDirectStaffRoute) && !user) {
    const returnTo = encodeURIComponent(pathname)
    const redirectResponse = NextResponse.redirect(new URL(`/auth/admin-sign-in?returnTo=${returnTo}`, request.url))
    response.cookies.getAll().forEach(cookie => redirectResponse.cookies.set(cookie))
    return redirectResponse
  }
  if (isProtectedCustomerRoute && !user) {
    const returnTo = encodeURIComponent(`${pathname}${request.nextUrl.search}`)
    const redirectResponse = NextResponse.redirect(new URL(`/auth/sign-in?returnTo=${returnTo}`, request.url))
    response.cookies.getAll().forEach(cookie => redirectResponse.cookies.set(cookie))
    return redirectResponse
  }

  if (isPortal) {
    const internal = request.nextUrl.clone()
    internal.pathname = `/admin${internalPath === '/' ? '' : internalPath}`
    const rewritten = NextResponse.rewrite(internal, { request: { headers: requestHeaders } })
    response.cookies.getAll().forEach(cookie => rewritten.cookies.set(cookie))
    return rewritten
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
