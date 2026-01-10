-- Reset all user data but keep accounts
-- This will delete: transactions, budgets, categories, goals, accounts, AI data, sessions
-- Users will need to login again after this

-- Delete in order of dependencies

-- 1. AI Chat History
DELETE FROM ai_chat_history;

-- 2. AI Session Summaries
DELETE FROM ai_session_summaries;

-- 3. AI Popular Questions
DELETE FROM ai_popular_questions;

-- 4. Transactions
DELETE FROM transactions;

-- 5. Budgets
DELETE FROM budgets;

-- 6. Categories
DELETE FROM categories;

-- 7. Goals
DELETE FROM goals;

-- 8. Financial Accounts
DELETE FROM financial_accounts;

-- 9. Sessions (logout all users)
DELETE FROM session;

-- 10. Reset verification tokens
DELETE FROM verification;

-- Users and accounts are kept - users can login again
SELECT 'All user data has been reset!' AS message;
