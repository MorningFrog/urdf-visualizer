<div align="center"> 
<img src="./media/URDF-Visualizer-banner.jpg" alt="icon"/>

# Urdf Visualizer

English / [简体中文](./README_zh-CN.md)

<p>A VSCode extension for visualizing URDF files and xacro files.</p>

<p>用于可视化 URDF 和 xacro 文件的 VSCode 扩展.</p>

![License](https://img.shields.io/github/license/MorningFrog/urdf-visualizer?color=blue)
![Installs](https://img.shields.io/visual-studio-marketplace/i/morningfrog.urdf-visualizer?color=blue)
![Downloads](https://img.shields.io/visual-studio-marketplace/d/morningfrog.urdf-visualizer?color=blue)
![Rating](https://img.shields.io/visual-studio-marketplace/r/morningfrog.urdf-visualizer?color=blue)
![Version](https://img.shields.io/github/package-json/v/MorningFrog/urdf-visualizer?color=blue)
![Stars](https://img.shields.io/github/stars/MorningFrog/urdf-visualizer?style=social)
</div>

## Features

![demonstration](media/demonstration.gif)

- Visualization of URDF and Xacro files
- Switch the display of visual and/or collision
- Visualize joint and/or link coordinate systems
- Display the joint name when hovering the mouse
- Drag and control joint angles

## Extension Settings

This extension contributes the following settings:

- `urdf-visualizer.packages`: The root directory of ROS/ROS2 packages, used to resolve the `package://<package_name>` paths in URDF/Xacro files. It is recommended to set this in the `.vscode/settings.json` of your workspace as an object, where the key is the package name and the value is its path. Example:
  ```json
  // settings.json
  {
    // other settings
    "urdf-visualizer.packages": {
        "fake_robot": "${workspaceFolder}/src/fake_robot"
    },
    // other settings
  }
  ```
- `urdf-visualizer.renderOnSave`: Whether to automatically re-render when the file is saved.
- `urdf-visualizer.reRenderWhenSwitchFile`: Whether to automatically re-render when switching between active files.
- `urdf-visualizer.backgroundColor`: Set the background color; it needs to be a hexadecimal color code starting with `#`.

## Release Notes

### 1.0.0

Initial release of URDF Visualizer.
