-- Add device_id column to session table for device binding
-- This enhances security by binding sessions to specific devices

ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "device_id" text;

-- Create index on device_id for faster lookups
CREATE INDEX IF NOT EXISTS "idx_session_device_id" ON "session"("device_id");
