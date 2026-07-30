import { neon } from '@neondatabase/serverless';

async function main() {
  const sql = neon(process.env.POSTGRES_URL!);
  
  console.log('Adding auth columns to nodes table...');
  await sql`ALTER TABLE nodes ADD COLUMN IF NOT EXISTS user_email VARCHAR(255);`;
  await sql`ALTER TABLE nodes ADD COLUMN IF NOT EXISTS secret_code VARCHAR(100);`;
  await sql`ALTER TABLE nodes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;`;

  console.log('Assigning existing files to adityapadey.dev.in@gmail.com...');
  await sql`UPDATE nodes SET user_email = 'adityapadey.dev.in@gmail.com' WHERE user_email IS NULL AND secret_code IS NULL;`;

  console.log('Migration complete!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
