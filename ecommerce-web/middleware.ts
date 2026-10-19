import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const protectedPathHeader = 'x-cartly-protected-path'

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
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values: { name: string; value: string; options: CookieOptions }[]) {
          values.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
          })
          requestHeaders.set('cookie', request.cookies.toString())
          response = NextResponse.next({ request: { headers: requestHeaders } })
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  // This is the only Supabase operation in middleware: refresh session cookies.
  await supabase.auth.getUser()

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
