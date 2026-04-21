"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
const vscode = __importStar(require("vscode"));
const xmldom_1 = require("xmldom");
const xacro_parser_instance_1 = require("../xacro-parser-instance");
const extension_utils_1 = require("../extension-utils");
// import * as myExtension from '../../extension';
suite("Extension Test Suite", () => {
    vscode.window.showInformationMessage("Start all tests.");
    test("Sample test", () => {
        assert.strictEqual(-1, [1, 2, 3].indexOf(5));
        assert.strictEqual(-1, [1, 2, 3].indexOf(0));
    });
    test("parses included xacro macros with text child nodes", async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "urdf-visualizer-xacro-"));
        const packageDir = path.join(tempDir, "xacro_test");
        const basePath = path.join(packageDir, "base.xacro");
        const complexPath = path.join(tempDir, "complex.xacro");
        fs.mkdirSync(packageDir, { recursive: true });
        fs.writeFileSync(basePath, `<?xml version="1.0"?>
<robot xmlns:xacro="http://www.ros.org/wiki/xacro">
  <xacro:macro name="base_box" params="name length width height color">
    <link name="\${name}">
      <visual>
        <geometry><box size="\${length} \${width} \${height}" /></geometry>
        <material name="\${color}" />
      </visual>
    </link>
  </xacro:macro>
  <xacro:macro name="base_sphere" params="name radius color">
    <link name="\${name}">
      <visual>
        <geometry><sphere radius="\${radius}" /></geometry>
        <material name="\${color}" />
      </visual>
    </link>
  </xacro:macro>
</robot>`, "utf8");
        fs.writeFileSync(complexPath, `<?xml version="1.0"?>
<robot xmlns:xacro="http://www.ros.org/wiki/xacro" name="complex_robot">
    <xacro:include filename="$(find xacro_test)/base.xacro" />
    <xacro:base_box name="box1" length="1.0" width="0.5" height="0.5" color="red" />
    <xacro:base_box name="box2" length="1.5" width="0.7" height="0.7" color="blue" />
    <xacro:base_sphere name="sphere1" radius="0.4" color="green" />
    <joint name="box1_to_box2" type="fixed">
        <parent link="box1" />
        <child link="box2" />
        <origin xyz="0 0 0.75" rpy="0 0 0" />
    </joint>
    <joint name="box2_to_sphere" type="continuous">
        <parent link="box2" />
        <child link="sphere1" />
        <origin xyz="0 0 0.85" rpy="0 0 0" />
        <axis xyz="0 0 1" />
        <limit effort="100" velocity="1" />
    </joint>
</robot>`, "utf8");
        xacro_parser_instance_1.xacroParser.workingPath = tempDir;
        xacro_parser_instance_1.xacroParser.rospackCommands = {
            find: (pkg) => path.join(tempDir, pkg),
        };
        try {
            const result = await xacro_parser_instance_1.xacroParser.parse(fs.readFileSync(complexPath, "utf8"));
            const serialized = new xmldom_1.XMLSerializer().serializeToString(result);
            assert.match(serialized, /<link name="box1">/);
            assert.match(serialized, /<box size="1.0 0.5 0.5"\/>/);
            assert.match(serialized, /<link name="sphere1">/);
            assert.match(serialized, /<joint name="box2_to_sphere" type="continuous">/);
        }
        finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
    test("serializes computed macro text nodes", async () => {
        const result = await xacro_parser_instance_1.xacroParser.parse(`<?xml version="1.0"?>
<robot xmlns:xacro="http://www.ros.org/wiki/xacro">
  <xacro:macro name="joint_value" params="q1">
    <link name="computed">\${q1 + 1}</link>
  </xacro:macro>
  <xacro:joint_value q1="0" />
</robot>`);
        const serialized = new xmldom_1.XMLSerializer().serializeToString(result);
        assert.match(serialized, /<link name="computed">1<\/link>/);
    });
    test("extracts package names from urdf text", () => {
        const urdfText = `<?xml version="1.0"?>
<robot name="test_robot">
  <link name="base">
    <visual>
      <geometry>
        <mesh filename="package://ur_robot/meshes/base.stl" />
      </geometry>
    </visual>
    <collision>
      <geometry>
        <mesh filename="package://ur_robot/meshes/base_collision.stl" />
      </geometry>
    </collision>
  </link>
  <link name="tool">
    <visual>
      <geometry>
        <mesh filename="package://gripper_pkg/meshes/tool.stl" />
      </geometry>
    </visual>
  </link>
</robot>`;
        assert.deepStrictEqual((0, extension_utils_1.extractPackageNamesFromUrdf)(urdfText), [
            "ur_robot",
            "gripper_pkg",
        ]);
    });
    test("finds missing packages referenced by urdf text", () => {
        const urdfText = `<?xml version="1.0"?>
<robot name="test_robot">
  <link name="base">
    <visual>
      <geometry>
        <mesh filename="package://ur_robot/meshes/base.stl" />
      </geometry>
    </visual>
  </link>
  <link name="tool">
    <visual>
      <geometry>
        <mesh filename="package://gripper_pkg/meshes/tool.stl" />
      </geometry>
    </visual>
  </link>
</robot>`;
        assert.deepStrictEqual((0, extension_utils_1.findMissingPackagesInUrdf)(urdfText, {
            ur_robot: "/workspace/src/ur_robot",
        }), ["gripper_pkg"]);
    });
    test("extracts missing package name from URDFLoader error message", () => {
        assert.strictEqual((0, extension_utils_1.extractMissingPackageFromErrorMessage)("URDFLoader : ur_robot not found in provided package list."), "ur_robot");
    });
});
//# sourceMappingURL=extension.test.js.map