# DSH Omni 工作流 0.4.0 验收记录

日期：2026-09-28。宿主：DSH Omni 2.0.15-next，DSH 运行时 0.1.7-rc.2。
集成源码：`vendor/dsh-plugin-workflow/`；基础提交 `32687589cd2f63c6d257d13284b569c5f66e5e85`，功能源码来自该提交上的本地开发快照。

## 构建与安装

- `npm run build`：客户端产物构建完成。
- `npm test`：72 项通过，覆盖条件分支、脚本步骤、Multithread 与运行恢复。
- `node scripts/verify.mjs --home ~/.dsh-omni --profile desktop --app '/Applications/DSH Omni.app'`：16 个插件从 profile 解析，零警告。
- Omni profile 安装 `dsh-plugin-workflow` 0.4.0，客户端产物与集成源码的 SHA-256 一致。
- 工作流数据库保留原路径；升级前备份的数据库校验值与原文件一致。

## 桌面验收

通过 Computer Use 启动 DSH Omni，工作流面板显示两条已有工作流。打开「论文精读」后，编辑器显示已发布版本与五个步骤。

- 选中生成步骤时，步骤面板显示「模型」设置，包含 Provider、Model 与推理强度。
- 双击流程图中的「原文与证据」名称，进入原位文本输入；按 Escape 退出编辑，名称保持原值。
- 「更多步骤」显示工具、条件、汇合、子工作流、确认、发布、脚本和 Multithread。
- 关闭步骤选择器后，原有定义仍显示已保存状态。

本次桌面验收覆盖插件加载、已有定义读取、编辑器显示、名称编辑入口和步骤选择器。脚本与并发步骤的执行通过单元测试验证。
