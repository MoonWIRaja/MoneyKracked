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
  const res = await client.query('SELECT id, question, ask_count FROM ai_popular_questions ORDER BY ask_count DESC');

  console.log('Current questions:');
  console.log('---');
  res.rows.forEach(r => {
    console.log(`[${r.id}] ${r.question} (count: ${r.ask_count})`);
  });
  console.log('---');
  console.log(`Total: ${res.rows.length} questions`);

  await client.end();
})();
