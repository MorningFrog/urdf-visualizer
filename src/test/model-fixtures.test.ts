import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { XMLSerializer } from "@xmldom/xmldom";
import { xacroParser, setLoadYamlWorkspaceRootsForTests } from "../xacro-parser-instance";

// Optional external model collection; CI's self-contained cases live in the
// other test suites. Never modify the user's fixture files or workspace settings.
const fixtureRoot = process.env.URDF_VISUALIZER_FIXTURES;
if (fixtureRoot) {
    suite("External Xacro models", () => {
        test("preserves supported models and expected missing-input/boundary errors", async function () {
            this.timeout(30000);
            const root = path.resolve(fixtureRoot);
            const settings = JSON.parse(fs.readFileSync(path.join(root, ".vscode/settings.json"), "utf8"));
            const packages = Object.fromEntries(Object.entries(settings["urdf-visualizer.packages"] as Record<string, string>)
                .map(([name, value]) => [name, path.resolve(root, value.replace("${workspaceFolder}", root))]));
            const files: string[] = [];
            const visit = (directory: string) => {
                for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
                    if (entry.name === ".git" || entry.name === "node_modules") {
                        continue;
                    }
                    const filename = path.join(directory, entry.name);
                    if (entry.isDirectory()) {
                        visit(filename);
                    } else if (entry.isFile() && filename.endsWith(".xacro")) {
                        files.push(filename);
                    }
                }
            };
            visit(root);
            assert.ok(files.length > 0, "Fixture directory contains Xacro files");
            const expectedErrors: Record<string, RegExp> = {
                "rm_description/urdf/rml_63_6fb_description.urdf.xacro": /ENOENT.*rml_63.transmission.xacro/,
                "xacro/ur.urdf.xacro": /Undefined substitution argument name/,
                "xacro/ur_macro.xacro": /Package "sr_description" not found/,
                "xacro/regression_cases/workspace_root/outside_workspace_blocked.urdf.xacro": /can only read files inside the current workspace/,
                "model_description/agv_arm_description/urdf/agv_panda.xacro": /Package "franka_panda_description" not found/,
                "model_description/agv_arm_description/urdf/agv_kinova.xacro": /Package "kinova_description" not found/,
                "model_description/agv_arm_description/urdf/agv_iiwa.xacro": /Package "kuka_barrett_description" not found/,
            };
            const previous = { workingPath: xacroParser.workingPath, arguments: xacroParser.arguments, rospackCommands: xacroParser.rospackCommands };
            let parsed = 0;
            let rejected = 0;
            try {
                for (const filename of files) {
                    const relative = path.relative(root, filename).split(path.sep).join("/");
                    setLoadYamlWorkspaceRootsForTests([relative.startsWith("xacro/regression_cases/")
                        ? path.join(root, "xacro/regression_cases/workspace_root") : root]);
                    xacroParser.workingPath = path.dirname(filename);
                    xacroParser.arguments = {};
                    xacroParser.rospackCommands = { find: (name: string) => {
                        if (!packages[name]) {
                            throw new Error(`Package "${name}" not found`);
                        }
                        return packages[name];
                    } };
                    const parse = () => xacroParser.parse(fs.readFileSync(filename, "utf8"));
                    if (expectedErrors[relative]) {
                        await assert.rejects(parse, expectedErrors[relative], relative);
                        rejected++;
                    } else {
                        const doc = await parse();
                        assert.equal(doc.documentElement?.tagName, "robot", relative);
                        assert.ok(new XMLSerializer().serializeToString(doc, { requireWellFormed: true }), relative);
                        parsed++;
                    }
                }
                console.log(`External fixtures: ${parsed} parsed, ${rejected} expected rejections`);
            } finally {
                Object.assign(xacroParser, previous);
                setLoadYamlWorkspaceRootsForTests(null);
            }
        });
    });
}
