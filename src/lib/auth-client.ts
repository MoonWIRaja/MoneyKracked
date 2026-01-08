import { createAuthClient } from 'better-auth/svelte';
import { usernameClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : '',
  plugins: [
    usernameClient()
  ]
});

export const {
  signIn,
  signOut,
  signUp,
  useSession,
  linkSocial
} = authClient;
