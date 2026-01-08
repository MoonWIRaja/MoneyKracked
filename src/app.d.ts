// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session: {
				id: string;
				userId: string;
				token: string;
				expiresAt: Date;
			} | null;
			user: {
				id: string;
				email: string;
				name: string;
				image?: string | null;
				emailVerified: boolean;
				createdAt: Date;
				updatedAt: Date;
			} | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
