-- Clear all users and related data
DELETE FROM "account" WHERE 1=1;
DELETE FROM "session" WHERE 1=1;
DELETE FROM "verification" WHERE 1=1;
DELETE FROM "user" WHERE 1=1;
SELECT 'Database cleared successfully' as result;
