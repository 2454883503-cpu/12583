# DSH 插件清单（本机实测）

- 运行版本：`0.2.0-rc.2`（`@deepseek-ai/dsh`，源码仓库 github.com/deepseek-ai/deepseek-harness）
- profile：`desktop`（另有 `web`），组合包：`@deepseek-ai/dsh-base` + `@deepseek-ai/dsh-web-app`
- 宿主面 loader 条目：**179** 条（base 94 + web-app 85）
- 用户 patch 层条目：**7** 条

> 数据来源：从 `app.asar` 解出的各 bundle `cordis.patch.yml`、本机 `%USERPROFILE%\.dsh\profiles\desktop\cordis.patch.yml`、以及 `dsh-app-boot` 中写死的 `OPTIONAL_BUNDLES` / `PROFILE_TEMPLATES`。

## 一、随装可选、默认关闭的 4 个官方组合包

| 组合包 | 作用 | 状态 |
|---|---|---|
| `@deepseek-ai/dsh-experimental-agent-team-profile` | Agent Teams：多智能体协作的工具、宿主能力与 Web 界面 | 随安装提供、默认关闭、可在插件页开启，不可卸载 |
| `@deepseek-ai/dsh-experimental-voice-input-bundle` | 本地 SenseVoice 语音输入（首次使用时下载运行时） | 随安装提供、默认关闭、可在插件页开启，不可卸载 |
| `@deepseek-ai/dsh-experimental-auto-review` | Auto 权限预设下的逐工具 LLM 授权复核 | 随安装提供、默认关闭、可在插件页开启，不可卸载 |
| `@deepseek-ai/dsh-experimental-schedule-bundle` | Schedule 定时任务页与 time context | 随安装提供、默认关闭、可在插件页开启，不可卸载 |

## 二、随安装提供的 profile 模板

| 模板 | 组合包 |
|---|---|
| `acp` | dsh-base + dsh-acp-app（编辑器 ACP 接入） |
| `web` | dsh-base + dsh-web-app（Web / 桌面载体现用） |
| `headless` | dsh-base + dsh-headless |
| `sdk` | dsh-base + dsh-sdk-app |
| `sdk-minimal` | dsh-sdk-minimal |

## 三、智能体预设（agent preset，会话级插件组合）

| 预设 | 条目数 | 说明 |
|---|---|---|
| `standard` | 33 | 默认预设（`agent-preset-registry` 的 `default: standard`） |
| `ptc` | 34 | 带 PTC 运行时/工作流变体 |
| `minimal` | 8 | 最小工具面 |
| `cordis` | 34 | 完整编码态：bash/pwsh/fs/subagent/workflow/ralph 等 |

宿主面把工具行关掉、改由预设挂载（`dsh-web-app/cordis.patch.yml` 里成片的 `disabled: true` 就是这些行），所以同一台机器上不同会话可以有不同工具集。

## 四、宿主面插件明细（按能力分组）

### 工具（模型可用）（21）

| 条目 id | 模块 | 状态 |
|---|---|---|
| `cordis-inspect-providers` | `dsh-tool-cordis/host` | 启用 |
| `repeat-tool-reminder` | `dsh-repeat-tool-reminder` | 启用 |
| `subagent-model-selection-settings` | `dsh-tool-subagent/model-selection-settings` | 启用 |
| `timeout-policy` | `dsh-tool-call-timeout-policy` | 启用 |
| `tool-bash` | `dsh-tool-bash` | 条件（process.platform === 'win32'） |
| `tool-fs` | `dsh-tool-fs` | 启用 |
| `tool-fs-search` | `dsh-tool-fs-search` | 启用 |
| `tool-goal` | `dsh-tool-goal` | 启用 |
| `tool-jobs` | `dsh-tool-jobs` | 启用 |
| `tool-pwsh` | `dsh-tool-pwsh` | 条件（process.platform !== 'win32'） |
| `tool-ralph` | `dsh-tool-ralph` | 随包关闭 |
| `tool-result-pruner` | `dsh-compaction-tool-result-pruner` | 启用 |
| `tool-skill` | `dsh-tool-skill` | 启用 |
| `tool-subagent` | `dsh-tool-subagent` | 启用 |
| `tool-subagent-control` | `dsh-tool-subagent-control` | 启用 |
| `tool-subagent-fork` | `dsh-tool-subagent` | 启用 |
| `tool-subagent-list-agents` | `dsh-tool-subagent-control/list-agents` | 启用 |
| `tool-todo` | `dsh-tool-todo` | 启用 |
| `tool-web` | `dsh-tool-web` | 启用 |
| `tool-workflow` | `dsh-tool-workflow` | 启用 |
| `ui-tool` | `dsh-client-ui-tool` | 启用 |

