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

// La cookie de sesión la emite el backend en ``POST /api/v1/auth/login`` con
// ``HttpOnly; Secure (en prod); SameSite=Lax``. Aunque el flag HttpOnly
// impide que JavaScript la lea, el navegador SÍ la expone al middleware de
// Next (server-side) — basta con comprobar presencia para redirigir UX.
// La validación criptográfica real la hace ``GET /api/v1/auth/me`` en el
// backend: una cookie presente pero caducada devuelve 401 y el layout
// cliente limpia el estado de sesión.
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
