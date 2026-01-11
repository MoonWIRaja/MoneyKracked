import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { queryClient } from '$lib/server/db';

/**
 * Validate token from Authorization header and set session cookie
 * Uses a custom cookie name 'mk_session' to bypass proxy filtering
 */
export const POST: RequestHandler = async ({ cookies, request }) => {
	try {
		// Get token from Authorization header
		const authHeader = request.headers.get('Authorization');
		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			console.log('[Validate-Token] No Authorization header found');
			return json({ error: 'No token provided' }, { status: 401 });
		}

		// Token is in format: sessionToken.signature (HMAC signed)
		const fullToken = authHeader.substring(7); // Remove 'Bearer ' prefix
		console.log('[Validate-Token] Received token:', fullToken.substring(0, 30) + '...');

		// Extract the actual session token (before the dot if signed)
		const sessionToken = fullToken.includes('.') ? fullToken.split('.')[0] : fullToken;

		// Look up session with user using raw postgres-js client (not Drizzle)
		// Note: must list columns explicitly to avoid id column conflict
		const result = await queryClient.unsafe(
			'SELECT s.id as "session_id", s.user_id as "session_user_id", s.token, s.expires_at, s.ip_address, s.user_agent, s.device_id, s.created_at as "session_created_at", s.updated_at as "session_updated_at", u.id as "user_id", u.email, u.name, u.username, u.image, u.email_verified, u.two_factor_enabled, u.created_at as "user_created_at", u.updated_at as "user_updated_at" FROM session s INNER JOIN "user" u ON s.user_id = u.id WHERE s.token = $1 LIMIT 1',
			[sessionToken]
		);

		if (!result || result.length === 0) {
			console.log('[Validate-Token] Session not found in database');
			return json({ error: 'Invalid session' }, { status: 401 });
		}

		const sessionRow = result[0] as any;

		// Check if session is expired
		if (sessionRow.expires_at && new Date(sessionRow.expires_at) < new Date()) {
			console.log('[Validate-Token] Session expired');
			return json({ error: 'Session expired' }, { status: 401 });
		}

		console.log('[Validate-Token] Session valid for user:', sessionRow.email);

		// Set session cookie with a DIFFERENT NAME to bypass proxy filtering
		// Use 'mk_session' instead of 'better-auth.session_token'
		cookies.set('mk_session', fullToken, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: false, // Proxy terminates SSL
			maxAge: 60 * 60 * 24 * 7 // 7 days
		});

		console.log('[Validate-Token] Cookie set with name mk_session');

		return json({ success: true, redirect: '/dashboard' });
	} catch (err) {
		console.error('[Validate-Token] Error:', err);
		return json({ error: 'Failed to validate token' }, { status: 500 });
	}
};
