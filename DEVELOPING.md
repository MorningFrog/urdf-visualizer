# Developing

## 开发环境

- 操作系统：Linux / Windows / MacOS
- 编辑器：VSCode
- 必要工具:
    - Node.js 22 LTS（使用 `.nvmrc`，建议安装该分支最新补丁版本）
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
   ```

   根项目的 `postinstall` 会安装前端依赖，无需重复安装。CI 或需要严格复现锁文件时使用：

   ```bash
   npm run ci:install
   ```

   该命令先运行根项目 `npm ci --ignore-scripts`，再显式运行 `webview` 的 `npm ci`，
   避免根项目 `postinstall` 对前端运行 `npm install`。前端安装仍执行其必要的安装脚本。

4. 编译扩展:

   ```bash
   npm run compile
   ```

5. 测试扩展：在 VSCode 中按 `F5` 启动扩展开发主机进行测试。如果更新了代码，可以通过在测试主机中按 `Ctrl+R` (或 `Cmd+R` 在 MacOS 上) 来重新加载扩展。

自动化验证：

```bash
npm test -- --code-version stable
npm run test:smoke -- 1.70.0
npm run audit:all
npm run vscode:package -- --out urdf-visualizer.vsix
```

`npm test` 会构建前端、扩展及测试并执行 lint；单独运行 smoke 前需要先完成 `npm test` 的构建步骤。
Linux 无显示器环境使用 `xvfb-run -a` 包装 VS Code 测试命令。
构建与完整测试工具要求 Node.js 22；扩展最低支持版本仍为 VS Code 1.70。
最低版本 smoke 不加载 Mocha，以免把开发工具的 Node.js 要求带入旧扩展宿主。
smoke 检查扩展激活、Xacro/YAML 解析、错误拒绝和预览 Webview 创建；图形渲染、材质和交互仍需浏览器或人工回归。

如果本地已有 `urdf-visualizer-test` 模型集合，可额外验证其中的 Xacro 文件：

```bash
URDF_VISUALIZER_FIXTURES=/path/to/urdf-visualizer-test npm test -- --code-version stable
```

此测试读取模型集合的 `.vscode/settings.json` 包映射，不修改模型或设置。
对集合内已知的缺失外部包、缺失参数及越界 YAML 案例验证预期错误；其他 Xacro 必须成功解析并严格序列化。
安全维护和依赖 override 的原因见 [SECURITY.md](SECURITY.md)。

## 提交与发布规范

从 `5.2.0` 版本开始，提交信息使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范，例如:

```text
feat: add inertia visualization
fix: preserve inline code in release notes
docs: update developing guide
```

从 `5.2.0` 版本开始，Git tag 使用带 `v` 前缀的版本号，例如 `v5.2.0`，而不是以前的 `5.2.0`。
