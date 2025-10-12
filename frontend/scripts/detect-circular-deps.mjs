import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? '.');
const repoRoot = path.resolve(root, '..', '..');
const exts = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];

const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (exts.includes(path.extname(entry.name))) {
      files.push(full);
    }
  }
}
walk(root);

const graph = new Map();
const pathCache = new Map();

function resolveImport(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const baseDir = path.dirname(fromFile);
  const candidate = path.resolve(baseDir, specifier);
  if (pathCache.has(`${fromFile}->${specifier}`)) {
    return pathCache.get(`${fromFile}->${specifier}`);
  }
  const guesses = [];
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    guesses.push(candidate);
  }
  for (const ext of exts) {
    const withExt = `${candidate}${ext}`;
    if (fs.existsSync(withExt)) {
      guesses.push(withExt);
    }
  }
  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    for (const ext of exts) {
      const indexFile = path.join(candidate, `index${ext}`);
      if (fs.existsSync(indexFile)) {
        guesses.push(indexFile);
      }
    }
  }
  const resolved = guesses.length ? guesses[0] : null;
  pathCache.set(`${fromFile}->${specifier}`, resolved);
  return resolved;
}

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const importRegex = /import\s+(?:[^'";]+\s+from\s+)?['\"]([^'\"]+)['\"]/g;
  let match;
  while ((match = importRegex.exec(content))) {
    const target = resolveImport(file, match[1]);
    if (!target) continue;
    if (!graph.has(file)) graph.set(file, new Set());
    graph.get(file).add(target);
  }
}

const cycles = [];
const visited = new Set();
const stack = new Set();

function dfs(node, pathStack) {
  if (stack.has(node)) {
    const idx = pathStack.indexOf(node);
    if (idx !== -1) {
      cycles.push([...pathStack.slice(idx), node]);
    }
    return;
  }
  if (visited.has(node)) return;
  visited.add(node);
  stack.add(node);
  pathStack.push(node);
  const neighbors = graph.get(node);
  if (neighbors) {
    for (const neighbor of neighbors) {
      dfs(neighbor, pathStack);
    }
  }
  pathStack.pop();
  stack.delete(node);
}

for (const file of graph.keys()) {
  dfs(file, []);
}

const reportPath = path.join(repoRoot, 'build', 'circular-deps.txt');
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
if (!cycles.length) {
  fs.writeFileSync(reportPath, 'No circular dependencies detected.\n', 'utf8');
  console.log('No circular dependencies detected.');
} else {
  const lines = cycles.map((cycle) => cycle.map((item) => path.relative(root, item)).join(' -> '));
  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
  console.log('Circular dependencies found:');
  for (const line of lines) {
    console.log(`  ${line}`);
  }
}
