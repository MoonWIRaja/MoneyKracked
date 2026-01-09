-- ========================================
-- MonKrac Thinking Machine - AI Tables
-- ========================================

-- Drop existing ai_chat_history and recreate with new structure
DROP TABLE IF EXISTS ai_chat_history CASCADE;

-- Create AI Chat History with session support
CREATE TABLE ai_chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  role TEXT NOT NULL, -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,
  tokens_used INTEGER,
  metadata JSONB, -- Store budgetActions, insights extracted, etc.
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Index for faster session queries
CREATE INDEX idx_ai_chat_session ON ai_chat_history(session_id);
CREATE INDEX idx_ai_chat_user ON ai_chat_history(user_id);
CREATE INDEX idx_ai_chat_created ON ai_chat_history(created_at DESC);

-- Create AI Session Summaries
-- Auto-generated summary of each conversation for quick retrieval
CREATE TABLE ai_session_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  session_id UUID NOT NULL UNIQUE,
  title TEXT NOT NULL, -- Auto-generated title
  summary TEXT NOT NULL, -- Key points discussed
  topics JSONB NOT NULL, -- Array of topics
  sentiment TEXT, -- 'positive', 'neutral', 'negative', 'stressed'
  action_items JSONB, -- Actions taken or recommended
  message_count INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  last_message_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_ai_session_user ON ai_session_summaries(user_id);
CREATE INDEX idx_ai_session_created ON ai_session_summaries(created_at DESC);

-- Create AI User Profiles (Learned Preferences)
-- What AI has learned about each user over time
CREATE TABLE ai_user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,

  -- Financial Basics
  monthly_income DECIMAL(19,4),
  income_frequency TEXT, -- 'monthly', 'bi-weekly', 'weekly'
  employment_status TEXT, -- 'employed', 'self-employed', 'unemployed', 'student'

  -- Family & Dependencies
  marital_status TEXT, -- 'single', 'married', 'divorced'
  dependents INTEGER DEFAULT 0,

  -- Financial Goals
  primary_goal TEXT, -- 'buy_house', 'emergency_fund', 'retirement', 'debt_free'
  risk_tolerance TEXT, -- 'conservative', 'moderate', 'aggressive'
  savings_preference INTEGER, -- Preferred savings percentage (10-50)

  -- Spending Habits (Learned)
  spending_personality TEXT, -- 'frugal', 'moderate', 'generous', 'impulsive'
  biggest_expense_category TEXT,
  budget_adherence TEXT, -- 'strict', 'flexible', 'struggles'

  -- Communication Preferences
  preferred_language TEXT DEFAULT 'mixed', -- 'english', 'malay', 'mixed'
  communication_style TEXT, -- 'formal', 'casual', 'friendly'

  -- Debt Information
  has_debt BOOLEAN DEFAULT false,
  debt_types JSONB, -- ['ptptn', 'car_loan', 'credit_card', 'housing']

  -- Metadata
  confidence INTEGER DEFAULT 0, -- 0-100, how confident AI is about this profile
  last_updated TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id)
);

CREATE INDEX idx_ai_profile_user ON ai_user_profiles(user_id);

-- Create AI Insights (Discovered Patterns)
-- Patterns and insights AI discovers over time
CREATE TABLE ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL, -- 'spending_pattern', 'savings_opportunity', 'budget_alert', 'goal_progress'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT, -- Which expense category this relates to
  impact TEXT, -- 'high', 'medium', 'low'
  actionable BOOLEAN DEFAULT true,
  action_suggestion TEXT, -- What user should do
  data JSONB, -- Supporting data
  valid_until TIMESTAMP, -- When this insight expires
  acknowledged BOOLEAN DEFAULT false,
  dismissed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_ai_insights_user ON ai_insights(user_id);
CREATE INDEX idx_ai_insights_type ON ai_insights(insight_type);
CREATE INDEX idx_ai_insights_created ON ai_insights(created_at DESC);
CREATE INDEX idx_ai_insights_active ON ai_insights(user_id, dismissed) WHERE dismissed = false;

-- Create AI Memory (Key Events)
-- Important events AI should remember
CREATE TABLE ai_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL, -- 'milestone', 'struggle', 'achievement', 'preference'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  importance INTEGER DEFAULT 5, -- 1-10, how important to remember
  date DATE NOT NULL,
  data JSONB, -- Additional context
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_ai_memory_user ON ai_memories(user_id);
CREATE INDEX idx_ai_memory_type ON ai_memories(memory_type);
CREATE INDEX idx_ai_memory_importance ON ai_memories(importance DESC);

-- Create AI Popular Questions (Smart Suggestions)
-- Tracks what questions users ask most frequently
CREATE TABLE ai_popular_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL UNIQUE,
  question_hash TEXT NOT NULL UNIQUE, -- For fast lookup
  category TEXT NOT NULL, -- 'budget', 'savings', 'debt', 'investment', 'spending', 'goals', 'general'
  ask_count INTEGER NOT NULL DEFAULT 1, -- How many times asked
  last_asked_at TIMESTAMP DEFAULT NOW() NOT NULL,
  helpful_score INTEGER DEFAULT 0, -- Upvotes for helpfulness
  suggested BOOLEAN DEFAULT true, -- Whether to show in suggestions
  context JSONB, -- Additional context (income_range mentioned, etc.)
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_ai_popular_category ON ai_popular_questions(category);
CREATE INDEX idx_ai_popular_ask_count ON ai_popular_questions(ask_count DESC);
CREATE INDEX idx_ai_popular_last_asked ON ai_popular_questions(last_asked_at DESC);
CREATE INDEX idx_ai_popular_suggested ON ai_popular_questions(suggested) WHERE suggested = true;
