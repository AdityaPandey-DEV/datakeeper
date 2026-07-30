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
  console.log('Restoring email folder for user...');
  
  // Create or get the email folder
  let res = await sql`
    SELECT id FROM nodes WHERE parent_id IS NULL AND name = ${USER_EMAIL} AND user_email = ${USER_EMAIL} AND type = 'folder'
  `;
  
  let folderId;
  if (res.length > 0) {
    folderId = res[0].id;
    console.log('Email folder already exists with ID:', folderId);
  } else {
    const insertRes = await sql`
      INSERT INTO nodes (parent_id, name, type, user_email) 
      VALUES (NULL, ${USER_EMAIL}, 'folder', ${USER_EMAIL}) RETURNING id
    `;
    folderId = insertRes[0].id;
    console.log('Created new email folder with ID:', folderId);
  }
  
  // Move all other root items into this folder
  const rootItems = await sql`
    SELECT id, name FROM nodes 
    WHERE parent_id IS NULL AND user_email = ${USER_EMAIL} AND id != ${folderId}
  `;
  
  for (const item of rootItems) {
    console.log(`Moving ${item.name} into email folder...`);
    await sql`UPDATE nodes SET parent_id = ${folderId} WHERE id = ${item.id}`;
  }
  
  console.log('Done restoring email folder and moving items.');
}

run().catch(console.error);
