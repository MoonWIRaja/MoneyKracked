/**
 * MonKrac Thinking Machine - Learning Engine
 *
 * This module handles:
 * 1. Extracting user preferences from conversations
 * 2. Generating session summaries
 * 3. Creating insights from spending patterns
 * 4. Storing important memories
 */

import { db } from '$lib/server/db';
import {
	aiChatHistory,
	aiSessionSummaries,
	aiUserProfiles,
	aiInsights,
	aiMemories,
	aiPopularQuestions,
	transactions,
	user,
	categories,
	budgets
} from '$lib/server/db/schema';
import { eq, and, gte, desc, count, sql, or } from 'drizzle-orm';
import { GEMINI_API_KEY } from '$env/static/private';

// ============================================
// TYPES
// ============================================

export interface UserProfile {
	userId: string;
	monthlyIncome?: number;
	incomeFrequency?: string;
	employmentStatus?: string;
	maritalStatus?: string;
	dependents?: number;
	primaryGoal?: string;
	riskTolerance?: string;
	savingsPreference?: number;
	spendingPersonality?: string;
	biggestExpenseCategory?: string;
	budgetAdherence?: string;
	preferredLanguage?: string;
	communicationStyle?: string;
	hasDebt?: boolean;
	debtTypes?: string[];
	confidence?: number;
}

export interface SessionSummary {
	userId: string;
	sessionId: string;
	title: string;
	summary: string;
	topics: string[];
	sentiment?: string;
	actionItems?: any[];
	messageCount: number;
	totalTokens: number;
	lastMessageAt: Date;
}

export interface Insight {
	userId: string;
	insightType: 'spending_pattern' | 'savings_opportunity' | 'budget_alert' | 'goal_progress';
	title: string;
	description: string;
	category?: string;
	impact: 'high' | 'medium' | 'low';
	actionable: boolean;
	actionSuggestion?: string;
	data?: any;
	validUntil?: Date;
}

export interface Memory {
	userId: string;
	memoryType: 'milestone' | 'struggle' | 'achievement' | 'preference';
	title: string;
	description: string;
	importance: number;
	date: Date;
	data?: any;
}

// ============================================
// CHAT STORAGE
// ============================================

/**
 * Save a chat message to history
 */
export async function saveChatMessage(params: {
	userId: string;
	sessionId: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	tokensUsed?: number;
	metadata?: any;
}) {
	const [saved] = await db
		.insert(aiChatHistory)
		.values({
			userId: params.userId,
			sessionId: params.sessionId,
			role: params.role,
			content: params.content,
			tokensUsed: params.tokensUsed,
			metadata: params.metadata || null
		})
		.returning();
	return saved;
}

/**
 * Get chat history for a session
 */
export async function getSessionChatHistory(sessionId: string) {
	return await db.query.aiChatHistory.findMany({
		where: eq(aiChatHistory.sessionId, sessionId),
		orderBy: [desc(aiChatHistory.createdAt)]
	});
}

/**
 * Get recent sessions for a user
 */
export async function getUserRecentSessions(userId: string, limit = 10) {
	const sessions = await db.execute(sql`
    SELECT DISTINCT session_id, MAX(created_at) as last_message_at, COUNT(*) as message_count
    FROM ai_chat_history
    WHERE user_id = ${userId}
    GROUP BY session_id
    ORDER BY last_message_at DESC
    LIMIT ${limit}
  `);
	return sessions.rows;
}

// ============================================
// SESSION SUMMARIES
// ============================================

/**
 * Generate a session summary using AI
 */
