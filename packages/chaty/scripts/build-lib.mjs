import { build } from 'vite';
import postcss from 'postcss';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
const entries = { index: 'assistant/index', providers: 'providers/index', host: 'chaty/host', ui: 'ui/index', playground: 'playground/index' };
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const external = Object.keys({...pkg.dependencies, ...pkg.peerDependencies}).filter(x => x !== '@glink25/agent-core');
await build({ configFile: false, publicDir: false, plugins: [react()], build: { lib: { entry: Object.fromEntries(Object.entries(entries).map(([k,v]) => [k, resolve('src', v + '.ts')])), formats: ['es'], fileName: (_, name) => name + '.js' }, rollupOptions: { external: id => external.some(name => id === name || id.startsWith(name + '/')) } } });
// Declarations retain the source module graph, including the private core, inside the tarball.
execFileSync('pnpm', ['exec', 'tsc', '-p', 'tsconfig.lib.json'], { stdio: 'inherit' });
function rewrite(dir) {
 for (const entry of readdirSync(dir, {withFileTypes:true})) {
  const path = resolve(dir, entry.name);
  if (entry.isDirectory()) rewrite(path);
  else if (path.endsWith('.d.ts')) {
   let source = readFileSync(path, 'utf8');
   source = source.replace(/(["'])@glink25\/agent-core(?:\/([^"']+))?\1/g, (_, q, sub) => {
    const target = resolve('dist/types/agent-core/src', sub || 'assistant/index');
    let rel = relative(dirname(path), target).replaceAll('\\', '/');
    if (!rel.startsWith('.')) rel = './' + rel;
    return q + rel + q;
   });
   writeFileSync(path, source);
  }
 }
}
rewrite(resolve('dist/types'));
const prose = postcss.parse(readFileSync('src/components/assistant/prose.css', 'utf8'));
prose.walkRules(rule => { if (rule.parent.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return; rule.selectors = rule.selectors.map(selector => ':where(.chaty-root) ' + selector); });
writeFileSync('dist/prose.css', prose.toString());
// Utility sheet for source scanning; no second Tailwind root or global preflight in consumers.
await build({configFile:false, publicDir:false, plugins:[tailwindcss()], build:{emptyOutDir:false, cssCodeSplit:true, rollupOptions:{input:resolve('src/styles.css'),output:{assetFileNames:'styles.css'}}}});

const css = postcss.parse(readFileSync('dist/styles.css', 'utf8'));
css.walkRules(rule => {
 if (rule.parent.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
 rule.selectors = rule.selectors.map(selector => selector.replaceAll(':root', '.chaty-root').replaceAll(':host', '.chaty-root')).flatMap(selector => selector.includes('.chaty-root') ? [selector] : [':where(.chaty-root) ' + selector, ':where(.chaty-root):is(' + selector + ')' ]);
});
writeFileSync('dist/styles.css', css.toString());
