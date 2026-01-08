import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { scanReceipt } from '$lib/server/ai/gemini';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized');
  }
  
  const { image } = await request.json() as { image: string };
  
  if (!image) {
    throw error(400, 'Image is required');
  }
  
  try {
    // Remove data URL prefix if present
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    
    const receiptData = await scanReceipt(base64Data);
    
    return json(receiptData);
  } catch (err) {
    console.error('Receipt scan error:', err);
    throw error(500, 'Failed to scan receipt');
  }
};
