import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { chat, type ChatMessage } from '$lib/server/ai/gemini';
import { db } from '$lib/server/db';
import { transactions, categories, budgets } from '$lib/server/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized');
  }
  
  const { messages } = await request.json() as { messages: ChatMessage[] };
  
  if (!messages || !Array.isArray(messages)) {
    throw error(400, 'Invalid messages format');
  }
  
  try {
    // Get user's financial context for better AI responses
    const userContext = await getUserFinancialContext(locals.user.id);
    
    const response = await chat(messages, userContext);
    
    return json({ message: response });
  } catch (err) {
    console.error('Chat API error:', err);
    throw error(500, 'Failed to get AI response');
  }
};

async function getUserFinancialContext(userId: string): Promise<string> {
  try {
    // Get recent transactions
    const recentTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.date))
      .limit(20);
    
    // Get spending by category
    const categorySpending = await db
      .select({
        categoryId: transactions.categoryId,
        total: sql<number>`sum(${transactions.amount})`
      })
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .groupBy(transactions.categoryId);
    
    // Get budget limits
    const userBudgets = await db
      .select()
      .from(budgets)
      .where(eq(budgets.userId, userId));
    
    // Format context
    const totalSpent = recentTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);
    
    const totalIncome = recentTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);
    
    return `
Total recent spending: ${totalSpent}
Total recent income: ${totalIncome}
Number of transactions: ${recentTransactions.length}
Categories with spending: ${categorySpending.length}
Active budgets: ${userBudgets.length}
    `.trim();
  } catch {
    return 'Financial data unavailable';
  }
}
