import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY } from '$env/static/private';

// Budget Coach System Prompt
const COACH_SYSTEM_PROMPT = `You are a proactive, empathetic, but financially conservative Budget Coach named "MoneyKracked AI".

Your goal is to help users:
- Increase their savings rate
- Reduce unnecessary spending
- Make better financial decisions
- Understand their spending patterns

Guidelines:
- Be concise and actionable
- Use emojis sparingly (1-2 per response)
- Format responses with markdown for readability
- Reference specific numbers when discussing spending
- Never give legal or investment advice
- Be encouraging but realistic

When analyzing spending, point out trends and suggest specific improvements.`;

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function chat(messages: ChatMessage[], userContext?: string): Promise<string> {
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Build context with user financial data if provided
    const contextPrompt = userContext 
      ? `${COACH_SYSTEM_PROMPT}\n\nUser's Financial Context:\n${userContext}`
      : COACH_SYSTEM_PROMPT;
    
    // Convert messages to Gemini format
    const history = messages.slice(0, -1).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model' as const,
      parts: [{ text: msg.content }]
    }));
    
    const chatSession = model.startChat({
      history,
      systemInstruction: contextPrompt
    });
    
    const lastMessage = messages[messages.length - 1];
    const result = await chatSession.sendMessage(lastMessage.content);
    const response = await result.response;
    
    return response.text();
  } catch (error) {
    console.error('Gemini chat error:', error);
    throw new Error('Failed to get AI response');
  }
}

// Receipt OCR Schema
const RECEIPT_SCHEMA = {
  type: 'object',
  properties: {
    merchant: { type: 'string' },
    date: { type: 'string' },
    total: { type: 'number' },
    tax: { type: 'number' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          price: { type: 'number' }
        }
      }
    }
  },
  required: ['merchant', 'total', 'date']
};

export interface ReceiptData {
  merchant: string;
  date: string;
  total: number;
  tax?: number;
  items?: Array<{ name: string; price: number }>;
}

export async function scanReceipt(imageBase64: string): Promise<ReceiptData> {
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });
    
    const prompt = `Analyze this receipt image and extract:
- Merchant name
- Transaction date (format: YYYY-MM-DD)
- Total amount (number only)
- Tax amount if visible (number only)
- List of line items with names and prices

Return as JSON following this schema: ${JSON.stringify(RECEIPT_SCHEMA)}`;
    
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBase64
        }
      }
    ]);
    
    const response = await result.response;
    const text = response.text();
    
    return JSON.parse(text) as ReceiptData;
  } catch (error) {
    console.error('Receipt scan error:', error);
    throw new Error('Failed to scan receipt');
  }
}

// Financial Health Score Calculation
export interface HealthMetrics {
  savingsRate: number;
  budgetAdherence: number;
  expenseGrowth: number;
}

export function calculateHealthScore(metrics: HealthMetrics): number {
  // Weighted score calculation
  const savingsWeight = 0.4;
  const budgetWeight = 0.4;
  const growthWeight = 0.2;
  
  // Normalize each metric to 0-100
  const savingsScore = Math.min(metrics.savingsRate * 5, 100); // 20% savings = 100
  const budgetScore = metrics.budgetAdherence; // Already 0-100
  const growthScore = Math.max(100 - (metrics.expenseGrowth * 2), 0); // Lower is better
  
  const score = 
    savingsScore * savingsWeight +
    budgetScore * budgetWeight +
    growthScore * growthWeight;
  
  return Math.round(Math.max(0, Math.min(100, score)));
}
