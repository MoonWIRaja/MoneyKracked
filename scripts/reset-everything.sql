-- DELETE EVERYTHING - Fresh Start
-- This will completely reset the database to empty state
-- WARNING: All data will be lost!

-- Delete in order of dependencies

-- 1. AI Data
DELETE FROM ai_chat_history;
DELETE FROM ai_session_summaries;
DELETE FROM ai_popular_questions;

-- 2. Transactions
DELETE FROM transactions;

-- 3. Budgets
DELETE FROM budgets;

-- 4. Categories
DELETE FROM categories;

-- 5. Goals
DELETE FROM goals;

-- 6. Financial Accounts
DELETE FROM financial_accounts;

-- 7. Sessions
DELETE FROM session;

-- 8. Accounts (OAuth)
DELETE FROM account;

-- 9. Verification Tokens
DELETE FROM verification;

-- 10. Users
DELETE FROM user;

SELECT 'Database completely reset - Fresh start!' AS message;
