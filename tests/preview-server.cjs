const { spawn, execFileSync } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const dir = mkdtempSync(join(tmpdir(), 'mygo-tv-tests-'));
const binary = join(dir, 'core');
execFileSync('go', ['build', '-mod=vendor', '-o', binary, './core/cmd/music-tv'], { stdio: 'inherit' });
const child = spawn(binary, ['-mode', 'fixture', '-port', '18943', '-parent-pid', String(process.pid), '-data-dir', dir], { stdio: 'inherit', env: { ...process.env, MYGO_INSTANCE_TOKEN: 'playwright-only-local-session-0123456789' } });
function stop() { child.kill('SIGTERM'); rmSync(dir, { recursive: true, force: true }); process.exit(0); }
process.on('SIGTERM', stop); process.on('SIGINT', stop);
child.on('exit', code => { rmSync(dir, { recursive: true, force: true }); process.exit(code || 0); });