### 智能体能力（20）

| 条目 id | 模块 | 状态 |
|---|---|---|
| `agent` | `dsh-agent` | 启用 |
| `agent-default-model` | `dsh-agent-default-model` | 启用 |
| `agent-instructions` | `dsh-agent-instructions` | 启用 |
| `agent-loop` | `dsh-agent-loop` | 启用 |
| `agent-preset-registry` | `dsh-agent-preset-registry` | 启用 |
| `command-compact` | `dsh-command-compact` | 启用 |
| `command-feedback` | `dsh-command-feedback` | 启用 |
| `command-goal` | `dsh-command-goal` | 启用 |
| `commands` | `dsh-commands` | 启用 |
| `goal` | `dsh-goal` | 启用 |
| `goal-round-driver` | `dsh-goal-round-driver` | 启用 |
| `plan-mode` | `dsh-plan-mode` | 启用 |
| `skill` | `dsh-skill` | 启用 |
| `skill-badge` | `dsh-skill-badge` | 随包关闭 |
| `skill-filesystem` | `dsh-skill-filesystem` | 启用 |
| `subagent` | `dsh-subagent` | 启用 |
| `subagent-fork-in-process` | `dsh-subagent-fork-in-process` | 启用 |
| `subagent-spawn-in-process` | `dsh-subagent-spawn-in-process` | 启用 |
| `system-prompt` | `dsh-system-prompt` | 启用 |
| `workflow-ptc` | `dsh-workflow-ptc` | 启用 |

### 会话与上下文（19）

| 条目 id | 模块 | 状态 |
|---|---|---|
| `compaction-basic` | `dsh-compaction-basic` | 启用 |
| `image-offload` | `dsh-compaction-image-offload` | 启用 |
| `session` | `dsh-session` | 启用 |
| `session-checkpoint-policy` | `dsh-session-checkpoint-policy` | 启用 |
| `session-controller` | `dsh-api-session-controller` | 启用 |
| `session-log-deepseek` | `dsh-session-log-deepseek` | 启用 |
| `session-log-download` | `dsh-session-log-export` | 启用 |
| `session-persistence-jsonl` | `dsh-session-persistence-jsonl` | 启用 |
| `session-projection` | `dsh-session-projection` | 启用 |
| `session-projection-cache` | `dsh-session-projection-cache` | 启用 |
| `session-query-sqlite` | `dsh-session-query-sqlite` | 启用 |
| `session-reference` | `dsh-session-reference` | 启用 |
| `session-stats` | `dsh-session-stats` | 启用 |
| `session-telemetry-otel` | `dsh-session-telemetry-otel` | 启用 |
| `session-title` | `dsh-session-title` | 启用 |
| `session-turn-outline` | `dsh-session-turn-outline` | 启用 |
| `spill-local` | `dsh-spill-local` | 启用 |
| `spill-policy` | `dsh-spill-policy` | 启用 |
| `token-meter` | `dsh-token-meter` | 启用 |

### 模型与账号（12）

