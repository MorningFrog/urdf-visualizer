const { runTests } = require('@vscode/test-electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

// VS Code's integrated terminal may inherit this from its parent process.
delete process.env.ELECTRON_RUN_AS_NODE;
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'urdf-vscode-smoke-'));
runTests({
    version: process.argv[2] || 'stable',
    extensionDevelopmentPath: path.resolve(__dirname, '..'),
    extensionTestsPath: path.join(__dirname, 'vscode-smoke.cjs'),
    launchArgs: [
        '--user-data-dir', path.join(temporary, 'user-data'),
        '--extensions-dir', path.join(temporary, 'extensions'),
        '--skip-welcome', '--skip-release-notes', '--disable-workspace-trust',
    ],
}).catch(error => {
    console.error(error);
    process.exitCode = 1;
}).finally(() => fs.rmSync(temporary, { recursive: true, force: true }));
