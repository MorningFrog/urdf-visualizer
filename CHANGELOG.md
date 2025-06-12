# Change Log

## [4.3.0]

增加:

Added:

- 坐标值的测量
  
  Measurement of coordinate values

修复:

Fixed:

- 测量时图标和功能的同步
  
  Synchronizing icons and functions during measurement

## [4.2.0]

- 在鼠标悬停时增加了 Link 名称的显示

  Added display of Link names when hovering.
- 修复以下 bug: 不论 Visual 和 Collider 是否显示, 都按照 Visual 来显示提示和进行操作
  
  Fix the bug: Operations and prompts always follow the Visual, ignoring Collider visibility.

## [4.1.2]

- 增加了世界坐标系的显示和隐藏的切换
  
  Added a toggle to show/hide the world frame.

## [4.1.1]

- 修复了 SSH remote server 中加载 mesh 的问题
  
  Fixed the issue of loading mesh in SSH remote server
- 优化了关节类型的显示
  
  Optimized the display of joint types

## [4.1.0]

- 侧边栏的 Joint 右侧增加类型提示.
  
  Add type prompts to the right of the Joint name in the sidebar.
- continuous 关节角度可以在 $-2\pi$-$2\pi$ 之间调节.
  
  The continuous joint angle can be adjusted from $-2\pi$ to $2\pi$.
- 使用更高版本的 `Three.js`, 这可能解决与Nvidia高版本驱动不相容的问题.
  
  Using a higher version of `Three.js`, it may solve the issue of incompatibility with Nvidia's higher version drivers.

## [4.0.1]

- 修复了 1.75 版本以下 VSCode 在 urdf 未被配置为 xml 时无法预览的问题.
  
  Fixed the issue where VSCode below version 1.75 cannot preview when urdf is not configured as XML.
- 优化了操作提示, 添加了切换操作提示显示与否的设置.
  
  Optimized the operation tips and added a setting to switch the display of operation tips.

## [4.0.0]

- 添加了多语言支持(i18n), 根据 VSCode 语言自动选择扩展语言
  
  Added multilingual support (i18n), automatically selecting extension languages based on VSCode language.

## [3.0.1]

- 更新 README 素材
  
  Update README images

## [3.0.0]

- 增加了距离、角度和面积的测量功能
  
  Add measurement functions for distance/angle/area.
- 增加了操作指示
  
  Add operation prompts

## [2.1.2]

- 预览窗口标题将显示文件名
  
  The title of the preview window will display the file name.

## [2.1.1]

- 坐标系的长度会自动匹配模型尺寸.
  
  The length of the coordinate system will automatically match the model size.

## [2.1.0]

- 视野范围将与模型尺寸相匹配.
  
  The field of view will match the size of the model.

## [2.0.6]

- 增加了失败时的提示
  
  Added failure prompt.

## [2.0.5]

- 修复了容器中加载 mesh 文件的问题.
  
  Fix the problem of loading mesh files in DevContainers (tested in Docker container).

## [2.0.4]

- 修复了 Windows 系统下 mesh 文件路径问题.
  
  Fix the problem of loading mesh files in Windows OS.

## [2.0.3]

- 修复了 mesh 文件中包含其他文件时无法加载的问题.
  
  Fix the problem of loading mesh files containing subfiles.

## [2.0.2]

- 修复了 `urdf-visualizer.packages` 设置中包含 `${workspaceFolder}` 无法解析的问题
  
  Fixed some known issues such as `urdf-visualizer.packages` containing `${workspaceFolder}`.
- 修复了 joint 名称中包含 `/` 导致无法创建关节列表的问题
  
  Fixed the issue with joint names contained `/`

## [2.0.1]

- 修复关节轴能被拖动导致难以选中某些link的问题
  
  Fix the problem of dragging of links while visualizing frames.

## [2.0.0]

- 增加了关节角度和范围的显示
  
  Add the visualization of joint angles.

## [1.0.0]

- 实现了基本的URDF显示功能
  
  Implemented basic URDF display functionality
- 可以实现visual和/或collision的显示
  
  Achieve visual and/or collision display
- 可视化joint和link坐标系
  
  Achieve joint frame and/or link frame display
- 鼠标悬浮时显示joint名称
  
  Display the joint name when hovering the mouse
- 启用了关节的拖动控制
  
  Joint drag control enabled
- 实现了Xacro解析
  
  Implemented Xacro parsing