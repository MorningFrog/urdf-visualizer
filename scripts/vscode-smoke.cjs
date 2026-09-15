// No Mocha dependency: the extension host in VS Code 1.70 uses Node 16,
// while the maintained build/test tooling runs on the developer's Node 22.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vscode = require('vscode');

exports.run = async function () {
    const extension = vscode.extensions.getExtension('morningfrog.urdf-visualizer');
    assert.ok(extension, 'Extension is registered');
    await extension.activate();
    assert.ok(extension.isActive, 'Packaged extension entry point activates');

    const { xacroParser, setLoadYamlWorkspaceRootsForTests } = require('../out/xacro-parser-instance');
    const { XMLSerializer } = require('@xmldom/xmldom');
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'urdf-smoke-model-'));
    const previousPath = xacroParser.workingPath;
    try {
        setLoadYamlWorkspaceRootsForTests([directory]);
        xacroParser.workingPath = directory;
        fs.writeFileSync(path.join(directory, 'config.yaml'), 'joint: 2\n');
        const xacro = '<robot xmlns:xacro="http://www.ros.org/wiki/xacro" name="smoke">' +
            '<xacro:property name="cfg" value="${xacro.load_yaml(\'config.yaml\')}"/>' +
            '<link name="link_${cfg.joint}"/></robot>';
        const result = await xacroParser.parse(xacro);
        assert.match(new XMLSerializer().serializeToString(result, { requireWellFormed: true }), /link_2/);
        await assert.rejects(() => xacroParser.parse('<robot><link></robot>'));
        // Exercise the shipped command and Webview creation using ordinary URDF.
        const filename = path.join(directory, 'smoke.urdf');
        fs.writeFileSync(filename, '<robot name="smoke"><link name="base"><visual><geometry><box size="1 1 1"/></geometry></visual></link></robot>');
        await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(filename));
        await vscode.commands.executeCommand('urdf-visualizer.previewURDFXacro');
        const hasPreview = () => vscode.window.tabGroups.all.some(group => group.tabs.some(tab =>
            tab.input instanceof vscode.TabInputWebview));
        const deadline = Date.now() + 5000;
        while (!hasPreview() && Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        assert.ok(hasPreview(), 'Preview Webview was created');
        console.log(`URDF smoke passed on VS Code ${vscode.version}, Node ${process.versions.node}`);
    } finally {
        xacroParser.workingPath = previousPath;
        setLoadYamlWorkspaceRootsForTests(null);
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        fs.rmSync(directory, { recursive: true, force: true });
    }
};
