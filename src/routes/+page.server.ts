import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  // Return user data for client-side redirect (faster)
  // Server redirect is fallback
  return {
    user: locals.user
  };
};
