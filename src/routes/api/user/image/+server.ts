import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user as userTable, session as sessionTable } from '$lib/server/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import type { RequestHandler } from './$types';

// Get user ID helper - same as preferences endpoint
async function getUserId(request: Request, cookies: any): Promise<string | null> {
  const { auth } = await import('$lib/server/auth');
  const session = await auth.api.getSession({ headers: request.headers });
  if (session?.user?.id) return session.user.id;

  const customToken = cookies.get('better-auth.session_token');
  if (customToken) {
    const dbSession = await db.query.session.findFirst({
      where: and(
        eq(sessionTable.token, customToken),
        gt(sessionTable.expiresAt, new Date())
      )
    });
    if (dbSession) return dbSession.userId;
  }
  return null;
}

/**
 * POST /api/user/image
 * Upload and update user profile image
 *
 * Accepts multipart/form-data with an 'image' file
 * Converts image to base64 data URL and stores in database
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    // Get user ID from session
    const userId = await getUserId(request, cookies);

    if (!userId) {
      console.error('[Image Upload] No user ID found in session');
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Image Upload] User ID:', userId);

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      console.error('[Image Upload] No image file provided');
      return json({ error: 'No image file provided' }, { status: 400 });
    }

    console.log('[Image Upload] File:', file.name, file.type, file.size);

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return json({ error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.' }, { status: 400 });
    }

    // Validate file size (max 2MB)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      return json({ error: 'File too large. Maximum size is 2MB.' }, { status: 400 });
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    console.log('[Image Upload] Base64 length:', dataUrl.length);

    // Update user image in database
    await db
      .update(userTable)
      .set({ image: dataUrl, updatedAt: new Date() })
      .where(eq(userTable.id, userId));

    console.log('[Image Upload] Image updated successfully for user:', userId);

    return json({
      success: true,
      image: dataUrl
    });
  } catch (error) {
    console.error('[Image Upload] Error:', error);
    return json({ error: 'Failed to upload image' }, { status: 500 });
  }
};

/**
 * DELETE /api/user/image
 * Remove user profile image
 */
export const DELETE: RequestHandler = async ({ request, cookies }) => {
  try {
    // Get user ID from session
    const userId = await getUserId(request, cookies);

    if (!userId) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Image Delete] User ID:', userId);

    // Remove user image
    await db
      .update(userTable)
      .set({ image: null, updatedAt: new Date() })
      .where(eq(userTable.id, userId));

    console.log('[Image Delete] Image removed successfully for user:', userId);

    return json({ success: true });
  } catch (error) {
    console.error('[Image Delete] Error:', error);
    return json({ error: 'Failed to remove image' }, { status: 500 });
  }
};
