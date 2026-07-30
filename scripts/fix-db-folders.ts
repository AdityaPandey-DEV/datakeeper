import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        let val = valueParts.join('=').trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key.trim()]) process.env[key.trim()] = val;
      }
    }
  }
}

const sql = neon(process.env.POSTGRES_URL!);
const USER_EMAIL = 'adityapandey.dev.in@gmail.com';

async function run() {
  console.log('Finding dummy email folders...');
  
  // Find all folders at the root that have the exact name of the user email
  const folders = await sql`
    SELECT id FROM nodes 
    WHERE parent_id IS NULL AND type = 'folder' AND name = ${USER_EMAIL} AND user_email = ${USER_EMAIL}
  `;
  
  if (folders.length === 0) {
    console.log('No dummy email folders found at root. Checking other users...');
    
    // Catch-all: ANY folder named after the user's email at the root
    const allDummyFolders = await sql`
      SELECT id, user_email FROM nodes 
      WHERE parent_id IS NULL AND type = 'folder' AND name = user_email
    `;
    
    for (const folder of allDummyFolders) {
      console.log(`Found dummy folder for ${folder.user_email}. Fixing...`);
      // Update children to have parent_id = NULL
      await sql`UPDATE nodes SET parent_id = NULL WHERE parent_id = ${folder.id}`;
      // Delete the dummy folder
      await sql`DELETE FROM nodes WHERE id = ${folder.id}`;
      console.log(`✅ Fixed folder for ${folder.user_email}`);
    }
    
    console.log('Done fixing all dummy folders.');
    return;
  }

  for (const folder of folders) {
    console.log(`Found dummy folder ID: ${folder.id}. Migrating children to root...`);
    
    // Update all children to have parent_id = NULL
    const updated = await sql`UPDATE nodes SET parent_id = NULL WHERE parent_id = ${folder.id}`;
    
    // Delete the dummy folder
    await sql`DELETE FROM nodes WHERE id = ${folder.id}`;
    console.log('✅ Deleted dummy folder.');
  }
  
  console.log('Database fix complete!');
}

run().catch(console.error);
