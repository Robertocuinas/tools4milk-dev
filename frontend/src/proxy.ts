import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const protectedRoutes = [
  '/dashboard',
  '/zones',
  '/predictions',
  '/leanfarming',
  '/animals',
  '/quality',
  '/alerts',
  '/tasks',
  '/management',
  '/settings',
]

const TOKEN_COOKIE = 't4m_token'

export function proxy(request: NextRequest) {
  const token = request.cookies.get(TOKEN_COOKIE)?.value
  const pathname = request.nextUrl.pathname

  if (pathname === '/' && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route))

  if (isProtected && !token) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
