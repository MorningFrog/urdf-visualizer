const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { createTestExtensionCopy } = require('./test-extension-copy.cjs');

test('VS Code metadata writes are isolated in the packaged extension copy', async () => {
    const originalPath = path.resolve(__dirname, '../package.json');
    const original = fs.readFileSync(originalPath);
    const first = await createTestExtensionCopy();
    let second;
    try {
        second = await createTestExtensionCopy();
        assert.notEqual(first.extensionDevelopmentPath, second.extensionDevelopmentPath);
        assert.notDeepEqual(first.launchArgs, second.launchArgs);
        const manifest = path.join(first.extensionDevelopmentPath, 'package.json');
        assert.deepEqual(fs.readFileSync(manifest), original);
        const modified = JSON.parse(original);
        modified.__metadata = { id: 'simulated-vscode-metadata' };
        fs.writeFileSync(manifest, JSON.stringify(modified, null, '\t'));
        assert.deepEqual(fs.readFileSync(originalPath), original);
        assert.deepEqual(fs.readFileSync(path.join(second.extensionDevelopmentPath, 'package.json')), original);
        assert.ok(fs.existsSync(path.join(first.extensionDevelopmentPath, 'dist/extension.js')));
        assert.ok(fs.existsSync(path.join(first.extensionDevelopmentPath, 'webview/dist/index.html')));
        for (const excluded of ['node_modules', 'src', 'out', 'scripts']) {
            assert.equal(fs.existsSync(path.join(first.extensionDevelopmentPath, excluded)), false);
        }
    } finally {
        first.cleanup();
        second?.cleanup();
    }
    assert.equal(fs.existsSync(first.extensionDevelopmentPath), false);
});
