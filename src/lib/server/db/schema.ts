import { pgTable, uuid, text, timestamp, decimal, pgEnum, jsonb, date, integer, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ===== Enums =====
export const accountTypeEnum = pgEnum('account_type', ['bank', 'cash', 'credit_card', 'e_wallet', 'investment']);
export const transactionTypeEnum = pgEnum('transaction_type', ['income', 'expense', 'transfer']);
export const budgetPeriodEnum = pgEnum('budget_period', ['daily', 'weekly', 'monthly', 'yearly']);

// ===== User Table (Better Auth) =====
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  username: text('username').unique(),
  displayUsername: text('display_username'),
  name: text('name').notNull(),
  emailVerified: boolean('email_verified').default(false),
  image: text('image'),
  // Two-Factor Authentication (2FA) fields
  twoFactorEnabled: boolean('two_factor_enabled').default(false),
  twoFactorSecret: text('two_factor_secret'), // Encrypted TOTP secret
  twoFactorBackupCodes: jsonb('two_factor_backup_codes'), // Array of backup codes
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// ===== Session Table (Better Auth) =====
export const session = pgTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  deviceId: text('device_id'), // Device fingerprint for binding session to specific device
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// ===== Account Table (Better Auth) =====
export const account = pgTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// ===== Verification Tokens (Better Auth) =====
export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// ===== Financial Accounts (App) =====
export const financialAccounts = pgTable('financial_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: accountTypeEnum('type').notNull().default('bank'),
  currency: text('currency').notNull().default('MYR'),
  balance: decimal('balance', { precision: 19, scale: 4 }).notNull().default('0'),
  icon: text('icon').default('account_balance'),
  color: text('color').default('#21c462'),
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// ===== Categories =====
export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  icon: text('icon').notNull().default('category'),
  color: text('color').notNull().default('#6b7280'),
  type: transactionTypeEnum('type').notNull().default('expense'),
  parentId: uuid('parent_id'),
  isSystem: boolean('is_system').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// ===== Transactions =====
export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => financialAccounts.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  type: transactionTypeEnum('type').notNull().default('expense'),
  amount: decimal('amount', { precision: 19, scale: 4 }).notNull(),
  currency: text('currency').notNull().default('MYR'),
  payee: text('payee'),
  notes: text('notes'),
  date: timestamp('date').defaultNow().notNull(),
  receiptUrl: text('receipt_url'),
  aiMetadata: jsonb('ai_metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// ===== Budgets =====
export const budgets = pgTable('budgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'cascade' }),
  limitAmount: decimal('limit_amount', { precision: 19, scale: 4 }).notNull(),
  currency: text('currency').notNull().default('MYR'),
  period: budgetPeriodEnum('period').notNull().default('monthly'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// ===== Goals =====
export const goals = pgTable('goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  targetAmount: decimal('target_amount', { precision: 19, scale: 4 }).notNull(),
  currentAmount: decimal('current_amount', { precision: 19, scale: 4 }).notNull().default('0'),
  currency: text('currency').notNull().default('MYR'),
  deadline: date('deadline'),
  icon: text('icon').default('savings'),
  color: text('color').default('#21c462'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// ===== Exchange Rates =====
// Store exchange rates relative to a base currency (MYR)
// Updated periodically from external API
export const exchangeRates = pgTable('exchange_rates', {
  id: uuid('id').primaryKey().defaultRandom(),
  fromCurrency: text('from_currency').notNull(), // e.g., 'MYR', 'USD', 'SGD'
  toCurrency: text('to_currency').notNull(),     // e.g., 'MYR', 'USD', 'SGD'
  rate: decimal('rate', { precision: 19, scale: 6 }).notNull(), // Exchange rate
  source: text('source').default('manual'), // 'manual', 'api', etc.
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// ===== AI Chat History =====
export const aiChatHistory = pgTable('ai_chat_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  sessionId: uuid('session_id').notNull(), // Group messages by conversation session
  role: text('role').notNull(), // 'user' | 'assistant' | 'system'
  content: text('content').notNull(),
  tokensUsed: integer('tokens_used'),
  metadata: jsonb('metadata'), // Store budgetActions, insights extracted, etc.
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// ===== AI Session Summaries =====
// Auto-generated summary of each conversation for quick retrieval
export const aiSessionSummaries = pgTable('ai_session_summaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  sessionId: uuid('session_id').notNull().unique(),
  title: text('title').notNull(), // Auto-generated title (e.g., "Budget Planning for RM4500 salary")
  summary: text('summary').notNull(), // Key points discussed
  topics: jsonb('topics').notNull(), // Array of topics: ["budget", "savings", "debt"]
  sentiment: text('sentiment'), // 'positive', 'neutral', 'negative', 'stressed'
  actionItems: jsonb('action_items'), // Actions taken or recommended
  messageCount: integer('message_count').notNull().default(0),
  totalTokens: integer('total_tokens').default(0),
  lastMessageAt: timestamp('last_message_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// ===== AI User Profiles (Learned Preferences) =====
// What AI has learned about each user over time
export const aiUserProfiles = pgTable('ai_user_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  // Financial Basics
  monthlyIncome: decimal('monthly_income', { precision: 19, scale: 4 }),
  incomeFrequency: text('income_frequency'), // 'monthly', 'bi-weekly', 'weekly'
  employmentStatus: text('employment_status'), // 'employed', 'self-employed', 'unemployed', 'student'
  // Family & Dependencies
  maritalStatus: text('marital_status'), // 'single', 'married', 'divorced'
  dependents: integer('dependents').default(0), // Number of dependents
  // Financial Goals
  primaryGoal: text('primary_goal'), // 'buy_house', 'emergency_fund', 'retirement', 'debt_free'
  riskTolerance: text('risk_tolerance'), // 'conservative', 'moderate', 'aggressive'
  savingsPreference: integer('savings_preference'), // Preferred savings percentage (10-50)
  // Spending Habits (Learned)
  spendingPersonality: text('spending_personality'), // 'frugal', 'moderate', 'generous', 'impulsive'
  biggestExpenseCategory: text('biggest_expense_category'),
  budgetAdherence: text('budget_adherence'), // 'strict', 'flexible', 'struggles'
  // Communication Preferences
  preferredLanguage: text('preferred_language').default('mixed'), // 'english', 'malay', 'mixed'
  communicationStyle: text('communication_style'), // 'formal', 'casual', 'friendly'
  // Debt Information
  hasDebt: boolean('has_debt').default(false),
  debtTypes: jsonb('debt_types'), // ['ptptn', 'car_loan', 'credit_card', 'housing']
  // Metadata
  confidence: integer('confidence').default(0), // 0-100, how confident AI is about this profile
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// ===== AI Insights (Discovered Patterns) =====
// Patterns and insights AI discovers over time
export const aiInsights = pgTable('ai_insights', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  insightType: text('insight_type').notNull(), // 'spending_pattern', 'savings_opportunity', 'budget_alert', 'goal_progress'
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: text('category'), // Which expense category this relates to
  impact: text('impact'), // 'high', 'medium', 'low'
  actionable: boolean('actionable').default(true),
  actionSuggestion: text('action_suggestion'), // What user should do
  data: jsonb('data'), // Supporting data (amounts, percentages, etc.)
  validUntil: timestamp('valid_until'), // When this insight expires
  acknowledged: boolean('acknowledged').default(false),
  dismissed: boolean('dismissed').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// ===== AI Memory (Key Events) =====
// Important events AI should remember
export const aiMemories = pgTable('ai_memories', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  memoryType: text('memory_type').notNull(), // 'milestone', 'struggle', 'achievement', 'preference'
  title: text('title').notNull(),
  description: text('description').notNull(),
  importance: integer('importance').default(5), // 1-10, how important to remember
  date: date('date').notNull(),
  data: jsonb('data'), // Additional context
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// ===== AI Popular Questions (Aggregated from all users) =====
// Tracks what questions users ask most frequently for smart suggestions
export const aiPopularQuestions = pgTable('ai_popular_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  question: text('question').notNull().unique(),
  questionHash: text('question_hash').notNull().unique(), // For fast lookup
  category: text('category').notNull(), // 'budget', 'savings', 'debt', 'investment', 'general'
  askCount: integer('ask_count').notNull().default(1), // How many times asked
  lastAskedAt: timestamp('last_asked_at').defaultNow().notNull(),
  helpfulScore: integer('helpful_score').default(0), // Upvotes for helpfulness
  suggested: boolean('suggested').default(true), // Whether to show in suggestions
  context: jsonb('context'), // Additional context (income_range mentioned, etc.)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// ===== Financial Health Snapshots =====
export const healthSnapshots = pgTable('health_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  snapshotDate: date('snapshot_date').defaultNow().notNull(),
  healthScore: integer('health_score').notNull(),
  metrics: jsonb('metrics').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// ===== Relations =====
export const userRelations = relations(user, ({ many }) => ({
  financialAccounts: many(financialAccounts),
  categories: many(categories),
  transactions: many(transactions),
  budgets: many(budgets),
  goals: many(goals),
  chatHistory: many(aiChatHistory),
  healthSnapshots: many(healthSnapshots),
  aiSessionSummaries: many(aiSessionSummaries),
  aiProfile: many(aiUserProfiles),
  aiInsights: many(aiInsights),
  aiMemories: many(aiMemories)
}));

export const financialAccountsRelations = relations(financialAccounts, ({ one, many }) => ({
  user: one(user, { fields: [financialAccounts.userId], references: [user.id] }),
  transactions: many(transactions)
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(user, { fields: [categories.userId], references: [user.id] }),
  parent: one(categories, { fields: [categories.parentId], references: [categories.id] }),
  transactions: many(transactions),
  budgets: many(budgets)
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(user, { fields: [transactions.userId], references: [user.id] }),
  account: one(financialAccounts, { fields: [transactions.accountId], references: [financialAccounts.id] }),
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] })
}));

export const budgetsRelations = relations(budgets, ({ one }) => ({
  user: one(user, { fields: [budgets.userId], references: [user.id] }),
  category: one(categories, { fields: [budgets.categoryId], references: [categories.id] })
}));

export const goalsRelations = relations(goals, ({ one }) => ({
  user: one(user, { fields: [goals.userId], references: [user.id] })
}));

export const aiChatHistoryRelations = relations(aiChatHistory, ({ one }) => ({
  user: one(user, { fields: [aiChatHistory.userId], references: [user.id] })
}));

export const aiSessionSummariesRelations = relations(aiSessionSummaries, ({ one }) => ({
  user: one(user, { fields: [aiSessionSummaries.userId], references: [user.id] })
}));

export const aiUserProfilesRelations = relations(aiUserProfiles, ({ one }) => ({
  user: one(user, { fields: [aiUserProfiles.userId], references: [user.id] })
}));

export const aiInsightsRelations = relations(aiInsights, ({ one }) => ({
  user: one(user, { fields: [aiInsights.userId], references: [user.id] })
}));

export const aiMemoriesRelations = relations(aiMemories, ({ one }) => ({
  user: one(user, { fields: [aiMemories.userId], references: [user.id] })
}));

export const aiPopularQuestionsRelations = relations(aiPopularQuestions, () => ({
  // No direct user relation - this is aggregated across all users
}));
