import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user as userTable } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { getUserId } from '$lib/server/session';

/**
 * Resize and compress image using canvas (client-side) approach
 * For server-side, we'll just validate and convert to base64 with size limits
 */
async function processImage(buffer: Buffer, mimeType: string): Promise<string> {
  // For now, just convert to base64 with size validation
  // The client should handle resizing before upload
  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
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

    // Validate file size (max 500KB to prevent connection issues)
    const maxSize = 500 * 1024; // 500KB
    if (file.size > maxSize) {
      return json({
        error: 'File too large. Please compress your image to under 500KB.',
        details: `Your file is ${(file.size / 1024).toFixed(0)}KB. Recommended: Use a square image under 500KB.`
      }, { status: 400 });
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Estimate base64 size (base64 is ~33% larger)
    const estimatedBase64Size = buffer.length * 1.33;
    if (estimatedBase64Size > 500_000) { // ~500KB limit for base64
      return json({
        error: 'Image would be too large after encoding. Please use a smaller image.',
        details: `Recommended: Use a square image under 400KB.`
      }, { status: 400 });
    }

    const dataUrl = await processImage(buffer, file.type);

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
    return json({ error: 'Failed to upload image', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
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