export async function generateSessionSummary(params: {
	userId: string;
	sessionId: string;
	messageCount: number;
	totalTokens: number;
}) {
	const messages = await getSessionChatHistory(params.sessionId);

	if (messages.length === 0) return null;

	// Build conversation transcript
	const transcript = messages
		.map((m) => `${m.role.toUpperCase()}: ${m.content}`)
		.join('\n\n');

	// Call Gemini to generate summary
	const prompt = `Analyze this conversation and extract key information in JSON format:

CONVERSATION:
${transcript}

Return ONLY valid JSON with this structure:
{
  "title": "Brief 3-5 word title",
  "summary": "2-3 sentence summary of what was discussed",
  "topics": ["topic1", "topic2"],
  "sentiment": "positive|neutral|negative|stressed",
  "actionItems": ["action1 if any"]
}

Rules:
- Title should be descriptive (e.g., "Budget Planning RM4500", "Debt Management Advice")
- Topics should be from: budget, savings, debt, spending, goals, investment, emergency
- Sentiment based on user's tone (are they stressed, happy, neutral?)
- Action items are concrete steps user agreed to take`;

	try {
		const response = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					contents: [{ role: 'user', parts: [{ text: prompt }] }],
					generationConfig: {
						temperature: 0.3,
						maxOutputTokens: 500,
						responseMimeType: 'application/json'
					}
				})
			}
		);

		if (!response.ok) {
			console.error('Summary generation failed:', await response.text());
			return createFallbackSummary(params);
		}

		const data = await response.json();
		const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

		// Better JSON extraction
		let summaryData: any = {};
		try {
			const jsonMatch = aiText.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				let cleaned = jsonMatch[0];
				cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
				summaryData = JSON.parse(cleaned);
			} else {
				summaryData = createFallbackSummary(params);
			}
		} catch (parseError) {
			console.warn('Failed to parse summary JSON, using fallback');
			summaryData = createFallbackSummary(params);
		}

		// Save summary
		const lastMessage = messages[0];
		await db.insert(aiSessionSummaries).values({
			userId: params.userId,
			sessionId: params.sessionId,
			title: summaryData.title || 'Financial Discussion',
			summary: summaryData.summary || 'Conversation about finances',
			topics: summaryData.topics || [],
			sentiment: summaryData.sentiment || 'neutral',
			actionItems: summaryData.actionItems || [],
			messageCount: params.messageCount,
			totalTokens: params.totalTokens,
			lastMessageAt: lastMessage.createdAt
		});

		return summaryData;
	} catch (error) {
		console.error('Summary generation error:', error);
		return createFallbackSummary(params);
	}
}

function createFallbackSummary(params: { userId: string; sessionId: string }) {
	return {
		title: 'Financial Discussion',
		summary: 'A conversation about personal finance and budgeting',
		topics: ['budget'],
		sentiment: 'neutral' as const,
		actionItems: []
	};
}

/**
 * Get user's conversation history summaries
 */
export async function getUserSessionSummaries(userId: string, limit = 20) {
	return await db.query.aiSessionSummaries.findMany({
		where: eq(aiSessionSummaries.userId, userId),
		orderBy: [desc(aiSessionSummaries.lastMessageAt)],
		limit
	});
}

// ============================================
// USER PROFILES (LEARNING)
// ============================================

/**
 * Extract user preferences from conversation using AI
 */
