import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  // If authenticated, go to dashboard; otherwise go to login
  if (locals.user) {
    throw redirect(303, '/dashboard');
  }
  throw redirect(303, '/login');
};
