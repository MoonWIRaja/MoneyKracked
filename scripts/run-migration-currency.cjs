const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'moneykracked',
    user: 'moneykracked',
    password: 'moneykracked'
  });

  try {
    await client.connect();
    console.log('Connected to database');

    const migrationPath = path.join(__dirname, '../drizzle/0002_add_currency_and_exchange_rates.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    await client.query(migrationSQL);
    console.log('Migration completed successfully!');
    console.log('- Added currency column to budgets table');
    console.log('- Added currency column to goals table');
    console.log('- Created exchange_rates table');
    console.log('- Inserted default exchange rates');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