export async function extractUserPreferences(params: {
	userId: string;
	sessionId: string;
	userMessage: string;
	aiResponse: string;
}) {
	// Get existing profile
	const existingProfile = await db.query.aiUserProfiles.findFirst({
		where: eq(aiUserProfiles.userId, params.userId)
	});

	const existingContext = existingProfile
		? `\n\nEXISTING PROFILE (update if new info conflicts):\n${JSON.stringify(existingProfile, null, 2)}`
		: '';

	const prompt = `Extract user financial preferences from this conversation.

CONVERSATION:
User: ${params.userMessage}
Assistant: ${params.aiResponse}${existingContext}

Return ONLY valid JSON with fields that were mentioned or can be inferred:
{
  "monthlyIncome": number or null,
  "incomeFrequency": "monthly|weekly|bi-weekly" or null,
  "employmentStatus": "employed|self-employed|unemployed|student" or null,
  "maritalStatus": "single|married|divorced" or null,
  "dependents": number or null,
  "primaryGoal": "buy_house|emergency_fund|retirement|debt_free|other" or null,
  "riskTolerance": "conservative|moderate|aggressive" or null,
  "savingsPreference": number (10-50) or null,
  "spendingPersonality": "frugal|moderate|generous|impulsive" or null,
  "biggestExpenseCategory": "food|transport|housing|entertainment|other" or null,
  "budgetAdherence": "strict|flexible|struggles" or null,
  "preferredLanguage": "english|malay|mixed" or null,
  "communicationStyle": "formal|casual|friendly" or null,
  "hasDebt": boolean or null,
  "debtTypes": ["ptptn","car_loan","credit_card","housing"] or null,
  "confidence": number (0-100 based on how certain you are)
}

Rules:
- ONLY include fields you can reasonably infer
- Set confidence based on how explicit the information was
- For language, detect if user uses English, Malay, or mixed
- If info conflicts with existing profile, use new info and increase confidence`;

	try {
		const response = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					contents: [{ role: 'user', parts: [{ text: prompt }] }],
					generationConfig: {
						temperature: 0.2,
						maxOutputTokens: 800,
						responseMimeType: 'application/json'
					}
				})
			}
		);

		if (!response.ok) return null;

		const data = await response.json();
		const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

		// Better JSON extraction - handle malformed JSON
		let extracted: any = {};
		try {
			const jsonMatch = aiText.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				// Clean common JSON issues (unterminated strings, trailing commas)
				let cleaned = jsonMatch[0];
				// Remove markdown code blocks if present
				cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
				extracted = JSON.parse(cleaned);
			}
		} catch (parseError) {
			console.warn('Failed to parse preference extraction JSON, using empty object');
			return null;
		}

		// Filter out null values and merge with existing
		const updates: any = {};
		let hasUpdates = false;

		for (const [key, value] of Object.entries(extracted)) {
			if (value !== null && value !== undefined && key !== 'confidence') {
				updates[key] = value;
				hasUpdates = true;
			}
		}

		if (!hasUpdates) return null;

		// Calculate new confidence (weighted average)
		const existingConfidence = existingProfile?.confidence || 0;
		const newConfidence = extracted.confidence || 50;
		const mergedConfidence = existingProfile
			? Math.round((existingConfidence * 0.7 + newConfidence * 0.3))
			: newConfidence;

		if (existingProfile) {
			// Update existing
			await db
				.update(aiUserProfiles)
				.set({
					...updates,
					confidence: mergedConfidence,
					lastUpdated: new Date(),
					updatedAt: new Date()
				})
				.where(eq(aiUserProfiles.userId, params.userId));
		} else {
			// Create new
			await db.insert(aiUserProfiles).values({
				userId: params.userId,
				...updates,
				confidence: mergedConfidence
			});
		}

		return { ...updates, confidence: mergedConfidence };
	} catch (error) {
		console.error('Preference extraction error:', error);
		return null;
	}
}

/**
 * Get user's learned profile
 */
export async function getUserProfile(userId: string) {
	return await db.query.aiUserProfiles.findFirst({
		where: eq(aiUserProfiles.userId, userId)
	});
}

// ============================================
// INSIGHTS GENERATION
// ============================================

/**
 * Generate insights from user's spending patterns
 */
