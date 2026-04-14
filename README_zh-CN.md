<div align="center"> 
<img src="./media/images/URDF-Visualizer-banner.jpg" alt="icon"/>

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

![demonstration](media/images/demonstration.gif)

- 预览与检查: 可视化 URDF 和 Xacro 文件，切换 visual/collision 显示，单独控制各个 Link 的可见性，并查看 joint/link 的名称与坐标系。
- 交互: 可在视图中直接拖动关节，在切换文件时保留视角，并可选恢复关节状态。
- 测量: 支持坐标值、距离、角度和面积测量，并可配置默认测量选项。
- 界面与本地化: 全新的 UI 设计，包含控制面板、Link 列表、Joint 列表和设置面板，并支持英语和简体中文。
  > 如果你需要更多语言支持, 可以在仓库的 Issue 中提出

## 扩展设置

这些设置按用途分组如下:

### 包路径解析

- `urdf-visualizer.packages`
  
  将 ROS/ROS2 功能包名称映射到本地目录, 用于解析 URDF/Xacro 文件中的 `package://<package_name>` 路径. 建议在工作空间的 `.vscode/settings.json` 中配置, 其中 **key 为功能包名称**, **value 为对应路径**, 例如:
  
  ```json
  // settings.json
  {
    // other settings
    "urdf-visualizer.packages": {
        "fake_robot": "src/fake_robot"
    },
    // other settings
  }
  ```
  等价于:
  ```json
  {
    // other settings
    "urdf-visualizer.packages": {
        "fake_robot": "${workspaceFolder}/src/fake_robot"
    },
    // other settings
  }
  ```

  支持的特殊路径变量:
  - `${workspaceFolder}` 表示工作空间路径
  - `${workspaceFolder:<workspace_name>}` 表示多根工作区(multi-root workspace)中某个工作空间的路径
  - `${env:<environment_variables>}` 表示环境变量 `<environment_variables>` 的值
  
  > 在 ≥4.4.0 的 URDF Visualizer 中可以直接使用相对路径表示相对于工作空间的路径, 无需 `${workspaceFolder}/` 前缀

### 重渲染与缓存

- `urdf-visualizer.renderOnSave`: 保存当前文件时重新渲染.

- `urdf-visualizer.reRenderWhenSwitchFile`: 切换活动文件时重新渲染.

- `urdf-visualizer.cacheCameraView`: 为每个文件缓存并恢复相机视角.

- `urdf-visualizer.cacheJointValues`: 为每个文件缓存并恢复关节值状态.

- `urdf-visualizer.cacheMesh`: 缓存 mesh 资源, 加快重复加载速度.

### 默认预览状态

所有 `urdf-visualizer.default.*` 都用于定义新打开预览时的初始状态, 之后仍可在 webview UI 中继续调整.

- 几何体与坐标系: `urdf-visualizer.default.showVisual`, `urdf-visualizer.default.showCollision`, `urdf-visualizer.default.showWorldFrame`, `urdf-visualizer.default.showJointFrames`, `urdf-visualizer.default.jointFrameSize`, `urdf-visualizer.default.showLinkFrames`, `urdf-visualizer.default.linkFrameSize`

- 单位与颜色: `urdf-visualizer.default.lengthUnit`, `urdf-visualizer.default.angleUnit`, `urdf-visualizer.default.collisionColor`

- 测量默认值: `urdf-visualizer.default.measurement.precision`, `urdf-visualizer.default.measurement.useSciNotation`, `urdf-visualizer.default.measurement.labelSize`, `urdf-visualizer.default.measurement.labelColor`, `urdf-visualizer.default.measurement.lineColor`, `urdf-visualizer.default.measurement.lineThickness`, `urdf-visualizer.default.measurement.pointColor`, `urdf-visualizer.default.measurement.pointSize`, `urdf-visualizer.default.measurement.surfaceColor`

### 外观与交互

- `urdf-visualizer.backgroundColor`: 设置 3D 视图背景颜色, 需要是以 `#` 开头的十六进制颜色值.

- `urdf-visualizer.showTips`: 显示或隐藏操作提示.

- `urdf-visualizer.highlightJointWhenHover`: 鼠标悬停时在顶部高亮显示 joint 坐标系.

- `urdf-visualizer.highlightLinkWhenHover`: 鼠标悬停时在顶部高亮显示 link 坐标系.

## 说明

> [!IMPORTANT]
> 请在包含 URDF/Xacro 所需资源文件的文件夹中打开 VSCode. 如果只单独打开一个 URDF/Xacro 文件, 可能无法正确找到 mesh 资源.

有两种方式开始预览 URDF 或 Xacro 文件:
- 在 VSCode 中使用 `Ctrl+Shift+P` 打开命令栏, 选择 `URDF Visualizer: Preview URDF/Xacro`
- 单击文件右上角的 <img src="media/images/view_icon.png" alt="view icon" style="height:1em; vertical-align:middle;"> 按钮
> 两种操作都要求 URDF/Xacro 文件处于激活状态

操作:
- 视角控制: 在空白处按住鼠标左键拖动可旋转视角, 按住鼠标右键拖动可平移视角.
- 关节控制: 在与关节直接连接的 link 上按住鼠标左键并拖动.
- 测量: 单击右上角四个按钮中的一个, 开始测量坐标值、距离、角度或面积.

![measure](media/images/measure.gif)

## 安装

有三种安装方式:
- 在 VSCode 的扩展中搜索 URDF Visualizer 并安装.
- 在 VSCode 中使用 `Ctrl+Shift+P` 打开命令栏, 输入 `ext install morningfrog.urdf-visualizer`.
- 在该仓库的 Release 中下载 `.vsix` 文件, 然后在 VSCode 的扩展右上角选择 "从 VSIX 安装", 选择下载的 `.vsix` 文件进行安装.


## 已知问题

- 面积测量时, 如果出现凹多边形, 面积结果可能错误.

## Release Notes

### 5.0

增加:

- 全新的 UI 设计
- 可以单独切换各个 Link 的显示状态
- 为预览和测量相关设置提供默认配置, 可通过 VSCode 设置调整
- 在切换文件时保留视角和关节角度状态(可通过 `urdf-visualizer.cacheCameraView` 和 `urdf-visualizer.cacheJointValues` 设置启用/禁用)
- xacro 解析支持 `**` 运算符(幂运算), 感谢 @IvanFan-Van (#19)

### 4.x

- 增加了多语言支持、操作提示显示开关、世界坐标系显示切换，以及侧边栏中更丰富的关节信息。
- 增强了模型检查能力，包括鼠标悬停名称显示、joint/link 坐标系显示与高亮、Joint 轴显示，以及坐标值测量。
- 扩展了测量功能，支持配置单位、精度、科学计数法以及标签和线条等样式设置。
- 优化了兼容性和易用性，包括支持相对包路径、更多数学表达式，以及更友好的包缺失提示。
- 增加了 mesh 缓存和相机视角缓存，改善模型加载速度和文件切换体验。

### 3.x

- 增加了距离/角度/面积的测量功能.
- 增加了操作提示.

### 2.x

- 添加了关节角度的可视化.
- 优化了扩展体验.

### 1.x

Initial release of URDF Visualizer.
