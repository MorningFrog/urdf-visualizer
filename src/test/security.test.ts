import * as assert from "assert";
import { execFileSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { DOMImplementation, XMLSerializer } from "@xmldom/xmldom";
import { xacroParser, setLoadYamlWorkspaceRootsForTests } from "../xacro-parser-instance";

suite("Parser security", () => {
    test("rejects malformed XML instead of recovering a partial model", async () => {
        for (const source of [
            '<robot><link></robot>',
            '<robot/><robot/>',
            '<robot name="unescaped < text"/>',
            '<robot name=unquoted/>',
        ]) {
            await assert.rejects(() => xacroParser.parse(source));
        }
    });

    test("strict serialization rejects injected names and control characters", () => {
        const impl = new DOMImplementation();
        const serializer = new XMLSerializer();
        const doc = impl.createDocument(null, "robot", null);
        const serialize = () => serializer.serializeToString(doc, { requireWellFormed: true });
        const root = doc.documentElement!;
        const invalidElement = doc.createElement('link><injected/');
        root.appendChild(invalidElement);
        assert.throws(serialize);
        root.removeChild(invalidElement);

        root.setAttribute('a><injected/', 'x');
        assert.throws(serialize);
        root.removeAttribute('a><injected/');
        const pi = doc.createProcessingInstruction('a?><injected/><?b', '');
        root.appendChild(pi);
        assert.throws(serialize);
        root.removeChild(pi);
        assert.throws(() => impl.createDocumentType('robot><injected/', '', ''));
        const doctype = impl.createDocumentType('robot', '', '');
        Object.defineProperty(doctype, "name", { value: 'robot><injected/' });
        doc.insertBefore(doctype, root);
        assert.throws(serialize);
        doc.removeChild(doctype);
        root.appendChild(doc.createTextNode('\u0001'));
        assert.throws(serialize);
    });

    test("bounds hostile XML and YAML in a subprocess", function () {
        this.timeout(15000);
        const output = execFileSync(process.execPath, [
            "--max-old-space-size=192",
            path.resolve(__dirname, "../../scripts/check-parser-resources.cjs"),
        ], {
            env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
            timeout: 10000,
            encoding: "utf8",
        });
        assert.match(output, /XML resource checks passed/);
        assert.match(output, /YAML resource checks passed/);
    });

    test("preserves YAML merges and own properties while rejecting prototype access", async () => {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), "urdf-security-"));
        const previousPath = xacroParser.workingPath;
        fs.writeFileSync(path.join(directory, "config.yaml"),
            'base: &base {joint: 2}\ncfg: {<<: *base, positions: [1, 3], label: arm}\n');
        setLoadYamlWorkspaceRootsForTests([directory]);
        xacroParser.workingPath = directory;
        const parse = (expression: string) => xacroParser.parse(`<robot xmlns:xacro="http://www.ros.org/wiki/xacro">
            <xacro:property name="data" value="\${xacro.load_yaml('config.yaml')}"/>
            <link name="\${${expression}}"/>
        </robot>`);
        try {
            const doc = await parse("data.cfg.joint + data['cfg'].positions[1] + data.cfg.label.length");
            assert.equal(doc.getElementsByTagName("link")[0].getAttribute("name"), "8");
            for (const expression of [
                "data['__proto__']", "data.cfg.constructor", "data['cfg']['prototype']",
                "data['cfg']['con' + 'structor']", "data.cfg.toString", "data.cfg.positions['constructor']",
            ]) {
                await assert.rejects(() => parse(expression), /Unsafe Xacro property|Unknown Xacro property|prototype access/);
            }
        } finally {
            xacroParser.workingPath = previousPath;
            setLoadYamlWorkspaceRootsForTests(null);
            fs.rmSync(directory, { recursive: true, force: true });
        }
    });
});
