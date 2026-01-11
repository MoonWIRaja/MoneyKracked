import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

// Enable SSR so session validation works
export const ssr = true;

export const load: PageServerLoad = async ({ locals }) => {
  // If user is already authenticated, redirect to dashboard
  if (locals.user) {
    throw redirect(302, '/dashboard');
  }

  // User not authenticated, show login page
  return {};
};
