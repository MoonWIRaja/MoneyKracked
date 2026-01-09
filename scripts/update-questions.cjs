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

  // Update long questions to shorter versions
  const updates = [
    {
      old: 'setupkan budget saya pada bulan 2 2026 dengan gaji rm1458 yang terbaik dengan simpanan lebih tinggi',
      new: 'Setup budget RM1458 simpanan tinggi'
    }
  ];

  for (const update of updates) {
    await client.query('UPDATE ai_popular_questions SET question = $1 WHERE question = $2', [update.new, update.old]);
    console.log(`Updated: "${update.new}"`);
  }

  console.log('\nUpdated questions:');
  const res = await client.query('SELECT question, ask_count FROM ai_popular_questions ORDER BY ask_count DESC');
  res.rows.forEach(r => {
    console.log(`- ${r.question} (count: ${r.ask_count})`);
  });

  await client.end();
})();
