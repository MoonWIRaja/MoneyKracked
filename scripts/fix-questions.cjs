const { Client } = require('pg');

(async () => {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'moneykracked',
    user: 'moneykracked',
    password: 'moneykracked'
  });

  await client.connect();

  // Delete all questions and reset
  await client.query('DELETE FROM ai_popular_questions');
  console.log('Cleared all questions');

  // Or if you want to keep the short one:
  // await client.query("DELETE FROM ai_popular_questions WHERE LENGTH(question) > 60");

  await client.end();
})();
