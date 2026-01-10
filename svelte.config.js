import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	// Enable Svelte 5 runes
	compilerOptions: {
		runes: true
	},

	// Disable specific a11y warnings
	// Card component uses conditional tabindex/role for clickable cards
	// Modal overlay uses click handlers for closing
	onwarn: (warning, handler) => {
		if (warning.code === 'a11y_no_noninteractive_tabindex') return;
		if (warning.code === 'a11y_click_events_have_key_events') return;
		if (warning.code === 'a11y_no_static_element_interactions') return;
		if (warning.code === 'state_referenced_locally') return;
		handler(warning);
	},

	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter()
	}
};

export default config;