export async function generateSpendingInsights(userId: string) {
	// Get last 90 days of transactions
	const ninetyDaysAgo = new Date();
	ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

	const userTransactions = await db.query.transactions.findMany({
		where: and(eq(transactions.userId, userId), gte(transactions.date, ninetyDaysAgo)),
		with: { category: true }
	});

	if (userTransactions.length === 0) return [];

	const insights: Insight[] = [];
	const expenses = userTransactions.filter((t) => t.type === 'expense');

	// Calculate spending by category
	const categorySpending: Record<string, { amount: number; count: number; name: string }> = {};
	expenses.forEach((t) => {
	 const catName = t.category?.name || 'Uncategorized';
		if (!categorySpending[catName]) {
			categorySpending[catName] = { amount: 0, count: 0, name: catName };
		}
		categorySpending[catName].amount += parseFloat(t.amount);
		categorySpending[catName].count++;
	});

	// Find highest spending category
	const sortedCategories = Object.entries(categorySpending).sort(
		(a, b) => b[1].amount - a[1].amount
	);
	const topCategory = sortedCategories[0];
	const totalExpenses = expenses.reduce((sum, t) => sum + parseFloat(t.amount), 0);

	if (topCategory && totalExpenses > 0) {
		const percentage = ((topCategory[1].amount / totalExpenses) * 100).toFixed(1);

		// Alert if top category is > 40% of spending
		if (parseFloat(percentage) > 40) {
			insights.push({
				userId,
				insightType: 'spending_pattern',
				title: `High ${topCategory[0]} Spending`,
				description: `${topCategory[0]} accounts for ${percentage}% of your total spending (RM${topCategory[1].amount.toFixed(2)} in 90 days).`,
				category: topCategory[0],
				impact: 'high',
				actionable: true,
				actionSuggestion: `Consider setting a budget for ${topCategory[0]} or finding ways to reduce these expenses.`,
				data: {
					amount: topCategory[1].amount,
					percentage: parseFloat(percentage),
					transactionCount: topCategory[1].count
				}
			});
		}
	}

	// Check for frequent small expenses (potential "latte factor")
	const smallExpenses = expenses.filter((t) => parseFloat(t.amount) < 50);
	if (smallExpenses.length > 20) {
		const smallTotal = smallExpenses.reduce((sum, t) => sum + parseFloat(t.amount), 0);
		insights.push({
			userId,
			insightType: 'savings_opportunity',
			title: 'Frequent Small Purchases',
			description: `You made ${smallExpenses.length} small purchases under RM50 in the last 90 days, totaling RM${smallTotal.toFixed(2)}.`,
			impact: 'medium',
			actionable: true,
			actionSuggestion: 'Small daily expenses add up. Consider tracking these to see where you can cut back.',
			data: {
				count: smallExpenses.length,
				total: smallTotal,
				average: smallTotal / smallExpenses.length
			}
		});
	}

	// Save insights to database
	for (const insight of insights) {
		await db.insert(aiInsights).values({
			userId: insight.userId,
			insightType: insight.insightType,
			title: insight.title,
			description: insight.description,
			category: insight.category,
			impact: insight.impact,
			actionable: insight.actionable,
			actionSuggestion: insight.actionSuggestion,
			data: insight.data || null,
			validUntil: insight.validUntil ? insight.validUntil : null
		});
	}

	return insights;
}

/**
 * Get user's active insights
 */
export async function getUserInsights(userId: string, includeDismissed = false) {
	const conditions = includeDismissed
		? eq(aiInsights.userId, userId)
		: and(eq(aiInsights.userId, userId), eq(aiInsights.dismissed, false));

	return await db.query.aiInsights.findMany({
		where: conditions,
		orderBy: [desc(aiInsights.createdAt)]
	});
}

/**
 * Acknowledge an insight
 */
export async function acknowledgeInsight(insightId: string) {
	await db
		.update(aiInsights)
		.set({ acknowledged: true })
		.where(eq(aiInsights.id, insightId));
}

/**
 * Dismiss an insight
 */
export async function dismissInsight(insightId: string) {
	await db
		.update(aiInsights)
		.set({ dismissed: true })
		.where(eq(aiInsights.id, insightId));
}

// ============================================
// MEMORIES
// ============================================

/**
 * Store an important memory about the user
 */
export async function saveMemory(memory: Memory) {
	await db.insert(aiMemories).values({
		userId: memory.userId,
		memoryType: memory.memoryType,
		title: memory.title,
		description: memory.description,
		importance: memory.importance,
		date: memory.date,
		data: memory.data || null
	});
}

/**
 * Get user's memories
 */
export async function getUserMemories(userId: string, type?: string) {
	const conditions = type
		? and(eq(aiMemories.userId, userId), eq(aiMemories.memoryType, type))
		: eq(aiMemories.userId, userId);

	return await db.query.aiMemories.findMany({
		where: conditions,
		orderBy: [desc(aiMemories.importance), desc(aiMemories.createdAt)]
	});
}

/**
 * Extract and save memories from conversation
 */
