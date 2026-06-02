const { spawn } = require('child_process');

const child =
  process.platform === 'win32'
    ? spawn('cmd.exe', ['/d', '/s', '/c', 'npx expo start --web --offline'], {
        stdio: 'inherit',
        env: {
          ...process.env,
          EXPO_PUBLIC_WEB_UI_ONLY: '1',
        },
      })
    : spawn('npx', ['expo', 'start', '--web', '--offline'], {
        stdio: 'inherit',
        env: {
          ...process.env,
          EXPO_PUBLIC_WEB_UI_ONLY: '1',
        },
      });

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
