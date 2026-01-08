import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { account } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user;
  
  console.log('=== Settings Page Load ===');
  console.log('User from locals:', user?.email || 'null');
  
  if (!user) {
    console.log('No user in locals, returning githubLinked=false');
    return {
      user: null,
      githubLinked: false
    };
  }
  
  // Check if user has linked GitHub account
  let githubLinked = false;
  let githubUsername = null;
  
  try {
    const linkedAccount = await db.query.account.findFirst({
      where: and(
        eq(account.userId, user.id),
        eq(account.providerId, 'github')
      )
    });
    
    console.log('GitHub linked account query result:', linkedAccount ? 'FOUND' : 'NOT FOUND');
    
    if (linkedAccount) {
      githubLinked = true;
      // Try to get GitHub username from stored data if available
      githubUsername = linkedAccount.accountId;
    }
  } catch (err) {
    console.error('Error checking GitHub link status:', err);
  }
  
  console.log('Returning githubLinked:', githubLinked);
  console.log('========================');
  
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image
    },
    githubLinked,
    githubUsername
  };
};
