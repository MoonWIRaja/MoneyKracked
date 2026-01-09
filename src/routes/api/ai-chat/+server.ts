import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { budgets, categories, transactions, user, goals, financialAccounts } from '$lib/server/db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import { GEMINI_API_KEY } from '$env/static/private';
import * as AI from '$lib/server/ai/learning-engine';

/**
 * AI Chat endpoint for MonKrac - Expert Financial Coach with Thinking Machine.
 * Now with memory, learning, and insights!
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
	sessionId?: string;
	learnedProfile?: any;
}

// Get user ID and name from session
async function getUserInfo(request: Request, cookies: any): Promise<{ id: string | null, name: string | null }> {
	// Try Better Auth session first
	const { auth } = await import('$lib/server/auth');
	const session = await auth.api.getSession({ headers: request.headers });
	if (session?.user?.id) {
		return { id: session.user.id, name: session.user.name || null };
	}

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
		if (dbSession) {
			// Get user name from database
			const userInfo = await db.query.user.findFirst({
				where: eq(user.id, dbSession.userId)
			});
			return { id: dbSession.userId, name: userInfo?.name || null };
		}
	}
	return { id: null, name: null };
}

// Get user's full financial context
async function getUserContext(userId: string): Promise<string> {
	// Get all transactions (last 90 days for detailed analysis)
	const ninetyDaysAgo = new Date();
	ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

	const allTransactions = await db.query.transactions.findMany({
		where: and(
			eq(transactions.userId, userId),
			gte(transactions.date, ninetyDaysAgo)
		),
		orderBy: [desc(transactions.date)],
		limit: 100
	});

	// Get current budgets
	const userBudgets = await db.query.budgets.findMany({
		where: eq(budgets.userId, userId),
		with: {
			category: true
		}
	});

	// Get categories
	const userCategories = await db.query.categories.findMany({
		where: eq(categories.userId, userId)
	});

	// Get goals
	const userGoals = await db.query.goals.findMany({
		where: eq(goals.userId, userId)
	});

	// Get financial accounts
	const userAccounts = await db.query.financialAccounts.findMany({
		where: eq(financialAccounts.userId, userId)
	});

	// Calculate spending by category
	const spendingByCategory: Record<string, number> = {};
	const incomeTotal = allTransactions
		.filter(t => t.type === 'income')
		.reduce((sum, t) => sum + parseFloat(t.amount), 0);

	const expenseTotal = allTransactions
		.filter(t => t.type === 'expense')
		.reduce((sum, t) => sum + parseFloat(t.amount), 0);

	allTransactions
		.filter(t => t.type === 'expense')
		.forEach(t => {
			const catId = t.categoryId || 'uncategorized';
			spendingByCategory[catId] = (spendingByCategory[catId] || 0) + parseFloat(t.amount);
		});

	// Type-safe helper to get category spending
	const getCategorySpending = (categoryId: string | null) => {
		if (!categoryId) return 0;
		return spendingByCategory[categoryId] || 0;
	};

	// Format transaction details - use YYYY-MM-DD format for clarity
	const formatDate = (date: Date | null) => {
		if (!date) return 'Unknown date';
		const d = new Date(date);
		// Add timezone offset to get correct local date
		const offset = d.getTimezoneOffset() * 60000;
		const localDate = new Date(d.getTime() - offset);
		return localDate.toISOString().split('T')[0]; // YYYY-MM-DD format
	};

	const recentExpenses = allTransactions
		.filter(t => t.type === 'expense')
		.slice(0, 20)
		.map(t => {
			const cat = userCategories.find(c => c.id === t.categoryId);
			const desc = t.payee || t.notes || 'No description';
			const dateStr = formatDate(t.date);
			return `- ${desc}: RM${parseFloat(t.amount).toFixed(2)} (${cat?.name || 'Uncategorized'}) on ${dateStr}`;
		});

	const recentIncome = allTransactions
		.filter(t => t.type === 'income')
		.slice(0, 10)
		.map(t => {
			const desc = t.payee || t.notes || 'No description';
			const dateStr = formatDate(t.date);
			return `- ${desc}: RM${parseFloat(t.amount).toFixed(2)} on ${dateStr}`;
		});

	// Build comprehensive context
	let context = `=== USER'S COMPLETE FINANCIAL PROFILE ===\n\n`;

	// Summary
	context += `📊 FINANCIAL SUMMARY (Last 90 Days):\n`;
	context += `- Total Income: RM ${incomeTotal.toFixed(2)}\n`;
	context += `- Total Expenses: RM ${expenseTotal.toFixed(2)}\n`;
	context += `- Net Savings: RM ${(incomeTotal - expenseTotal).toFixed(2)}\n`;
	context += `- Average Monthly Spending: RM ${(expenseTotal / 3).toFixed(2)}\n\n`;

	// Budgets
	context += `💰 CURRENT BUDGETS:\n`;
	if (userBudgets.length > 0) {
		userBudgets.forEach(b => {
			const spent = getCategorySpending(b.categoryId);
			const limit = parseFloat(b.limitAmount);
			const percentage = limit > 0 ? ((spent / limit) * 100).toFixed(1) : '0';
			context += `- ${b.category?.name || 'Unknown'}: RM${spent.toFixed(2)} / RM${limit.toFixed(2)} (${percentage}%)\n`;
		});
	} else {
		context += `- No budgets set up yet\n`;
	}
	context += `\n`;

	// Goals
	context += `🎯 SAVINGS GOALS:\n`;
	if (userGoals.length > 0) {
		userGoals.forEach(g => {
			const current = parseFloat(g.currentAmount);
			const target = parseFloat(g.targetAmount);
			const percentage = target > 0 ? ((current / target) * 100).toFixed(1) : '0';
			context += `- ${g.name}: RM${current.toFixed(2)} / RM${target.toFixed(2)} (${percentage}%)`;
			if (g.deadline) context += ` - Deadline: ${g.deadline}`;
			context += `\n`;
		});
	} else {
		context += `- No goals set up yet\n`;
	}
	context += `\n`;

	// Accounts
	context += `🏦 FINANCIAL ACCOUNTS:\n`;
	if (userAccounts.length > 0) {
		userAccounts.forEach(a => {
			const balance = parseFloat(a.balance);
			context += `- ${a.name} (${a.type}): RM${balance.toFixed(2)}\n`;
		});
	} else {
		context += `- No accounts linked yet\n`;
	}
	context += `\n`;

	// Recent transactions for analysis
	context += `📝 RECENT EXPENSES (Last 20):\n`;
	if (recentExpenses.length > 0) {
		context += recentExpenses.join('\n') + `\n`;
	} else {
		context += `- No expense records yet\n`;
	}
	context += `\n`;

	context += `💵 RECENT INCOME (Last 10):\n`;
	if (recentIncome.length > 0) {
		context += recentIncome.join('\n') + `\n`;
	} else {
		context += `- No income records yet\n`;
	}
	context += `\n`;

	// Available categories
	context += `📁 AVAILABLE CATEGORIES:\n`;
	if (userCategories.length > 0) {
		userCategories.forEach(c => {
			context += `- ${c.name} (${c.type})\n`;
		});
	} else {
		context += `- No custom categories (will use defaults)\n`;
	}

	return context;
}

// System prompt for MonKrac - Expert Financial Coach with Memory
function getSystemPrompt(userName: string | null, learnedContext: string): string {
	const greeting = userName ? `Hi ${userName}!` : 'Hello!';
	const nameOrFriend = userName ? userName : 'friend';

	return `You are MonKrac, MoneyKracked's EXPERT Financial Coach and Budget Advisor. You are a professional financial planner specializing in Malaysian personal finance.

YOU HAVE A MEMORY AND LEARNING CAPABILITY - You remember past conversations and have learned about this user!

${learnedContext}

YOUR IDENTITY:
- Name: MonKrac
- Role: Expert Financial Coach & Budget Advisor
- Specialization: Malaysian personal finance, budgeting, savings, and debt management
- Tone: Professional yet friendly, encouraging, and practical
- Language: Fluent in English and Malay (Bahasa Melayu) - respond in the language the user uses

MEMORY & LEARNING:
- You remember what the user told you in previous conversations
- Reference their goals, preferences, and past discussions when relevant
- Build on previous advice - don't start from scratch each time
- Acknowledge their progress and struggles

YOUR EXPERTISE:
1. **Budget Planning**: Create personalized budgets based on income, spending patterns, and financial goals
2. **Spending Analysis**: Analyze transaction history to identify spending patterns and areas for improvement
3. **Savings Strategies**: Recommend smart saving strategies and help build emergency funds
4. **Debt Management**: Provide advice on managing loans, credit cards, and other debts
5. **Financial Goals**: Help users achieve their financial goals with actionable steps

MALAYSIAN BUDGET RULES (50/30/20 Rule):
- **Needs (50%)**: Food, transportation, utilities, rent/mortgage, insurance
- **Wants (30%)**: Entertainment, dining out, hobbies, shopping
- **Savings (20%)**: Emergency fund, investments, debt repayment
- Minimum savings should be 20% of income
- Emergency fund: 3-6 months of expenses

COMMON MALAYSIAN EXPENSE CATEGORIES:
- Food & Dining (Makan & Minuman)
- Transportation (Pengangkutan) - petrol, toll, parking, public transport
- Utilities (Utiliti) - electricity, water, internet, phone
- Housing/Rent (Rumah/Sewa)
- Entertainment (Hiburan)
- Shopping (Membeli-belah)
- Healthcare (Kesihatan)
- Insurance (Insurans)
- Loan Repayments (Bayaran Pinjaman) - car, personal, PTPTN
- Education (Pendidikan)

IMPORTANT - DATE & TIMEZONE:
- All transaction dates are in YYYY-MM-DD format (e.g., "2026-02-15")
- User's local timezone is used for dates
- When user mentions "bulan 2 2026" or "February 2026", they mean the specific month only
- When user mentions "tahun 2026", they mean ONLY year 2026, not other years
- Budget period "monthly" means recurring every month, NOT all-time total
- Always clarify what time period the budget is for if user specifies a month/year

CRITICAL RESPONSE FORMAT:
You MUST ALWAYS respond with ONLY valid JSON. No other text before or after the JSON.

RESPONSE FORMAT:
{
  "message": "Your friendly, personalized message to ${nameOrFriend}",
  "budgetActions": [...] // Only include when creating/updating budgets
}

EXAMPLES OF WARM, PERSONALIZED GREETING:
- "Eh ${greeting}! Welcome back! Last time kita discussed about budgeting, how's it going?"
- "${greeting}! I remember you're saving for a house. Let's continue working on that plan!"

WHEN TO INCLUDE budgetActions:
- User mentions salary/gaji/income (e.g., "gaji saya RM3000")
- User asks to setup/create/make budget
- User wants help with budgeting
- User asks for savings plan

WHEN TO NOT INCLUDE budgetActions:
- General questions about finance
- Explanations about budgeting
- Advice without specific numbers

BUDGET ACTION FORMAT:
"budgetActions": [
  {"action": "create", "categoryName": "Savings", "amount": 600, "period": "monthly"},
  {"action": "create", "categoryName": "Food & Dining", "amount": 450, "period": "monthly"}
]

CRITICAL BUDGET RULES:
- "period": "monthly" means the budget repeats EVERY MONTH as a limit
- The "amount" is the MONTHLY LIMIT, not a total for all time
- When user asks for "bulan 2 2026 budget", create a MONTHLY budget plan that applies to that month
- Do NOT multiply amounts by 12 or calculate yearly totals unless specifically asked
- If user specifies a month (e.g., "February 2026"), acknowledge it in your message but keep period as "monthly"

EXAMPLE - User says "gaji saya RM2500":
{
  "message": "${greeting} dengan gaji RM2,500, MonKrac cadangkan budget macam ni:\\n\\n💰 **Savings (20%)**: RM500\\n🍽️ **Food & Dining (20%)**: RM500\\n🚗 **Transport (15%)**: RM375\\n💡 **Utilities (10%)**: RM250\\n🏠 **Rent/Housing (25%)**: RM625\\n🎉 **Entertainment (10%)**: RM250\\n\\nTotal: RM2,500\\n\\nBudget ni ikut 50/30/20 rule. Klik Apply kalau setuju!",
  "budgetActions": [
    {"action": "create", "categoryName": "Savings", "amount": 500, "period": "monthly"},
    {"action": "create", "categoryName": "Food & Dining", "amount": 500, "period": "monthly"},
    {"action": "create", "categoryName": "Transportation", "amount": 375, "period": "monthly"},
    {"action": "create", "categoryName": "Utilities", "amount": 250, "period": "monthly"},
    {"action": "create", "categoryName": "Housing", "amount": 625, "period": "monthly"},
    {"action": "create", "categoryName": "Entertainment", "amount": 250, "period": "monthly"}
  ]
}

EXAMPLE - User says "setup budget bulan 2 tahun 2026 gaji RM3000":
{
  "message": "${greeting} untuk bulan Februari 2026 dengan gaji RM3,000, MonKrac cadangkan budget bulanan macam ni:\\n\\n💰 **Savings (20%)**: RM600\\n🍽️ **Food & Dining (20%)**: RM600\\n🚗 **Transport (15%)**: RM450\\n💡 **Utilities (10%)**: RM300\\n🏠 **Rent/Housing (25%)**: RM750\\n🎉 **Entertainment (10%)**: RM300\\n\\nTotal: RM3,000 sebulan\\n\\nBudget ni untuk bulan Februari 2026. Budget berulang setiap bulan. Klik Apply kalau setuju!",
  "budgetActions": [
    {"action": "create", "categoryName": "Savings", "amount": 600, "period": "monthly"},
    {"action": "create", "categoryName": "Food & Dining", "amount": 600, "period": "monthly"},
    {"action": "create", "categoryName": "Transportation", "amount": 450, "period": "monthly"},
    {"action": "create", "categoryName": "Utilities", "amount": 300, "period": "monthly"},
    {"action": "create", "categoryName": "Housing", "amount": 750, "period": "monthly"},
    {"action": "create", "categoryName": "Entertainment", "amount": 300, "period": "monthly"}
  ]
}

IMPORTANT NOTES:
- Call user by their name (${nameOrFriend}) in responses
- Use emojis to make messages friendly and engaging
- Mix English and Malay naturally like Malaysians do
- Be encouraging and supportive
- Give practical, actionable advice
- Reference past conversations when relevant
- Remember: ONLY output JSON. No markdown code blocks, no extra text.`;
}

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const { id: userId, name: userName } = await getUserInfo(request, cookies);

    if (!userId) {
      return json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const userMessage = body.message;
    const sessionId = body.sessionId || crypto.randomUUID();

    if (!userMessage || typeof userMessage !== 'string') {
      return json({ error: 'Message is required' }, { status: 400 });
    }

    // === MONKRAC THINKING MACHINE: MEMORY & LEARNING ===

    // 1. Track user question for popularity ranking (smart suggestions)
    AI.trackUserQuestion(userMessage).catch(err => console.error('Track question error:', err));

    // 2. Save user message to chat history
    await AI.saveChatMessage({
      userId,
      sessionId,
      role: 'user',
      content: userMessage
    });

    // 2. Get learned context about this user
    const learnedContext = await AI.buildAIContext(userId);

    // 3. Get user's current financial data
    const financialContext = await getUserContext(userId);

    // 4. Get personalized system prompt with memory
    const systemPrompt = getSystemPrompt(userName, learnedContext);

    // 5. Call Gemini API
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
              parts: [{ text: `${systemPrompt}\n\n${financialContext}\n\nUser Message: ${userMessage}` }]
            }
          ],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 8192,
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
          error: 'rate_limit',
          sessionId
        }, { status: 429 });
      }

      return json({
        message: "I'm having trouble connecting right now. Please try again later.",
        error: 'AI service unavailable',
        sessionId
      }, { status: 500 });
    }

    const geminiData = await geminiResponse.json();
    const aiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log('Gemini raw response length:', aiText.length);
    console.log('Gemini raw response:', aiText.substring(0, 500) + (aiText.length > 500 ? '...' : ''));

    // Check if response was truncated (ends abruptly without closing brace)
    const isTruncated = aiText.length > 0 && !aiText.trim().endsWith('}') && !aiText.trim().endsWith(']');
    if (isTruncated) {
      console.warn('⚠️ AI response appears truncated! Raw end:', aiText.slice(-200));
    }

    // Check for finish reason - if not STOP, response might be incomplete
    const finishReason = geminiData.candidates?.[0]?.finishReason;
    console.log('Finish reason:', finishReason);
    if (finishReason && finishReason !== 'STOP') {
      console.warn('⚠️ AI response did not complete normally. Finish reason:', finishReason);
    }

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
      console.error('Response text that failed to parse:', aiText);
      response = { message: aiText || "I apologize, but I couldn't generate a proper response. Please try again." };
    }

    // === MONKRAC THINKING MACHINE: LEARN & REMEMBER ===

    // 6. Save AI response to chat history
    await AI.saveChatMessage({
      userId,
      sessionId,
      role: 'assistant',
      content: response.message,
      metadata: { budgetActions: response.budgetActions }
    });

    // 7. Extract and save user preferences (learning)
    const learned = await AI.extractUserPreferences({
      userId,
      sessionId,
      userMessage,
      aiResponse: response.message
    });

    // 8. Extract memories (important events)
    const conversation = `User: ${userMessage}\nAssistant: ${response.message}`;
    await AI.extractMemories({ userId, sessionId, conversation });

    // 9. Include sessionId in response for continuity
    response.sessionId = sessionId;

    // 10. Include learned profile if new info was extracted
    if (learned) {
      response.learnedProfile = learned;
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

// GET endpoint to retrieve chat history and memories
export const GET: RequestHandler = async ({ request, cookies, url }) => {
  try {
    const { id: userId } = await getUserInfo(request, cookies);

    if (!userId) {
      return json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get what user requested
    const type = url.searchParams.get('type') || 'all';

    const result: any = {};

    if (type === 'all' || type === 'profile') {
      result.profile = await AI.getUserProfile(userId);
    }

    if (type === 'all' || type === 'memories') {
      result.memories = await AI.getUserMemories(userId);
    }

    if (type === 'all' || type === 'insights') {
      result.insights = await AI.getUserInsights(userId, false);
    }

    if (type === 'all' || type === 'history') {
      result.recentSessions = await AI.getUserRecentSessions(userId, 10);
    }

    // Add smart suggestions for any request
    if (type === 'all' || type === 'suggestions') {
      const profile = result.profile || await AI.getUserProfile(userId);
      result.suggestions = await AI.getSmartSuggestions(profile, 6);
    }

    return json(result);

  } catch (err: any) {
    console.error('AI Chat GET error:', err);
    return json({ error: err.message }, { status: 500 });
  }
};
