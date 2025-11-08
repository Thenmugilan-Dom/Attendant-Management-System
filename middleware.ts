import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Protected routes that require authentication
  const protectedRoutes = ['/admin', '/teacher']
  
  // Check if the current path starts with any protected route
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  )

  // If it's a protected route, redirect to login
  // Since we're using localStorage for auth (client-side), 
  // we can't check it in middleware (server-side)
  // So we'll let the client-side protection handle it
  // But we can add headers to prevent caching

  if (isProtectedRoute) {
    const response = NextResponse.next()
    // Prevent caching of protected pages
    response.headers.set('Cache-Control', 'no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    return response
  }

  return NextResponse.next()
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|public).*)',
  ],
}
