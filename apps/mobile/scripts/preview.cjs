const { spawn } = require('node:child_process');
const path = require('node:path');
const child = spawn(process.execPath, [require.resolve('expo/bin/cli'), 'start', '--web', ...process.argv.slice(2)], {
  cwd: path.resolve(__dirname, '..'), stdio: 'inherit',
  env: { ...process.env, EXPO_PUBLIC_DEMO_MODE: 'true' }
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
