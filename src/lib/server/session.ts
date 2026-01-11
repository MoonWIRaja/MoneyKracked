import { auth } from './auth';
import { queryClient } from './db';

/**
 * Get user ID from request using either Better Auth session or custom mk_session cookie
 * This helper is used by API endpoints that need to authenticate users
 */
export async function getUserId(request: Request, cookies: any): Promise<string | null> {
	// Try Better Auth session first
	const session = await auth.api.getSession({ headers: request.headers });
	if (session?.user?.id) return session.user.id;

	// Check mk_session cookie (our custom session to bypass proxy filtering)
	let customToken = cookies.get('mk_session');
	if (!customToken) {
		customToken = cookies.get('better-auth.session_token');
	}

	if (customToken) {
		// Extract session token (before the dot if signed)
		const sessionToken = customToken.includes('.') ? customToken.split('.')[0] : customToken;

		// Use raw SQL to avoid Drizzle relations issue
		const result = await queryClient.unsafe(
			'SELECT s.user_id FROM session s WHERE s.token = $1 AND (s.expires_at IS NULL OR s.expires_at > NOW()) LIMIT 1',
			[sessionToken]
		);

		if (result && result.length > 0) {
			return (result[0] as any).user_id;
		}
	}

	return null;
}
