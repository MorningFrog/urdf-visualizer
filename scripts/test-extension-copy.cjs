const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { listFiles, PackageManager } = require('@vscode/vsce');

// Match `vsce package --no-dependencies`, including .vscodeignore rules.
async function createTestExtensionCopy(cwd = path.resolve(__dirname, '..')) {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'urdf-extension-test-'));
    const cleanup = () => fs.rmSync(temporary, { recursive: true, force: true });
    try {
        const extensionDevelopmentPath = path.join(temporary, 'extension');
        const files = await listFiles({ cwd, packageManager: PackageManager.None });
        for (const file of files) {
            const destination = path.join(extensionDevelopmentPath, file);
            fs.mkdirSync(path.dirname(destination), { recursive: true });
            fs.copyFileSync(path.join(cwd, file), destination);
        }
        return {
            extensionDevelopmentPath,
            launchArgs: [
                '--user-data-dir', path.join(temporary, 'user-data'),
                '--extensions-dir', path.join(temporary, 'extensions'),
                '--skip-welcome', '--skip-release-notes', '--disable-workspace-trust',
            ],
            cleanup,
        };
    } catch (error) {
        cleanup();
        throw error;
    }
}

module.exports = { createTestExtensionCopy };
