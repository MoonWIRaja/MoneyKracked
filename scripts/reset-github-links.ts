/**
 * Script to delete all GitHub account links from database.
 * Run with: npx tsx scripts/reset-github-links.ts
 */
import { db } from '../src/lib/server/db';
import { account } from '../src/lib/server/db/schema';
import { eq } from 'drizzle-orm';

async function resetGitHubLinks() {
  console.log('Deleting all GitHub account links...');

  try {
    const result = await db.delete(account)
      .where(eq(account.providerId, 'github'));

    console.log('✅ All GitHub account links deleted successfully!');
    console.log('Now users must explicitly link GitHub from Settings before using GitHub login.');
  } catch (err) {
    console.error('❌ Error deleting GitHub links:', err);
  }
}

resetGitHubLinks();
