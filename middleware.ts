import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { getJwtSecret } from '@/lib/jwt-secret'

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value
  const { pathname } = request.nextUrl
  
  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/']
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))
  
  if (isPublicRoute) {
    return NextResponse.next()
  }
  
  // Check if user is authenticated
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  let user
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(getJwtSecret()), { algorithms: ['HS256'] })
    if (typeof payload.id !== 'string' || typeof payload.role !== 'string') throw new Error('Invalid token')
    user = payload
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  // Role-based Access Control
  const role = user.role

  // ADMIN: Can ONLY access Dashboard, Account Management, and Settings
  if (role === 'ADMIN') {
    const allowedPaths = [
      '/dashboard',
      '/dashboard/accounts',
      '/dashboard/settings',
    ]

    const isAllowed = allowedPaths.some(path => 
      pathname === path || pathname.startsWith(path + '/')
    )

    if (!isAllowed) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Account Management: Only ADMIN can access
  if (pathname.startsWith('/dashboard/accounts')) {
    if (role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Household Management: TEAM_LEADER and DEPUTY only
  if (pathname.startsWith('/dashboard/households')) {
    // Block the delete route for everyone since we are removing the feature
    if (pathname.startsWith('/dashboard/households/delete')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    
    if (role !== 'TEAM_LEADER' && role !== 'LEADER' && role !== 'DEPUTY') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Resident Management (Persons): TEAM_LEADER and DEPUTY only
  if (pathname.startsWith('/dashboard/persons')) {
    if (role !== 'TEAM_LEADER' && role !== 'LEADER' && role !== 'DEPUTY') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // CALENDAR_MANAGER: Can only access Dashboard, Bookings, Settings
  // Should NOT access Cultural Centers, Households, Persons, Accounts, etc.
  if (role === 'CALENDAR_MANAGER') {
    const allowedPaths = [
      '/dashboard',
      '/dashboard/bookings',
      '/dashboard/settings',
    ]

    const isAllowed = allowedPaths.some(path => 
      pathname === path || pathname.startsWith(path + '/')
    )

    if (!isAllowed) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // FACILITY_MANAGER: Can only access Dashboard, Cultural Centers, Settings
  // Should NOT access Households, Persons, Accounts, etc.
  if (role === 'FACILITY_MANAGER') {
    const restrictedPaths = [
      '/dashboard/districts',
      '/dashboard/requests',
      '/dashboard/my-household',
      // '/dashboard/bookings', // Allowed
      // '/dashboard/calendar', // Allowed
      '/dashboard/households',
      '/dashboard/persons',
      '/dashboard/accounts',
    ]

    if (restrictedPaths.some(path => pathname.startsWith(path))) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|assets|favicon.ico).*)',
  ],
}
