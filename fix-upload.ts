import fs from 'fs';
const file = fs.readFileSync('scripts/upload-downloads.ts', 'utf8');

// The user might be complaining about missing types causing TS errors in their IDE.
// Let's add `any[]` typing.
let replaced = file.replace(
  "let res = currentParentId === null",
  "let res: any[] = currentParentId === null"
);

replaced = replaced.replace(
  "const insertRes = await sql`",
  "const insertRes: any[] = await sql`"
);

// To fix the race condition, let's add a mutex.
const mutexCode = `
class Mutex {
  private mutex = Promise.resolve();
  lock(): Promise<() => void> {
    let begin: (unlock: () => void) => void = unlock => {};
    this.mutex = this.mutex.then(() => new Promise(begin));
    return new Promise(res => { begin = res; });
  }
}
const folderMutex = new Mutex();
`;

replaced = replaced.replace("async function getOrCreateFolder", mutexCode + "\nasync function getOrCreateFolder");

replaced = replaced.replace(
  "async function getOrCreateFolder(pathStr: string): Promise<string | null> {",
  "async function getOrCreateFolder(pathStr: string): Promise<string | null> {\n  const unlock = await folderMutex.lock();\n  try {"
);

replaced = replaced.replace(
  "return currentParentId;\n}",
  "return currentParentId;\n  } finally {\n    unlock();\n  }\n}"
);

fs.writeFileSync('scripts/upload-downloads.ts', replaced);
