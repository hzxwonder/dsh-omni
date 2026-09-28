# Prompt 模板

`dsh-plugin-prompt` 在 DeepSeek Harness Desktop 和 DSH Omni 的聊天输入框提供 `/prompt`。候选菜单列出保存的模板；选择模板将正文插入当前输入框，选择“新建 Prompt 模板”打开双栏管理窗口，可新建、修改、复制、删除模板。保存后的模板存放于当前 `DSH_HOME/desktop-prompts/prompts.json`，两款桌面应用各自使用自己的 DSH Home。

## 安装

将此仓库添加为 Desktop profile 的依赖和 bundle。插件通过 Cordis patch 加载 Host API 和客户端命令，无需修改应用源码或内置运行时。Node.js 24 或更高版本。

```json
{
  "dependencies": {
    "dsh-plugin-prompt": "github:hzxwonder-dsh-plugins/dsh-plugin-prompt"
  },
  "dsh": {
    "profile": {
      "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-plugin-prompt"]
    }
  }
}
```

现有 profile 请将 `dsh-plugin-prompt` 加入原有 `bundles` 数组。安装依赖并重启应用后，在会话输入框输入 `/prompt`。

## 开发

```sh
npm install
npm run build
npm test
```