| 条目 id | 模块 | 状态 |
|---|---|---|
| `authorization` | `dsh-authorization` | 启用 |
| `credentials` | `dsh-credentials-local` | 启用 |
| `deepseek-account` | `dsh-deepseek-account-platform` | 启用 |
| `deepseek-llm-api-extensions` | `dsh-deepseek-llm-api-extensions` | 启用 |
| `llm` | `dsh-llm` | 启用 |
| `llm-deepseek` | `dsh-llm-deepseek-api-key` | 启用 |
| `llm-deepseek-account` | `dsh-llm-deepseek-account` | 启用 |
| `llm-pi-ai` | `dsh-llm-pi-ai` | 启用 |
| `llm-retry` | `dsh-llm-retry` | 启用 |
| `session-title-llm` | `dsh-session-title-first-prompt-llm` | 启用 |
| `web-fetch-http` | `dsh-web-fetch-http` | 启用 |
| `web-search-deepseek` | `dsh-web-search-deepseek` | 启用 |

### 沙箱、审批与文件（10）

| 条目 id | 模块 | 状态 |
|---|---|---|
| `approval` | `dsh-user-approval` | 启用 |
| `attachment-local` | `dsh-attachment-local` | 启用 |
| `bash-sandbox` | `dsh-bash-sandbox` | 条件（process.platform === 'win32'） |
| `fs-observation-policy` | `dsh-fs-observation-policy` | 启用 |
| `fs-sandbox` | `dsh-fs-sandbox` | 启用 |
| `jobs` | `dsh-jobs-local` | 启用 |
| `permission` | `dsh-permission-presets` | 启用 |
| `pwsh-sandbox` | `dsh-pwsh-sandbox` | 条件（process.platform !== 'win32'） |
| `sandbox` | `dsh-sandbox-local` | 启用 |
| `sandbox-policy` | `dsh-sandbox-policy` | 启用 |

### 宿主与 API 面（15）

| 条目 id | 模块 | 状态 |
|---|---|---|
| `account-controller` | `dsh-api-account-controller` | 启用 |
| `api-remotes` | `dsh-api-remotes` | 启用 |
| `cordis-host-runner` | `dsh-cordis-host-runner` | 启用 |
| `desktop-product-telemetry` | `dsh-host-product-telemetry-otel` | 条件（"ctx.get('profileContext')?.name !== 'desktop'"） |
| `directory-picker` | `dsh-host-directory-picker-auto` | 启用 |
| `job-controller` | `dsh-api-job-controller` | 启用 |
| `open-in-app` | `dsh-host-open-in-app` | 启用 |
| `plugin-inventory` | `dsh-host-plugin-inventory` | 启用 |
| `settings-controller` | `dsh-api-settings-controller` | 启用 |
| `terminal-controller` | `dsh-api-terminal-controller` | 启用 |
| `typert-gateway` | `dsh-api-gateway` | 启用 |
| `web` | `dsh-web` | 启用 |
| `webserver` | `dsh-host-webserver` | 启用 |
| `workspace-controller` | `dsh-api-workspace-controller` | 启用 |
| `workspace-files` | `dsh-api-workspace-files` | 启用 |

### 浏览器界面（client-ui）（47）

