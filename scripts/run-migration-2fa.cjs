const postgres = require('postgres');
const path = require('path');
const fs = require('fs');

const DATABASE_URL = 'postgresql://moneykracked:moneykracked@localhost:5432/moneykracked';

const sql = postgres(DATABASE_URL);

async function runMigration() {
  try {
    console.log('Running 2FA migration...');

    // Check if columns already exist
    const checkResult = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'user'
      AND column_name IN ('two_factor_enabled', 'two_factor_secret', 'two_factor_backup_codes')
    `;

    const existingColumns = checkResult.map(r => r.column_name);
    console.log('Existing columns:', existingColumns);

    // Add two_factor_enabled column if not exists
    if (!existingColumns.includes('two_factor_enabled')) {
      await sql`ALTER TABLE "user" ADD COLUMN "two_factor_enabled" boolean DEFAULT false`;
      console.log('✓ Added column: two_factor_enabled');
    } else {
      console.log('- Column already exists: two_factor_enabled');
    }

    // Add two_factor_secret column if not exists
    if (!existingColumns.includes('two_factor_secret')) {
      await sql`ALTER TABLE "user" ADD COLUMN "two_factor_secret" text`;
      console.log('✓ Added column: two_factor_secret');
    } else {
      console.log('- Column already exists: two_factor_secret');
    }

    // Add two_factor_backup_codes column if not exists
    if (!existingColumns.includes('two_factor_backup_codes')) {
      await sql`ALTER TABLE "user" ADD COLUMN "two_factor_backup_codes" jsonb`;
      console.log('✓ Added column: two_factor_backup_codes');
    } else {
      console.log('- Column already exists: two_factor_backup_codes');
    }

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
