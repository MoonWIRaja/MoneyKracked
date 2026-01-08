import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { budgets, categories, transactions } from '$lib/server/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { GEMINI_API_KEY } from '$env/static/private';

/**
 * AI Chat endpoint for Budget Coach.
 * Connects to Gemini AI with user's financial context.
 */

interface BudgetAction {
  action: 'create' | 'update' | 'delete';
  categoryName: string;
  amount: number;
  period: 'monthly' | 'weekly' | 'yearly';
}

interface ChatResponse {
  message: string;
  budgetActions?: BudgetAction[];
}

// Get user ID from session
async function getUserId(request: Request, cookies: any): Promise<string | null> {
  // Try Better Auth session first
  const { auth } = await import('$lib/server/auth');
  const session = await auth.api.getSession({ headers: request.headers });
  if (session?.user?.id) return session.user.id;
  
  // Fallback to custom session
  const customToken = cookies.get('better-auth.session_token');
  if (customToken) {
    const { session: sessionTable } = await import('$lib/server/db/schema');
    const { gt } = await import('drizzle-orm');
    const dbSession = await db.query.session.findFirst({
      where: and(
        eq(sessionTable.token, customToken),
        gt(sessionTable.expiresAt, new Date())
      )
    });
    if (dbSession) return dbSession.userId;
  }
  return null;
}

// Get user's financial context
async function getUserContext(userId: string): Promise<string> {
  // Get current budgets
  const userBudgets = await db.query.budgets.findMany({
    where: eq(budgets.userId, userId)
  });
  
  // Get categories
  const userCategories = await db.query.categories.findMany({
    where: eq(categories.userId, userId)
  });
  
  // Get recent spending summary (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentTransactions = await db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, userId),
      eq(transactions.type, 'expense'),
      gte(transactions.date, thirtyDaysAgo)
    )
  });
  
  const totalSpent = recentTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  
  let context = `User's Financial Context:\n`;
  context += `- Currency: MYR (Malaysian Ringgit)\n`;
  context += `- Last 30 days spending: RM ${totalSpent.toFixed(2)}\n`;
  
  if (userBudgets.length > 0) {
    context += `- Existing budgets: ${userBudgets.length} categories\n`;
  } else {
    context += `- No budgets set yet\n`;
  }
  
  if (userCategories.length > 0) {
    context += `- Available categories: ${userCategories.map(c => c.name).join(', ')}\n`;
  }
  
  return context;
}

// System prompt for budget assistant
const SYSTEM_PROMPT = `You are MoneyKracked's AI Budget Coach. You help Malaysian users set up budgets.

CRITICAL: You MUST ALWAYS respond with ONLY valid JSON. No other text before or after the JSON.

When user mentions salary, income, gaji, or asks to setup/create budget, you MUST include budgetActions.

RESPONSE FORMAT (STRICT - NO EXCEPTIONS):
{
  "message": "Your friendly message explaining the budget",
  "budgetActions": [
    {"action": "create", "categoryName": "Savings", "amount": 500, "period": "monthly"},
    {"action": "create", "categoryName": "Food & Dining", "amount": 400, "period": "monthly"}
  ]
}

BUDGET RULES for Malaysian salary:
- Savings: 20% (minimum)
- Food & Dining: 15-20%
- Transportation: 10-15%
- Utilities: 5-10%
- Entertainment: 5-10%
- Housing/Rent: 25-30% (if applicable)

EXAMPLE - If user says "gaji saya RM1850":
{
  "message": "Okay! Dengan gaji RM1,850, ini cadangan budget:\\n\\n• Savings: RM370 (20%)\\n• Food: RM300 (16%)\\n• Transport: RM250 (13.5%)\\n• Utilities: RM150 (8%)\\n• Entertainment: RM100 (5.4%)\\n\\nClick Apply untuk save budget ini!",
  "budgetActions": [
    {"action": "create", "categoryName": "Savings", "amount": 370, "period": "monthly"},
    {"action": "create", "categoryName": "Food & Dining", "amount": 300, "period": "monthly"},
    {"action": "create", "categoryName": "Transportation", "amount": 250, "period": "monthly"},
    {"action": "create", "categoryName": "Utilities", "amount": 150, "period": "monthly"},
    {"action": "create", "categoryName": "Entertainment", "amount": 100, "period": "monthly"}
  ]
}

If user asks question without needing budget setup:
{
  "message": "Your answer here"
}

REMEMBER: ONLY output JSON. No markdown, no extra text.`;

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const userId = await getUserId(request, cookies);
    
    if (!userId) {
      return json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const body = await request.json();
    const userMessage = body.message;
    
    if (!userMessage || typeof userMessage !== 'string') {
      return json({ error: 'Message is required' }, { status: 400 });
    }
    
    // Get user's financial context
    const context = await getUserContext(userId);
    
    // Call Gemini API - using gemini-3-flash-preview model
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${SYSTEM_PROMPT}\n\n${context}\n\nUser: ${userMessage}` }]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json'
          }
        })
      }
    );
    
    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.text();
      console.error('Gemini API error:', errorData);
      
      // Check for rate limit error
      if (geminiResponse.status === 429) {
        // Try to parse retry delay
        let retryMessage = "API quota exceeded. Please wait about 1 minute and try again.";
        try {
          const errorJson = JSON.parse(errorData);
          const retryInfo = errorJson.error?.details?.find((d: any) => d['@type']?.includes('RetryInfo'));
          if (retryInfo?.retryDelay) {
            retryMessage = `API quota exceeded. Please wait ${retryInfo.retryDelay} and try again.`;
          }
        } catch {}
        
        return json({ 
          message: `⏳ ${retryMessage}\n\nThe free Gemini AI has usage limits. You can:\n1. Wait a minute and try again\n2. Use manual budget setup instead`,
          error: 'rate_limit'
        }, { status: 429 });
      }
      
      return json({ 
        message: "I'm having trouble connecting right now. Please try again later.",
        error: 'AI service unavailable'
      }, { status: 500 });
    }
    
    const geminiData = await geminiResponse.json();
    const aiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    console.log('Gemini raw response:', aiText);
    
    // Parse JSON response
    let response: ChatResponse;
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        response = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback if no JSON found
        response = { message: aiText };
      }
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      response = { message: aiText };
    }
    
    return json(response);
    
  } catch (err: any) {
    console.error('AI Chat error:', err);
    return json({ 
      message: "Sorry, something went wrong. Please try again.",
      error: err.message 
    }, { status: 500 });
  }
};
