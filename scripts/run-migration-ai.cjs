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

    // Check if tables already exist
    const checkTables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('ai_chat_history', 'ai_session_summaries', 'ai_user_profiles', 'ai_insights', 'ai_memories', 'ai_popular_questions')
    `);

    const existingTables = checkTables.rows.map(row => row.table_name);
    console.log('Existing tables:', existingTables.length > 0 ? existingTables.join(', ') : 'none');

    if (existingTables.length >= 6) {
      console.log('All AI tables already exist. Migration not needed.');
      console.log('');
      console.log('=== MonKrac Thinking Machine is Ready ===');
      console.log('- ai_chat_history');
      console.log('- ai_session_summaries');
      console.log('- ai_user_profiles');
      console.log('- ai_insights');
      console.log('- ai_memories');
      console.log('- ai_popular_questions');
      return;
    }

    // Read and execute migration with IF NOT EXISTS
    const migrationPath = path.join(__dirname, '../drizzle/0003_add_ai_thinking_machine.sql');
    let migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Replace CREATE TABLE with CREATE TABLE IF NOT EXISTS for idempotency
    migrationSQL = migrationSQL.replace(/CREATE TABLE ai_chat_history/g, 'CREATE TABLE IF NOT EXISTS ai_chat_history');
    migrationSQL = migrationSQL.replace(/CREATE TABLE ai_session_summaries/g, 'CREATE TABLE IF NOT EXISTS ai_session_summaries');
    migrationSQL = migrationSQL.replace(/CREATE TABLE ai_user_profiles/g, 'CREATE TABLE IF NOT EXISTS ai_user_profiles');
    migrationSQL = migrationSQL.replace(/CREATE TABLE ai_insights/g, 'CREATE TABLE IF NOT EXISTS ai_insights');
    migrationSQL = migrationSQL.replace(/CREATE TABLE ai_memories/g, 'CREATE TABLE IF NOT EXISTS ai_memories');
    migrationSQL = migrationSQL.replace(/CREATE TABLE ai_popular_questions/g, 'CREATE TABLE IF NOT EXISTS ai_popular_questions');
    migrationSQL = migrationSQL.replace(/CREATE INDEX/g, 'CREATE INDEX IF NOT EXISTS');

    await client.query(migrationSQL);
    console.log('Migration completed successfully!');
    console.log('');
    console.log('=== MonKrac Thinking Machine Tables Created ===');
    console.log('- ai_chat_history (updated with session_id and metadata)');
    console.log('- ai_session_summaries (auto-generated conversation summaries)');
    console.log('- ai_user_profiles (learned preferences and traits)');
    console.log('- ai_insights (discovered patterns and recommendations)');
    console.log('- ai_memories (important events to remember)');
    console.log('- ai_popular_questions (trending questions from all users)');
    console.log('');
    console.log('AI is now ready to learn and remember!');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
