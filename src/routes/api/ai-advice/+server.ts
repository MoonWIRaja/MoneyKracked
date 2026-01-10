import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GEMINI_API_KEY, ZAI_API_KEY, AI_PROVIDER } from '$env/static/private';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const { type, data } = await request.json() as { type: string; data: unknown };

	if (type === 'overspent-analysis') {
		return handleOverspentAnalysis(data);
	}

	throw error(400, 'Invalid advice type');
};

async function handleOverspentAnalysis(data: unknown) {
	const overspentData = data as Array<{
		category: string;
		budget: string;
		spent: string;
		over: string;
	}>;

	if (!overspentData || overspentData.length === 0) {
		return json({
			success: false,
			error: 'No overspent categories provided'
		});
	}

	// Build the overspent summary for AI
	const overspentSummary = overspentData
		.map((item) => `- ${item.category}: Budget ${item.budget}, Spent ${item.spent}, Over by ${item.over}`)
		.join('\n');

	const prompt = `You are a friendly financial AI coach. Analyze these overspent categories and provide actionable, brief advice:

${overspentSummary}

Provide your response in this format:
📊 **Overspend Analysis**
[Brief summary of the situation]

💡 **Quick Tips**
1. [Specific tip for category 1]
2. [Specific tip for category 2]
etc.

🎯 **Action Items**
• [One specific action item]
• [Another action item]

Keep it concise, encouraging, and practical. Use emojis but don't overdo it. Maximum 3-4 sentences per section.`;

	try {
		// Determine which AI provider to use (same logic as ai-chat)
		let useZai = false;

		if (AI_PROVIDER === 'zai' && ZAI_API_KEY) {
			useZai = true;
		} else if (AI_PROVIDER === 'gemini' && GEMINI_API_KEY) {
			useZai = false;
		} else {
			// Fallback: use whatever key is available
			useZai = !GEMINI_API_KEY && !!ZAI_API_KEY;
		}

		let advice = '';

		if (useZai) {
			// Use Z.ai API
			const response = await fetch('https://api.z.ai/api/coding/paas/v4/chat/completions', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${ZAI_API_KEY}`
				},
				body: JSON.stringify({
					model: 'glm-4.7',
					messages: [{ role: 'user', content: prompt }],
					temperature: 0.8,
					max_tokens: 2048
				})
			});

			if (response.ok) {
				const zaiData = await response.json();
				advice = zaiData.choices?.[0]?.message?.content || '';
			} else {
				throw new Error('Z.ai API error');
			}
		} else {
			// Use Gemini API
			if (!GEMINI_API_KEY) {
				throw new Error('No AI API key available');
			}

			const response = await fetch(
				`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						contents: [{ role: 'user', parts: [{ text: prompt }] }],
						generationConfig: {
							temperature: 0.8,
							maxOutputTokens: 2048
						}
					})
				}
			);

			if (response.ok) {
				const geminiData = await response.json();
				advice = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
			} else {
				throw new Error('Gemini API error');
			}
		}

		return json({
			success: true,
			advice: advice.trim()
		});
	} catch (err) {
		console.error('AI Advice error:', err);
		return json({
			success: false,
			error: 'Failed to generate advice'
		});
	}
}
