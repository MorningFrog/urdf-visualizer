# Change Log

## [4.6.1]

修复:

Fixed:

- 恢复 STL 文件的颜色显示

  Restore color display of STL files

## [4.6.0]

增加:

Added:

- 支持 mesh 缓存, 加速同一资源文件的加载

  Support for Mesh caching to speed up loading for the same resource files

- `urdf-visualizer.cacheMesh` 设置: 是否使用 mesh 缓存

  `urdf-visualizer.cacheMesh` setting: enable/disable mesh caching

## [4.5.1]

修复:

Fixed:

- 当 Joint 名称中出现 `.` 时列表无法显示

  The list fails to display when there is a `.` in the Joint name

## [4.5.0]

增加:

Added:

- 支持更多数学表达式

  Support for more mathematical expressions

优化:

Improved:

- 找不到包时的提示更友好

  More user-friendly prompts when packages are not found

## [4.4.0]

增加:

Added:

- 鼠标悬停时强制顶端高亮显示 joint 坐标系或/和 link 坐标系(默认显示 joint 坐标系)

  Force highlighting of joint frames or/and link frames (joint frames shown by default) when hovering.

- `urdf-visualizer.highlightJointWhenHover` 和 `urdf-visualizer.highlightLinkWhenHover` 可用于设置鼠标悬停时强制顶端高亮显示 joint 坐标系或/和 link 坐标系

  `urdf-visualizer.highlightJointWhenHover` and `urdf-visualizer.highlightLinkWhenHover` can be used to configure whether to force highlighting of joint frames or/and link frames when hovering.

优化:

Improved:

- `urdf-visualizer.packages` 可以直接使用相对路径，不再需要添加 `${workspaceFolder}`

  `urdf-visualizer.packages` now supports relative paths directly, eliminating the need to add `${workspaceFolder}`.

- 优化坐标系的显示，使其根据模型尺度自动调整尺寸

  Optimized the display of coordinate frames, automatically adjusting their size based on the model scale. 

- 优化关节的显示和调节

  Improved the display and adjustment of joints. 

## [4.3.4]

修复:

Fixed:

- Bug: Cannot load mesh files using `file://$(find <package_name>)` syntax in xacro files ([Issue#14](https://github.com/MorningFrog/urdf-visualizer/issues/14))
  
  Bug: Xacro 文件中 Mesh 使用 `file://$(find <package_name>)` 无法正常加载资源 ([Issue#14](https://github.com/MorningFrog/urdf-visualizer/issues/14))

## [4.3.3]

修复:

Fixed:

- Bug: 第一次打开时有时不会加载模型
  
  Bug: Sometimes the model does not load when opened for the first time

## [4.3.2]

增加:

Added: 

- 部分选项的提示
  
  Tooltips for certain options

- Joint 的轴显示

  Display for Joint axis

优化:

Improved: 

- Joint 和 Link 坐标系分别采用实线和虚线以加以区分

  Differentiated Joint and Link coordinate frames with solid and dashed lines, respectively

- 鼠标悬停在模型上时高亮对应的 Joint 和 Link 坐标系

  Highlighted corresponding Joint and Link coordinate frames when hovering over the model

修复:

Fixed:

- Bug: 初次打开时 Collider 意外得可操作(即使没有显示)

  Bug: Colliders were unintentionally interactive upon initial launch

## [4.3.1]

增加:

Added:

- 坐标值的测量
  
  Measurement of coordinate values

优化:

Improved:

- 测量角度的显示

  The display of measured angle

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