import { db } from './src/lib/server/db';
import { sql } from 'drizzle-orm';
import { user } from './src/lib/server/db/schema';

async function checkSchema() {
  try {
    console.log("Checking 'user' table columns...");
    const result = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'user';
    `);
    
    console.log("Columns:", result);
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}

checkSchema();
