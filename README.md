<div align="center"> 
<img src="./media/URDF-Visualizer-banner.jpg" alt="icon"/>

<h1>Urdf Visualizer</h1>

English / [简体中文](./README_zh-CN.md)

A VSCode extension for visualizing URDF files and xacro files.

用于可视化 URDF 和 xacro 文件的 VSCode 扩展.

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

## Operating Instructions

- Rotate perspective: Hold down the left mouse button and drag in the blank space
- Moving perspective: Hold down the right mouse button and drag
- Rotate/Move Joint: Hold down the left mouse button and drag on the link directly connected to the joint

## Install

There are three installation methods:
- Search for "URDF Visualizer" in VSCode extensions and install it
- In VSCode, use `Ctrl+Shift+P` to open the Command Panel and enter `ext install morningfrog.urdf-visualizer`
- Download the `.vsix` file in the Release of the repository, then select `Install from VISX` in the upper right corner of the VSCode extension, and choose the downloaded `.vsix` file for installation


有三种安装方式:
- 在 VSCode 的扩展中搜索 URDF Visualizer 并安装
- 在 VSCode 中使用 `Ctrl+Shift+P` 打开命令栏, 输入 `ext install morningfrog.urdf-visualizer`
- 在该仓库的 Release 中下载 `.vsix` 文件, 然后在 VSCode 的扩展右上角选择 "从VISX安装", 选择下载的 `.vsix` 文件进行安装

## Release Notes

### 1.0.0

Initial release of URDF Visualizer.
