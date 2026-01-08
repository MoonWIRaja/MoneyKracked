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
  deadline: date('deadline'),
  icon: text('icon').default('savings'),
  color: text('color').default('#21c462'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// ===== AI Chat History =====
export const aiChatHistory = pgTable('ai_chat_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'user' | 'assistant' | 'system'
  content: text('content').notNull(),
  tokensUsed: integer('tokens_used'),
  createdAt: timestamp('created_at').defaultNow().notNull()
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
  healthSnapshots: many(healthSnapshots)
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
