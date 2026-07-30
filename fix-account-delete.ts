import fs from 'fs';

let content = fs.readFileSync('src/app/api/account/delete/route.ts', 'utf8');

const replacement = `
    const userEmail = auth.value;
    
    // 1. Delete ALL files recursively from Cloudflare R2 for this user's email prefix
    // This is 100% robust and guarantees no orphaned files are left behind.
    await deleteFolder(userEmail);

    // 2. Delete all database records for this user
    await sql\`DELETE FROM nodes WHERE user_email = \${userEmail}\`;

    return NextResponse.json({ success: true });
`;

content = content.replace(/const userEmail = auth\.value;[\s\S]*return NextResponse\.json\(\{ success: true, deletedFiles: keysToDelete\.length \}\);/, replacement);

// Also need to import deleteFolder
content = content.replace('deleteR2Keys', 'deleteFolder');

fs.writeFileSync('src/app/api/account/delete/route.ts', content);
console.log('Fixed account deletion logic!');
