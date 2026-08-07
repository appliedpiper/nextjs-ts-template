// Next.js 16 renamed middleware to proxy; this is the former `middleware.ts`.
//
// Deliberately thin: every routing decision comes from `decideAccess` so the
// policy can be tested without Next or Clerk in the way. Add new rules there,
// not here.

import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

import { decideAccess, FORBIDDEN_REDIRECT_PATH } from '@/lib/auth/access'
import { getRole } from '@/lib/auth/roles'

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims, redirectToSignIn } = await auth()

  const decision = decideAccess({
    pathname: req.nextUrl.pathname,
    userId,
    role: getRole(sessionClaims),
  })

  if (decision.kind === 'allow') {
    return NextResponse.next()
  }

  if (decision.kind === 'redirect-sign-in') {
    return redirectToSignIn({ returnBackUrl: req.url })
  }

  // Anything else — currently only 'redirect-forbidden' — is denied rather than
  // allowed, so adding a decision kind can't accidentally fail open.
  return NextResponse.redirect(new URL(FORBIDDEN_REDIRECT_PATH, req.url))
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
