import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { auth } from '$lib/server/auth';

/**
 * Logout endpoint - uses Better Auth to clear session
 * Fast redirect with minimal processing
 */
export const GET: RequestHandler = async ({ cookies, request }) => {
	// Use Better Auth's signOut endpoint
	const response = await auth.api.signOut({
		headers: request.headers
	});

	// Clear all cookies including our custom mk_session cookie
	cookies.delete('better-auth.session_token', { path: '/' });
	cookies.delete('better-auth.session_data', { path: '/' });
	cookies.delete('mk_session', { path: '/' });

	// Return redirect to login
	return new Response(null, {
		status: 303,
		headers: {
			Location: '/login'
		}
	});
};