export async function extractMemories(params: {
	userId: string;
	sessionId: string;
	conversation: string;
}) {
	const prompt = `Extract important memories from this financial conversation.

CONVERSATION:
${params.conversation}

Return ONLY valid JSON array of memories:
[
  {
    "memoryType": "milestone|struggle|achievement|preference",
    "title": "Short title",
    "description": "Detailed description",
    "importance": 1-10,
    "date": "YYYY-MM-DD" (if mentioned, otherwise today)
  }
]

Memory types:
- milestone: Important life events (job change, marriage, new house, etc.)
- struggle: Financial difficulties mentioned
- achievement: Financial wins (paid off debt, reached savings goal, etc.)
- preference: Strong preferences expressed about money management

Only extract truly important information worth remembering long-term.`;

	try {
		const response = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					contents: [{ role: 'user', parts: [{ text: prompt }] }],
					generationConfig: {
						temperature: 0.2,
						maxOutputTokens: 500,
						responseMimeType: 'application/json'
					}
				})
			}
		);

		if (!response.ok) return [];

		const data = await response.json();
		const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

		// Better JSON extraction - handle malformed JSON
		let memories: any[] = [];
		try {
			const arrayMatch = aiText.match(/\[[\s\S]*\]/);
			if (arrayMatch) {
				// Remove markdown code blocks if present
				let cleaned = arrayMatch[0];
				cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
				memories = JSON.parse(cleaned);
			}
		} catch (parseError) {
			console.warn('Failed to parse memory extraction JSON, using empty array');
			return [];
		}

		for (const memory of memories) {
			if (memory.title && memory.description) {
				await saveMemory({
					userId: params.userId,
					memoryType: memory.memoryType || 'preference',
					title: memory.title,
					description: memory.description,
					importance: memory.importance || 5,
					date: memory.date ? new Date(memory.date) : new Date()
				});
			}
		}

		return memories;
	} catch (error) {
		console.error('Memory extraction error:', error);
		return [];
	}
}

// ============================================
// CONTEXT BUILDER FOR AI CHAT
// ============================================

/**
 * Build full context for AI chat including learned profile and memories
 */
export async function buildAIContext(userId: string): Promise<string> {
	const [profile, memories, recentSessions] = await Promise.all([
		getUserProfile(userId),
		getUserMemories(userId, 'milestone'),
		getUserSessionSummaries(userId, 5)
	]);

	let context = '';

	// Add learned profile
	if (profile && profile.confidence && profile.confidence > 30) {
		context += '\n=== WHAT I KNOW ABOUT YOU ===\n';
		if (profile.monthlyIncome) context += `- Monthly Income: RM${profile.monthlyIncome}\n`;
		if (profile.employmentStatus) context += `- Employment: ${profile.employmentStatus}\n`;
		if (profile.maritalStatus) context += `- Marital Status: ${profile.maritalStatus}\n`;
		if (profile.dependents) context += `- Dependents: ${profile.dependents}\n`;
		if (profile.primaryGoal) context += `- Primary Goal: ${profile.primaryGoal}\n`;
		if (profile.spendingPersonality) context += `- Spending Style: ${profile.spendingPersonality}\n`;
		if (profile.preferredLanguage) context += `- Language: ${profile.preferredLanguage}\n`;
		if (profile.hasDebt) context += `- Has Debt: Yes (${profile.debtTypes?.join(', ') || 'various'})\n`;
		context += `- Confidence: ${profile.confidence}%\n`;
	}

	// Add important memories
	if (memories.length > 0) {
		context += '\n=== IMPORTANT THINGS TO REMEMBER ===\n';
		memories.slice(0, 5).forEach((m) => {
			context += `- ${m.title}: ${m.description}\n`;
		});
	}

	// Add recent conversation topics
	if (recentSessions.length > 0) {
		context += '\n=== RECENT CONVERSATIONS ===\n';
		recentSessions.slice(0, 3).forEach((s) => {
			context += `- ${s.title}: ${s.summary}\n`;
		});
	}

	return context;
}

// ============================================
// POPULAR QUESTIONS & SMART SUGGESTIONS
// ============================================

/**
 * Simple hash function for question deduplication
 */
function hashQuestion(question: string): string {
	// Simple hash: lowercase, trim, remove extra spaces
	return question
		.toLowerCase()
		.trim()
		.replace(/\s+/g, ' ')
		.replace(/[^\w\s]/g, '');
}

