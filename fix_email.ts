import { sql } from './src/lib/db';

async function run() {
  const countRes = await sql`SELECT COUNT(*) FROM nodes WHERE user_email = 'adityapadey.dev.in@gmail.com'`;
  console.log(`Found ${countRes[0].count} nodes with typo email.`);

  await sql`UPDATE nodes SET user_email = 'adityapandey.dev.in@gmail.com' WHERE user_email = 'adityapadey.dev.in@gmail.com'`;
  
  const newCount = await sql`SELECT COUNT(*) FROM nodes WHERE user_email = 'adityapandey.dev.in@gmail.com'`;
  console.log(`Updated. Now ${newCount[0].count} nodes with correct email adityapandey.dev.in@gmail.com`);
}

run().catch(console.error);
