-- Reset Users with Corrupted Password Hash
-- Run this in your PostgreSQL database to fix "Invalid password hash" errors

-- Option 1: Delete specific user and allow re-registration
-- Replace 'YOUR_EMAIL_HERE' with the actual email
-- DELETE FROM session WHERE user_id = (SELECT id FROM "user" WHERE email = 'YOUR_EMAIL_HERE');
-- DELETE FROM account WHERE user_id = (SELECT id FROM "user" WHERE email = 'YOUR_EMAIL_HERE');
-- DELETE FROM "user" WHERE email = 'YOUR_EMAIL_HERE';

-- Option 2: Clear the password to force password reset
-- This clears the password field in the account table
-- Replace 'YOUR_EMAIL_HERE' with the actual email
UPDATE account 
SET password = NULL
WHERE user_id = (SELECT id FROM "user" WHERE email = 'YOUR_EMAIL_HERE');

-- Option 3: Reset ALL users (DEVELOPMENT ONLY - USE WITH CAUTION)
-- This will delete all sessions, accounts, and users
-- TRUNCATE session CASCADE;
-- TRUNCATE account CASCADE;
-- TRUNCATE "user" CASCADE;

-- After running, user needs to:
-- 1. Use "Forgot Password" if email is configured
-- 2. Or register a new account
