<div align="center"> 
<img src="./media/URDF-Visualizer-banner.jpg" alt="icon"/>

<h1>Urdf Visualizer</h1>

[English](./README.md) / 简体中文

A VSCode extension for visualizing URDF files and xacro files.

用于可视化 URDF 和 xacro 文件的 VSCode 扩展.

![License](https://img.shields.io/github/license/MorningFrog/urdf-visualizer?color=blue)
![Installs](https://img.shields.io/visual-studio-marketplace/i/morningfrog.urdf-visualizer?color=blue)
![Downloads](https://img.shields.io/visual-studio-marketplace/d/morningfrog.urdf-visualizer?color=blue)
![Rating](https://img.shields.io/visual-studio-marketplace/r/morningfrog.urdf-visualizer?color=blue)
![Version](https://img.shields.io/github/package-json/v/MorningFrog/urdf-visualizer?color=blue)
![Stars](https://img.shields.io/github/stars/MorningFrog/urdf-visualizer?style=social)
</div>

## 特性

![demonstration](media/demonstration.gif)

- URDF 和 Xacro 文件的可视化
- 切换 visual 和/或 collision 的显示
- 可视化 joint 和/或 link 坐标系
- 鼠标悬浮时显示 joint 名称
- 能直接拖动控制关节角度

## 扩展设置

该扩展包括以下设置:

- `urdf-visualizer.packages`: ROS/ROS2 功能包的根目录, 用于定位 URDF/Xacro 文件中的 `package://<package_name>` 路径. 建议在工作空间的 `.vscode/settings.json` 中设置, 为一个对象, key 为功能包名称, value 为其路径, 例:
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
  > [!NOTE]
  > 当前只支持 `${workspaceFolder}` 和 `${env:<environment_variables>}` 作为特殊符号出现在路径中: 
  > - `${workspaceFolder}` 表示工作空间路径
  > - `${env:<environment_variables>}` 表示环境变量 `<environment_variables>` 的值
- `urdf-visualizer.renderOnSave`: 是否在文件保存时自动重新渲染.
- `urdf-visualizer.reRenderWhenSwitchFile`: 是否在激活的文件切换时自动重新渲染.
- `urdf-visualizer.backgroundColor`: 设置背景颜色, 需要为 `#` 开头的十六进制颜色代码.

## 说明

> [!IMPORTANT]
> 在文件夹下打开 VSCode, 文件夹下应当包含 URDF/Xacro 文件所需的所有资源文件. 仅用 VSCode 打开单个文件会让其找不到 mesh 文件.

操作:
- 转动视角: 在空白处按住鼠标左键并拖动
- 移动视角: 按住鼠标右键拖动
- 转动/移动关节: 在关节直接连接的link上按住鼠标左键并拖动 

## 安装

有三种安装方式:
- 在 VSCode 的扩展中搜索 URDF Visualizer 并安装.
- 在 VSCode 中使用 `Ctrl+Shift+P` 打开命令栏, 输入 `ext install morningfrog.urdf-visualizer`.
- 在该仓库的 Release 中下载 `.vsix` 文件, 然后在 VSCode 的扩展右上角选择 "从VISX安装", 选择下载的 `.vsix` 文件进行安装.


## Release Notes

### 2.0.6

增加了失败时的提示

### 2.0.5

修复了容器中加载 mesh 文件的问题 (在 Docker 容器中测试通过).

### 2.0.4

修复了在 Windows 系统上打开 mesh 文件的问题.

### 2.0.3

修复了 mesh 文件中包含其他文件时无法加载的问题.

### 2.0.2

修复了部分已知问题, 如 `urdf-visualizer.packages` 包含 `${workspaceFolder}` 的问题.

### 2.0.1

修复关节轴能被拖动导致难以选中某些link的问题.

### 2.0.0

添加了关节角度的可视化.

### 1.0.0

Initial release of URDF Visualizer.
