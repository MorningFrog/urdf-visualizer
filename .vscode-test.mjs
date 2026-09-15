import { fileURLToPath } from 'node:url';
import { defineConfig } from '@vscode/test-cli';
import { createTestExtensionCopy } from './scripts/test-extension-copy.cjs';

const copy = await createTestExtensionCopy();
process.once('exit', copy.cleanup);
// VS Code must never write extension metadata into the source checkout.
export default defineConfig({
    files: 'out/test/**/*.test.js',
    extensionDevelopmentPath: copy.extensionDevelopmentPath,
    srcDir: fileURLToPath(new URL('./src', import.meta.url)),
    launchArgs: copy.launchArgs,
});