/**
 * Categorize a question using AI
 */
async function categorizeQuestion(question: string): Promise<string> {
	const lowerQ = question.toLowerCase();

	// Quick keyword-based categorization
	if (lowerQ.includes('budget') || lowerQ.includes('gaji') || lowerQ.includes('income')) {
		return 'budget';
	}
	if (lowerQ.includes('save') || lowerQ.includes('saving') || lowerQ.includes('tabung')) {
		return 'savings';
	}
	if (lowerQ.includes('debt') || lowerQ.includes('loan') || lowerQ.includes('ptptn') || lowerQ.includes('hutang')) {
		return 'debt';
	}
	if (lowerQ.includes('invest') || lowerQ.includes('stock') || lowerQ.includes('saham')) {
		return 'investment';
	}
	if (lowerQ.includes('spent') || lowerQ.includes('expense') || lowerQ.includes('belanja')) {
		return 'spending';
	}
	if (lowerQ.includes('goal') || lowerQ.includes('target')) {
		return 'goals';
	}

	return 'general';
}

/**
 * Summarize a long question into a short, concise version using AI
 * This keeps trending questions short and readable
 */
async function summarizeQuestion(question: string): Promise<string> {
	// If question is already short enough (under 60 chars), use as-is
	if (question.length <= 60) return question;

	try {
		const response = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					contents: [{
						role: 'user',
						parts: [{ text: `Shorten this question to max 50 characters. Keep it natural and conversational. Return ONLY the shortened question, no quotes, no explanation.

Question: "${question}"

Shortened (max 50 chars):` }]
					}],
					generationConfig: {
						temperature: 0.3,
						maxOutputTokens: 100
					}
				})
			}
		);

		if (response.ok) {
			const data = await response.json();
			const summarized = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || question;
			// Remove quotes if AI added them
			return summarized.replace(/^["']|["']$/g, '').substring(0, 60);
		}
	} catch (error) {
		console.warn('Question summarization failed, using original');
	}

	// Fallback: simple truncation
	return question.substring(0, 57) + '...';
}

/**
 * Track a user question for popularity ranking
 * Called after user sends a message
 * Uses upsert to handle both new questions and updates atomically
 */
export async function trackUserQuestion(question: string) {
	const trimmedQuestion = question.trim();
	if (trimmedQuestion.length < 5 || trimmedQuestion.length > 200) return;

	// Summarize long questions for display
	const displayQuestion = await summarizeQuestion(trimmedQuestion);
	const questionHash = hashQuestion(trimmedQuestion);
	const category = await categorizeQuestion(trimmedQuestion);

	try {
		// Use upsert (insert with on conflict do update)
		// This handles both new questions and existing ones atomically
		await db.insert(aiPopularQuestions).values({
			question: displayQuestion,
			questionHash,
			category,
			askCount: 1,
			lastAskedAt: new Date()
		}).onConflictDoUpdate({
			target: aiPopularQuestions.questionHash,
			set: {
				askCount: sql`${aiPopularQuestions.askCount} + 1`,
				lastAskedAt: new Date(),
				updatedAt: new Date(),
				// Update question text if new version is shorter
				question: displayQuestion
			}
		});
	} catch (error) {
		// If there's still a conflict (e.g., same question text but different hash),
		// fall back to manual check and update
		try {
			const existing = await db.query.aiPopularQuestions.findFirst({
				where: eq(aiPopularQuestions.questionHash, questionHash)
			});

			if (existing) {
				await db
					.update(aiPopularQuestions)
					.set({
						askCount: existing.askCount + 1,
						lastAskedAt: new Date(),
						updatedAt: new Date(),
						question: displayQuestion.length < existing.question.length ? displayQuestion : existing.question
					})
					.where(eq(aiPopularQuestions.id, existing.id));
			}
		} catch (fallbackError) {
			console.error('Track question error:', fallbackError);
		}
	}
}

/**
 * Get smart suggestions based on popular questions
 * Can be filtered by user profile for personalized suggestions
 */
