import type { PageLoad } from './$types';

export const load: PageLoad = async ({ data, depends }) => {
  // Tell SvelteKit this page depends on settings data
  // This will be used to invalidate when needed
  depends('app:settings');
  
  // Just pass through server data
  return data;
};
