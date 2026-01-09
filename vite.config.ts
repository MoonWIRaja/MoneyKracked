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

	// Determine if we're behind a proxy
	const isBehindProxy = env.VERCEL || env.RENDER || env.CF_PAGES || env.AWS_LAMBDA;

	const serverConfig: any = {
		port,
		host: true,
		allowedHosts: allowedHosts.length > 0 ? allowedHosts : undefined,
		headers: {
			'Cache-Control': 'no-store, no-cache, must-revalidate'
		}
	};

	// Only configure HMR for local development
	if (!isBehindProxy && mode === 'development') {
		serverConfig.hmr = {
			protocol: 'ws',
			host: 'localhost',
			port,
			clientPort: port
		};
	}

	return {
		plugins: [tailwindcss(), sveltekit()],
		server: serverConfig,
		preview: {
			port,
			host: true,
			allowedHosts: allowedHosts.length > 0 ? allowedHosts : undefined
		}
	};
});
