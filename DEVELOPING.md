# Developing

## 开发环境

- 操作系统：Linux / Windows / MacOS
- 编辑器：VSCode
- 必要工具:
    - Node.js (推荐版本 16 及以上)
    - npm (Node.js 自带)

## 编译与测试

1. 克隆代码库到本地:

   ```bash
   git clone https://github.com/MorningFrog/urdf-visualizer.git
   ```

2. 进入项目目录:

   ```bash
   cd urdf-visualizer
   ```

3. 安装依赖:

   ```bash
   npm install
   npm --prefix webview install
   ```

4. 编译扩展:

   ```bash
   npm run compile
   ```

5. 测试扩展：在 VSCode 中按 `F5` 启动扩展开发主机进行测试。如果更新了代码，可以通过在测试主机中按 `Ctrl+R` (或 `Cmd+R` 在 MacOS 上) 来重新加载扩展。

