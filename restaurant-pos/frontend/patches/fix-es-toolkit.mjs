import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const distDir = join(import.meta.dirname, '..', 'node_modules', 'es-toolkit', 'dist');

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path).forEach(f => files.push(f));
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(path);
  }
  return files;
}

let count = 0;
for (const file of walk(distDir)) {
  let content = readFileSync(file, 'utf8');
  const original = content;
  content = content.replace(/(const|let|var)\s*require_(\w+)\s*=/g, '$1 _rqn_$2 =');
  content = content.replace(/(?<=[^\w.])require_(\w+)\./g, '_rqn_$1.');
  if (content !== original) {
    writeFileSync(file, content, 'utf8');
    count++;
  }
}
console.log(`Patched ${count} files`);