| 条目 id | 模块 | 状态 |
|---|---|---|
| `ui-agent-preset` | `dsh-client-ui-agent-preset` | 启用 |
| `ui-approval` | `dsh-client-ui-approval` | 启用 |
| `ui-attachment` | `dsh-client-ui-attachment` | 启用 |
| `ui-brand-official` | `dsh-client-ui-brand-official` | 启用 |
| `ui-chat` | `dsh-client-ui-chat` | 启用 |
| `ui-commands` | `dsh-client-ui-commands` | 启用 |
| `ui-conversation` | `dsh-client-ui-conversation` | 启用 |
| `ui-cordis` | `dsh-client-ui-cordis` | 启用 |
| `ui-deliverables` | `dsh-client-ui-deliverables` | 启用 |
| `ui-goal` | `dsh-client-ui-goal` | 启用 |
| `ui-input-trigger` | `dsh-client-ui-input-trigger` | 启用 |
| `ui-jobs` | `dsh-client-ui-jobs` | 启用 |
| `ui-layout` | `dsh-client-ui-layout` | 启用 |
| `ui-message-feedback` | `dsh-client-ui-message-feedback` | 启用 |
| `ui-model-selection` | `dsh-client-ui-model-selection` | 启用 |
| `ui-open-in-app` | `dsh-client-ui-open-in-app` | 启用 |
| `ui-permission` | `dsh-client-ui-permission-presets` | 启用 |
| `ui-plan` | `dsh-client-ui-plan` | 启用 |
| `ui-plugin-manager` | `dsh-client-ui-plugin-manager` | 启用 |
| `ui-reference` | `dsh-client-ui-reference` | 启用 |
| `ui-renderer` | `dsh-client-ui-renderer` | 启用 |
| `ui-session` | `dsh-client-ui-session` | 启用 |
| `ui-settings` | `dsh-client-ui-settings` | 启用 |
| `ui-settings-account` | `dsh-client-ui-settings-account` | 启用 |
| `ui-settings-agent-loop` | `dsh-client-ui-settings-agent-loop` | 启用 |
| `ui-settings-general` | `dsh-client-ui-settings-general` | 启用 |
| `ui-settings-models` | `dsh-client-ui-settings-models` | 启用 |
| `ui-settings-plugin-inventory` | `dsh-client-ui-settings-plugin-inventory` | 启用 |
| `ui-settings-plugins` | `dsh-client-ui-settings-plugins` | 启用 |
| `ui-settings-session-log` | `dsh-client-ui-settings-session-log` | 启用 |
| `ui-settings-shell` | `dsh-client-ui-settings-shell` | 启用 |
| `ui-settings-subagent` | `dsh-client-ui-settings-subagent` | 启用 |
| `ui-settings-web-search` | `dsh-client-ui-settings-web-search` | 启用 |
| `ui-shortcuts` | `dsh-client-ui-shortcuts` | 启用 |
| `ui-sidebar` | `dsh-client-ui-sidebar` | 启用 |
| `ui-sidebar-browser` | `dsh-client-ui-sidebar-browser` | 条件（"ctx.get('profileContext')?.name !== 'desktop'"） |
| `ui-sidebar-documentpreview` | `dsh-client-ui-sidebar-documentpreview` | 启用 |
| `ui-sidebar-files` | `dsh-client-ui-sidebar-files` | 启用 |
| `ui-sidebar-right` | `dsh-client-ui-sidebar-right` | 启用 |
| `ui-sidebar-terminal` | `dsh-client-ui-sidebar-terminal` | 启用 |
| `ui-skill` | `dsh-client-ui-skill` | 启用 |
| `ui-subagent` | `dsh-client-ui-subagent` | 启用 |
| `ui-theme` | `dsh-client-ui-theme` | 启用 |
| `ui-trajectory` | `dsh-client-ui-trajectory` | 启用 |
| `ui-user-questions` | `dsh-client-ui-user-questions` | 启用 |
| `ui-workflow-run` | `dsh-client-ui-workflow-run` | 启用 |
| `ui-workspace` | `dsh-client-ui-workspace` | 启用 |

### 浏览器客户端基础设施（9）

| 条目 id | 模块 | 状态 |
|---|---|---|
| `client-hmr` | `dsh-client-hmr` | 启用 |
| `connection` | `dsh-client-connection` | 启用 |
| `cordis-client-runner` | `dsh-cordis-client-runner` | 启用 |
| `file-upload` | `dsh-client-file-upload` | 启用 |
| `locale` | `dsh-client-locale` | 启用 |
| `modules` | `dsh-client-modules` | 启用 |
| `product-analytics` | `dsh-client-product-analytics` | 条件（"ctx.get('profileContext')?.name !== 'desktop'"） |
| `resources` | `dsh-client-resources` | 启用 |
| `shortcuts` | `dsh-client-shortcuts` | 启用 |

### 基础设施（11）

| 条目 id | 模块 | 状态 |
|---|---|---|
| `config-editor` | `dsh-config-editor` | 条件（"!ctx.get('profileContext')"） |
| `hmr` | `dsh-hmr` | 条件（"!ctx.get('profileContext')"） |
| `otel` | `dsh-otel` | 启用 |
| `settings` | `dsh-settings` | 条件（"!ctx.get('profileContext')"） |
| `shell-env` | `dsh-shell-env` | 启用 |
| `storage` | `dsh-storage` | 启用 |
| `storage-domain` | `dsh-storage-domain` | 启用 |
| `storage-json` | `dsh-storage-json` | 启用 |
| `subprocess` | `dsh-subprocess-local` | 启用 |
| `typert` | `dsh-typert-registry` | 启用 |
| `typert-loader` | `dsh-typert-loader` | 启用 |

