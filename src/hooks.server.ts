import type { Handle } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { session as sessionTable, user as userTable } from '$lib/server/db/schema';
import { eq, and, gt } from 'drizzle-orm';

export const handle: Handle = async ({ event, resolve }) => {
  // 1. Handle Better Auth API requests directly
  const { request, url, cookies } = event;
  if (url.pathname.startsWith("/api/auth")) {
    return auth.handler(request);
  }
  
  // 2. Try Better Auth session first
  let session = await auth.api.getSession({
    headers: event.request.headers
  });
  
  // 3. Fallback: Check our custom session cookie if Better Auth didn't find session
  if (!session) {
    const customSessionToken = cookies.get('better-auth.session_token');
    if (customSessionToken) {
      try {
        // Look up session in database
        const dbSession = await db.query.session.findFirst({
          where: and(
            eq(sessionTable.token, customSessionToken),
            gt(sessionTable.expiresAt, new Date())
          )
        });
        
        if (dbSession) {
          // Get user
          const dbUser = await db.query.user.findFirst({
            where: eq(userTable.id, dbSession.userId)
          });
          
          if (dbUser) {
            session = {
              session: {
                id: dbSession.id,
                userId: dbSession.userId,
                token: dbSession.token,
                expiresAt: dbSession.expiresAt,
                createdAt: dbSession.createdAt,
                updatedAt: dbSession.updatedAt,
                ipAddress: dbSession.ipAddress,
                userAgent: dbSession.userAgent
              },
              user: {
                ...dbUser,
                emailVerified: dbUser.emailVerified ?? false
              }
            };
            console.log('Custom session found for user:', dbUser.email);
          }
        }
      } catch (err) {
        console.error('Error checking custom session:', err);
      }
    }
  }
  
  // 4. Attach session to locals
  event.locals.session = session?.session || null;
  event.locals.user = session?.user || null;
  
  // Debug log for troubleshooting
  if (event.url.pathname === '/login' && event.request.method === 'GET') {
    console.log('Login Page Visit - Session:', !!session);
  }
  
  // 5. Protect Dashboard routes
  const protectedPaths = ['/dashboard', '/transactions', '/budget', '/reports', '/settings', '/coach'];
  const isProtectedPath = protectedPaths.some(path => event.url.pathname.startsWith(path));
  
  if (isProtectedPath && !session) {
    return new Response(null, {
      status: 303,
      headers: { Location: '/login' }
    });
  }
  
  // 6. Redirect logged-in users away from /login and /register
  // BUT allow if there's an error param (e.g. from failed GitHub login)
  const authPaths = ['/login', '/register'];
  const hasErrorParam = event.url.searchParams.has('error');
  
  if (authPaths.includes(event.url.pathname) && session && !hasErrorParam) {
    console.log('User logged in, redirecting to dashboard');
    return new Response(null, {
      status: 303,
      headers: { Location: '/dashboard' }
    });
  }
  
  return resolve(event);
};
