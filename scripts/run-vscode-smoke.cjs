const { runTests } = require('@vscode/test-electron');
const path = require('node:path');
const { createTestExtensionCopy } = require('./test-extension-copy.cjs');

// VS Code's integrated terminal may inherit this from its parent process.
delete process.env.ELECTRON_RUN_AS_NODE;
async function main() {
    const copy = await createTestExtensionCopy();
    process.once('exit', copy.cleanup);
    try {
        await runTests({
            version: process.argv[2] || 'stable',
            extensionDevelopmentPath: copy.extensionDevelopmentPath,
            extensionTestsPath: path.join(__dirname, 'vscode-smoke.cjs'),
            launchArgs: copy.launchArgs,
        });
    } finally {
        process.removeListener('exit', copy.cleanup);
        copy.cleanup();
    }
}
main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
