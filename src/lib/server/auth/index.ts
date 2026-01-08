import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { username } from 'better-auth/plugins';
import { db } from '../db';
import * as schema from '../db/schema';
import { BETTER_AUTH_SECRET, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, BETTER_AUTH_URL } from '$env/static/private';
import { PUBLIC_APP_NAME } from '$env/static/public';

// Check if GitHub OAuth is configured
const hasGitHubConfig = Boolean(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: schema
  }),
  
  appName: PUBLIC_APP_NAME || 'MoneyKracked',
  
  secret: BETTER_AUTH_SECRET,
  
  // Explicit base URL is critical for OAuth callback URLs
  baseURL: BETTER_AUTH_URL,
  
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: false
  },
  
  plugins: [
    username()
  ],
  
  socialProviders: hasGitHubConfig ? {
    github: {
      clientId: GITHUB_CLIENT_ID,
      clientSecret: GITHUB_CLIENT_SECRET
    }
  } : {},
  
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  
  advanced: {
    // Force secure cookies since we're on HTTPS
    useSecureCookies: true,
    
    // Trust proxy headers (Cloudflare)
    trustHostHeader: true,
    
    // Cookie settings - SameSite=None allows cross-site cookies (needed for OAuth redirects)
    // But requires Secure=true
    defaultCookieAttributes: {
      secure: true,
      sameSite: 'none', // Allow cookies on cross-site redirects from GitHub
      path: '/',
      httpOnly: true
    }
  },
  
  trustedOrigins: [
    'https://test2.owlscottage.com',
    'http://test2.owlscottage.com',
    'http://localhost:5173',
    'http://localhost:5174'
  ],
  
  // DISABLED: We don't want auto-linking based on email.
  // Users must explicitly link GitHub in Settings page first.
  // account: {
  //   accountLinking: {
  //     enabled: true,
  //     trustedProviders: ['github']
  //   }
  // }
});

export type Session = typeof auth.$Infer.Session;
