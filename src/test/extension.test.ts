import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
import { XMLSerializer } from "xmldom";
import {
  extractMissingPackageFromErrorMessage,
  extractPackageNamesFromUrdf,
  findMissingPackagesInUrdf,
} from "../extension-utils";
import { xacroParser } from "../xacro-parser-instance";
// import * as myExtension from '../../extension';

suite("Extension Test Suite", () => {
    vscode.window.showInformationMessage("Start all tests.");

    test("Sample test", () => {
        assert.strictEqual(-1, [1, 2, 3].indexOf(5));
        assert.strictEqual(-1, [1, 2, 3].indexOf(0));
    });

    test("parses included xacro macros with text child nodes", async () => {
        const tempDir = fs.mkdtempSync(
            path.join(os.tmpdir(), "urdf-visualizer-xacro-")
        );
        const packageDir = path.join(tempDir, "xacro_test");
        const basePath = path.join(packageDir, "base.xacro");
        const complexPath = path.join(tempDir, "complex.xacro");

        fs.mkdirSync(packageDir, { recursive: true });

        fs.writeFileSync(
            basePath,
            `<?xml version="1.0"?>
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
</robot>`,
            "utf8"
        );

        fs.writeFileSync(
            complexPath,
            `<?xml version="1.0"?>
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
</robot>`,
            "utf8"
        );

        xacroParser.workingPath = tempDir;
        xacroParser.rospackCommands = {
            find: (pkg: string) => path.join(tempDir, pkg),
        };

        try {
            const result = await xacroParser.parse(
                fs.readFileSync(complexPath, "utf8")
            );
            const serialized = new XMLSerializer().serializeToString(result);

            assert.match(serialized, /<link name="box1">/);
            assert.match(serialized, /<box size="1.0 0.5 0.5"\/>/);
            assert.match(serialized, /<link name="sphere1">/);
            assert.match(
                serialized,
                /<joint name="box2_to_sphere" type="continuous">/
            );
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test("serializes computed macro text nodes", async () => {
        const result = await xacroParser.parse(`<?xml version="1.0"?>
<robot xmlns:xacro="http://www.ros.org/wiki/xacro">
  <xacro:macro name="joint_value" params="q1">
    <link name="computed">\${q1 + 1}</link>
  </xacro:macro>
  <xacro:joint_value q1="0" />
</robot>`);

        const serialized = new XMLSerializer().serializeToString(result);

        assert.match(serialized, /<link name="computed">1<\/link>/);
    });

    test("evaluates comparison operators (compound and standalone) after xacro-tokenizer whitespace fragmentation", async () => {
        const result = await xacroParser.parse(`<?xml version="1.0"?>
<robot xmlns:xacro="http://www.ros.org/wiki/xacro">
  <xacro:macro name="cmp_test" params="n">
    <!-- compound operators: fragmented by xacro-parser's tokenizer -->
    <xacro:property name="ge" value="\${n >= 14}" />
    <xacro:property name="le" value="\${n <= 14}" />
    <xacro:property name="eq" value="\${n == 15}" />
    <xacro:property name="ne" value="\${n != 14}" />
    <!-- standalone operators: > and < aren't in xacro-parser's operator regex,
         so they stay glued; included to confirm we don't regress them -->
    <xacro:property name="gt" value="\${n > 14}" />
    <xacro:property name="lt" value="\${n < 14}" />
    <link name="cmp_\${ge}_\${le}_\${eq}_\${ne}_\${gt}_\${lt}" />
  </xacro:macro>
  <xacro:cmp_test n="15" />
</robot>`);

        const serialized = new XMLSerializer().serializeToString(result);
        // n=15:  15>=14=T  15<=14=F  15==15=T  15!=14=T  15>14=T  15<14=F
        assert.match(
            serialized,
            /<link name="cmp_true_false_true_true_true_false"\s*\/>/
        );
    });

    test("implements xacro.load_yaml() and supports deep dict indexing", async () => {
        const tempDir = fs.mkdtempSync(
            path.join(os.tmpdir(), "urdf-visualizer-yaml-")
        );
        const yamlPath = path.join(tempDir, "initial_positions.yaml");

        fs.writeFileSync(
            yamlPath,
            "uf850:\n  joint1: 1.23\n  joint2: -0.5\n",
            "utf8"
        );

        try {
            const result = await xacroParser.parse(`<?xml version="1.0"?>
<robot xmlns:xacro="http://www.ros.org/wiki/xacro">
  <xacro:property name="initial_positions_file" value="${yamlPath}" />
  <xacro:property name="initial_positions" value="\${xacro.load_yaml(initial_positions_file)}" />
  <link name="j1_\${initial_positions['uf850']['joint1']}_j2_\${initial_positions['uf850']['joint2']}" />
</robot>`);

            const serialized = new XMLSerializer().serializeToString(result);
            assert.match(serialized, /<link name="j1_1\.23_j2_-0\.5"\s*\/>/);
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test("evaluates Python len() in xacro expressions", async () => {
        const result = await xacroParser.parse(`<?xml version="1.0"?>
<robot xmlns:xacro="http://www.ros.org/wiki/xacro">
  <xacro:macro name="len_test" params="robot_sn">
    <xacro:property name="sn_len" value="\${len(robot_sn)}" />
    <link name="len_\${sn_len}" />
  </xacro:macro>
  <xacro:len_test robot_sn="XI1304000000000" />
</robot>`);

        const serialized = new XMLSerializer().serializeToString(result);

        // len("XI1304000000000") = 15
        assert.match(serialized, /<link name="len_15"\s*\/>/);
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

        assert.deepStrictEqual(extractPackageNamesFromUrdf(urdfText), [
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

        assert.deepStrictEqual(
            findMissingPackagesInUrdf(urdfText, {
                ur_robot: "/workspace/src/ur_robot",
            }),
            ["gripper_pkg"]
        );
    });

    test("extracts missing package name from URDFLoader error message", () => {
        assert.strictEqual(
            extractMissingPackageFromErrorMessage(
                "URDFLoader : ur_robot not found in provided package list."
            ),
            "ur_robot"
        );
    });
});
