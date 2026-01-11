import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  return {
    user: locals.user ? {
      id: locals.user.id,
      name: locals.user.name,
      email: locals.user.email,
      image: locals.user.image
    } : null
  };
};
