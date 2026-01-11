import type { Handle } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { db, queryClient } from '$lib/server/db';
import { session, user as userTable } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const handle: Handle = async ({ event, resolve }) => {
	const { request, url, cookies } = event;
	const startTime = Date.now();

	// 1. Handle Better Auth API requests directly - no DB query needed
	// But exclude our custom endpoints
	if (url.pathname.startsWith("/api/auth") &&
	    !url.pathname.startsWith("/api/auth/set-session") &&
	    !url.pathname.startsWith("/api/auth/create-session") &&
	    !url.pathname.startsWith("/api/auth/validate-token")) {
		// Debug: Log cookies for auth requests
		const cookieHeader = request.headers.get('cookie');
		console.log('[Hooks] /api/auth request, cookies:', cookieHeader?.substring(0, 100) || 'No cookies');
		return auth.handler(request);
	}

	// Debug set-session endpoint
	if (url.pathname.startsWith("/api/auth/set-session")) {
		console.log('[Hooks] /api/auth/set-session request');
	}

	// Debug create-session endpoint
	if (url.pathname.startsWith("/api/auth/create-session")) {
		console.log('[Hooks] /api/auth/create-session request');
	}

	// Debug validate-token endpoint
	if (url.pathname.startsWith("/api/auth/validate-token")) {
		console.log('[Hooks] /api/auth/validate-token request');
	}

	// Debug: Log response Set-Cookie headers for callback
	if (url.pathname.startsWith("/api/github-oauth/callback")) {
		console.log('[Hooks] GitHub OAuth callback request, cookies:', request.headers.get('cookie')?.substring(0, 200) || 'No cookies');
	}

	// Debug: Log request cookies for auth/callback page
	if (url.pathname.startsWith("/auth/callback")) {
		console.log('[Hooks] /auth/callback request, cookies:', request.headers.get('cookie')?.substring(0, 200) || 'No cookies');
	}

	// 2. Check session for ALL routes (needed for SSR to pass user to layout)
	// First try Better Auth's standard session, then check our custom mk_session cookie
	const isStaticAsset = url.pathname.startsWith('/_app/') || url.pathname.startsWith('/static/');

	if (!isStaticAsset) {
		// Debug: Log cookies for dashboard
		if (url.pathname.startsWith('/dashboard')) {
			const cookieHeader = request.headers.get('cookie');
			console.log('[Hooks] Dashboard cookies:', cookieHeader?.substring(0, 200) || 'No cookies');
		}

		// First try standard Better Auth session
		try {
			const session = await auth.api.getSession({
				headers: event.request.headers
			});
			if (session?.user) {
				event.locals.session = session.session;
				event.locals.user = session.user;
				// Debug: Log session check for dashboard
				if (url.pathname.startsWith('/dashboard')) {
					console.log('[Hooks] Dashboard session check (Better Auth):', session.user.email);
				}
			} else {
				// No Better Auth session, try mk_session cookie
				await checkCustomSession(event);
			}
		} catch {
			// Better Auth failed, try custom session
			await checkCustomSession(event);
		}
	} else {
		event.locals.session = null;
		event.locals.user = null;
	}

	// Helper function to check custom mk_session cookie
	async function checkCustomSession(evt: typeof event) {
		const mkSession = cookies.get('mk_session');
		if (mkSession) {
			console.log('[Hooks] Found mk_session cookie, validating...');
			// Extract session token (before the dot if signed)
			const sessionToken = mkSession.includes('.') ? mkSession.split('.')[0] : mkSession;

			try {
				// Use raw postgres-js client (not Drizzle) to avoid relations issue
				// Note: must list columns explicitly to avoid id column conflict
				const result = await queryClient.unsafe(
					'SELECT s.id as "session_id", s.user_id as "session_user_id", s.token, s.expires_at, s.ip_address, s.user_agent, s.device_id, s.created_at as "session_created_at", s.updated_at as "session_updated_at", u.id as "user_id", u.email, u.name, u.username, u.image, u.email_verified, u.two_factor_enabled, u.created_at as "user_created_at", u.updated_at as "user_updated_at" FROM session s INNER JOIN "user" u ON s.user_id = u.id WHERE s.token = $1 LIMIT 1',
					[sessionToken]
				);

				if (result && result.length > 0) {
					const sessionRow = result[0] as any;

					// Check expiration
					if (!sessionRow.expires_at || new Date(sessionRow.expires_at) > new Date()) {
						console.log('[Hooks] mk_session valid for user:', sessionRow.email);

						// Build session object
						const sessionData = {
							id: sessionRow.session_id,
							userId: sessionRow.user_id,
							token: sessionRow.token,
							expiresAt: sessionRow.expires_at ? new Date(sessionRow.expires_at) : undefined,
							ipAddress: sessionRow.ip_address,
							userAgent: sessionRow.user_agent
						};

						// Build user object
						const userData = {
							id: sessionRow.user_id,
							email: sessionRow.email,
							name: sessionRow.name,
							username: sessionRow.username,
							image: sessionRow.image
						};

						evt.locals.session = sessionData as any;
						evt.locals.user = userData as any;
						return;
					} else {
						console.log('[Hooks] mk_session expired');
					}
				} else {
					console.log('[Hooks] mk_session not found in DB');
				}
			} catch (err) {
				console.error('[Hooks] Error checking mk_session:', err);
			}
		}

		// No valid session found
		evt.locals.session = null;
		evt.locals.user = null;

		// Debug: Log session check for dashboard
		if (url.pathname.startsWith('/dashboard')) {
			console.log('[Hooks] Dashboard session check: No session found');
		}
	}

	// 3. Resolve the request
	const response = await resolve(event);

	// Debug: Log response Set-Cookie headers for callback
	if (url.pathname.startsWith("/api/github-oauth/callback")) {
		const setCookieHeaders = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
		console.log('[Hooks] Response Set-Cookie headers:', setCookieHeaders);
		console.log('[Hooks] Response status:', response.status);
		console.log('[Hooks] Response Location:', response.headers.get('Location'));
	}

	// Debug: Log response Set-Cookie headers for set-session
	if (url.pathname.startsWith("/api/auth/set-session")) {
		const setCookieHeaders = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
		console.log('[Hooks] set-session Response Set-Cookie headers:', setCookieHeaders);
		console.log('[Hooks] set-session Response status:', response.status);
	}

	// Debug: Log response Set-Cookie headers for create-session
	if (url.pathname.startsWith("/api/auth/create-session")) {
		const setCookieHeaders = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
		console.log('[Hooks] create-session Response Set-Cookie headers:', setCookieHeaders);
		console.log('[Hooks] create-session Response status:', response.status);
	}

	// 4. Log requests (only in production/start mode)
	if (process.env.NODE_ENV !== 'development') {
		const duration = Date.now() - startTime;
		const method = request.method;
		const status = response.status;
		const timestamp = new Date().toISOString();

		// Color codes for terminal
		const reset = '\x1b[0m';
		const green = '\x1b[32m';
		const red = '\x1b[31m';
		const yellow = '\x1b[33m';
		const cyan = '\x1b[36m';
		const dim = '\x1b[2m';

		let statusColor = green;
		if (status >= 400) statusColor = yellow;
		if (status >= 500) statusColor = red;

		// Log format: [timestamp] METHOD PATH status duration
		console.log(
			`${dim}[${timestamp}]${reset} ${cyan}${method}${reset} ${url.pathname} ${statusColor}${status}${reset} ${dim}${duration}ms${reset}`
		);
	}

	return response;
};