export async function getSmartSuggestions(userProfile?: UserProfile | null, limit = 6): Promise<string[]> {
	try {
		// Base query: get suggested questions, sorted by popularity
		const popularQuestions = await db.query.aiPopularQuestions.findMany({
			where: eq(aiPopularQuestions.suggested, true),
			orderBy: [desc(aiPopularQuestions.askCount), desc(aiPopularQuestions.lastAskedAt)],
			limit: limit * 2 // Get more than needed, will filter
		});

		// If no popular questions yet, return defaults
		if (popularQuestions.length === 0) {
			return getDefaultSuggestions();
		}

		// Score and rank questions based on user profile
		const scoredQuestions = popularQuestions.map((pq) => {
			let score = pq.askCount; // Base score from popularity

			// Boost score if question matches user profile
			if (userProfile) {
				const qLower = pq.question.toLowerCase();

				// Income-related questions boost for users with known income
				if (qLower.includes('gaji') || qLower.includes('salary') || qLower.includes('income')) {
					if (!userProfile.monthlyIncome) score += 10; // User hasn't shared income yet
				}

				// Savings goals boost
				if (qLower.includes('save') || qLower.includes('tabung')) {
					if (userProfile.primaryGoal === 'emergency_fund' || userProfile.primaryGoal === 'buy_house') {
						score += 5;
					}
				}

				// Debt-related boost
				if (qLower.includes('debt') || qLower.includes('hutang') || qLower.includes('ptptn')) {
					if (userProfile.hasDebt) score += 8;
				}

				// Investment boost for higher income or savings goals
				if (qLower.includes('invest') || qLower.includes('saham')) {
					const income = userProfile.monthlyIncome ? parseFloat(userProfile.monthlyIncome) : 0;
					if (income > 5000) score += 5;
				}

				// Recent boost (questions asked recently get a small boost)
				const daysSinceAsked = Math.floor(
					(Date.now() - new Date(pq.lastAskedAt).getTime()) / (1000 * 60 * 60 * 24)
				);
				if (daysSinceAsked < 7) score += 3;
			}

			return { question: pq.question, score };
		});

		// Sort by score and return top N
		scoredQuestions.sort((a, b) => b.score - a.score);
		return scoredQuestions.slice(0, limit).map((sq) => sq.question);
	} catch (error) {
		console.error('Get suggestions error:', error);
		return getDefaultSuggestions();
	}
}

/**
 * Get default suggestions when no data available
 */
function getDefaultSuggestions(): string[] {
	return [
		'Setup my budget, salary RM4500',
		'Analyze my spending',
		'Help me save 20% of my income',
		'Tips to reduce my expenses',
		'How to build emergency fund',
		'Manage my debt wisely'
	];
}

/**
 * Mark a question as helpful (upvote)
 */
export async function markQuestionHelpful(question: string) {
	const questionHash = hashQuestion(question);
	try {
		const existing = await db.query.aiPopularQuestions.findFirst({
			where: eq(aiPopularQuestions.questionHash, questionHash)
		});

		if (existing) {
			await db
				.update(aiPopularQuestions)
				.set({ helpfulScore: existing.helpfulScore + 1 })
				.where(eq(aiPopularQuestions.id, existing.id));
		}
	} catch (error) {
		console.error('Mark helpful error:', error);
	}
}

/**
 * Get trending questions (asked frequently in recent times)
 */
export async function getTrendingQuestions(limit = 10): Promise<
	Array<{ question: string; category: string; askCount: number; helpfulScore: number }>
> {
	const sevenDaysAgo = new Date();
	sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

	try {
		const trending = await db.query.aiPopularQuestions.findMany({
			where: and(
				eq(aiPopularQuestions.suggested, true),
				gte(aiPopularQuestions.lastAskedAt, sevenDaysAgo)
			),
			orderBy: [desc(aiPopularQuestions.askCount), desc(aiPopularQuestions.helpfulScore)],
			limit
		});

		return trending.map((t) => ({
			question: t.question,
			category: t.category,
			askCount: t.askCount,
			helpfulScore: t.helpfulScore
		}));
	} catch (error) {
		console.error('Get trending error:', error);
		return [];
	}
}
