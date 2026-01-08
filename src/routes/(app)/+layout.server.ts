import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  // If not authenticated, redirect to login
  if (!locals.user) {
    throw redirect(303, '/login');
  }
  
  return {
    user: locals.user,
    session: locals.session
  };
};
