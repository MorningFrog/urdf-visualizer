# Change Log

## [2.0.5]

- 修复了容器中加载 mesh 文件的问题.

## [2.0.4]

- 修复了 Windows 系统下 mesh 文件路径问题.

## [2.0.3]

- 修复了 mesh 文件中包含其他文件时无法加载的问题.

## [2.0.2]

- 修复了 `urdf-visualizer.packages` 设置中包含 `${workspaceFolder}` 无法解析的问题
- 修复了 joint 名称中包含 `/` 导致无法创建关节列表的问题

## [2.0.1]

- 修复关节轴能被拖动导致难以选中某些link的问题

## [2.0.0]

- 增加了关节角度和范围的显示

## [1.0.0]

- 实现了基本的URDF显示功能
- 可以实现visual和/或collision的显示
- 可视化joint和link坐标系
- 鼠标悬浮时显示joint名称
- 启用了关节的拖动控制
- 实现了Xacro解析