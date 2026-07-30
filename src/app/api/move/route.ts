import { NextRequest, NextResponse } from 'next/server';
import { moveFile, moveFolder, renameFile, getAllFolders } from '@/lib/blob';

export async function POST(request: NextRequest) {
  try {
    const { action, sourceUrl, sourcePath, destinationPath, newName } = await request.json();

    switch (action) {
      case 'move-file': {
        if (!sourceUrl || !destinationPath) {
          return NextResponse.json(
            { error: 'sourceUrl and destinationPath are required' },
            { status: 400 }
          );
        }
        const result = await moveFile(sourceUrl, destinationPath);
        return NextResponse.json({ success: true, ...result });
      }

      case 'move-folder': {
        if (!sourcePath || !destinationPath) {
          return NextResponse.json(
            { error: 'sourcePath and destinationPath are required' },
            { status: 400 }
          );
        }
        await moveFolder(sourcePath, destinationPath);
        return NextResponse.json({ success: true });
      }

      case 'rename': {
        if (!sourceUrl || !sourcePath || !newName) {
          return NextResponse.json(
            { error: 'sourceUrl, sourcePath, and newName are required' },
            { status: 400 }
          );
        }
        const renameResult = await renameFile(sourceUrl, sourcePath, newName);
        return NextResponse.json({ success: true, ...renameResult });
      }

      case 'list-folders': {
        const folders = await getAllFolders();
        return NextResponse.json({ folders });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: move-file, move-folder, rename, list-folders' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Move error:', error);
    return NextResponse.json(
      { error: 'Failed to perform move operation' },
      { status: 500 }
    );
  }
}
