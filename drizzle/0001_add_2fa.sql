-- Add Two-Factor Authentication columns to user table
ALTER TABLE "user" ADD COLUMN "two_factor_enabled" boolean DEFAULT false;
ALTER TABLE "user" ADD COLUMN "two_factor_secret" text;
ALTER TABLE "user" ADD COLUMN "two_factor_backup_codes" jsonb;