### 其他（15）

| 条目 id | 模块 | 状态 |
|---|---|---|
| `file-reference-local` | `dsh-file-reference-local` | 启用 |
| `mcp-resources` | `dsh-mcp-resources` | 启用 |
| `message-feedback` | `dsh-message-feedback` | 启用 |
| `office-to-pdf` | `dsh-office-to-pdf` | 启用 |
| `plugin-manager` | `dsh-plugin-manager` | 条件（"!ctx.get('profileContext')"） |
| `plugin-package-inventory-deepseek` | `dsh-plugin-package-inventory-deepseek` | 启用 |
| `ptc-runtime` | `dsh-ptc-runtime-node` | 启用 |
| `timer` | `cordis-plugin-timer` | 启用 |
| `tool-plugin-manager` | `dsh-plugin-manager/tools` | 随包关闭 |
| `tools` | `dsh-tools` | 启用 |
| `user-questions` | `dsh-user-questions` | 启用 |
| `web-runtime` | `dsh-web-app` | 启用 |
| `web-startup` | `dsh-web-app/startup` | 启用 |
| `workspace` | `dsh-workspace` | 启用 |
| `workspace-changes` | `dsh-workspace-changes` | 启用 |

## 五、本机用户 patch 层（你自己的改动）

| 条目 id | 模块 / 配置 | 说明 |
|---|---|---|
| `ui-chat` | `dsh-client-ui-chat` | 来自 `profiles/desktop/cordis.patch.yml` |
| `ui-settings` | `dsh-client-ui-settings` | 来自 `profiles/desktop/cordis.patch.yml` |
| `ui-settings-account` | `dsh-client-ui-settings-account` | 来自 `profiles/desktop/cordis.patch.yml` |
| `ui-theme` | `dsh-client-ui-theme` | 来自 `profiles/desktop/cordis.patch.yml` |
| `llm-pi-ai` | `dsh-llm-pi-ai` | 来自 `profiles/desktop/cordis.patch.yml` |
| `agent-default-model` | `dsh-agent-default-model` | 来自 `profiles/desktop/cordis.patch.yml` |
| `gpt-quota` | `file:///D:/AA12583/dsh/%E7%BB%84%E4%BB%B6/gpt-quota-plugin/index.mjs` | 来自 `profiles/desktop/cordis.patch.yml` |

其中 `gpt-quota` 是 `file:///D:/AA12583/dsh/组件/gpt-quota-plugin/index.mjs` —— 你本地自写的插件；`llm-pi-ai` 通过 `openai-api-server-via-codex` 桥接进程接入了 GPT 系列模型；其余是界面偏好（主题、聊天视图、账号设置）。

## 六、清单在哪看 / 怎么改

| 入口 | 能力 |
|---|---|
| 侧边栏「插件」页（`ui-plugin-manager`） | 唯一可写入口：启停条目、选择/安装/删除组合包 |
| 设置 →「内置插件」（`ui-settings-plugins` + `ui-settings-plugin-inventory`） | 只读清单快照：加载顺序、启用状态、存活阶段 |
| `dsh plugin --profile <name> add|remove|why ...` | 命令行，参数原样转发给 profile 目录里的 pnpm |
| `%USERPROFILE%\.dsh\profiles\<profile>\cordis.patch.yml` | 人工编辑层（最后应用，优先级最高） |

安装第三方插件的 spec 形式：npm 包名、绝对本地路径、git 地址、tarball。注册表默认官方 npm，失败回退 `registry.npmmirror.com`；安装前会用 `pnpm view` 检查 DSH peer 版本兼容性。

安全边界（来自 `dsh-plugin-manager` 文档）：安装的宿主代码在宿主进程内运行，**不受工作区沙箱限制**；插件管理工具需要 `danger-full-access` 或单次批准；pnpm 依赖构建脚本需另行批准。
