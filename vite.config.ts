import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	
	// Parse allowed hosts from environment
	const allowedHosts: string[] = [];
	if (env.ALLOWED_HOSTS) {
		allowedHosts.push(...env.ALLOWED_HOSTS.split(',').map(h => h.trim()).filter(Boolean));
	}
	
	// Parse port from environment
	const port = parseInt(env.PORT || '5173', 10);
	
	return {
		plugins: [tailwindcss(), sveltekit()],
		server: {
			port,
			host: true,
			allowedHosts: allowedHosts.length > 0 ? allowedHosts : undefined,
			headers: {
				'Cache-Control': 'no-store, no-cache, must-revalidate'
			}
		},
		preview: {
			port,
			host: true,
			allowedHosts: allowedHosts.length > 0 ? allowedHosts : undefined
		}
	};
});
