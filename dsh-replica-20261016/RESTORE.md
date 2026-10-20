# 逐步还原手册

包根目录以下用 `<BUNDLE>` 表示，例如 `D:\dsh-replica-20261016`。
目标机器假设：DSH 装在 `D:\AA12583\dsh`（不同请用 `-DshInstallDir` 覆盖），组件放 `D:\dsh-components`。

> ⚠️ 本包含明文凭据，见 `README-复刻说明.md` 顶部警告。不想装凭据就在每一步加 `-SkipSecrets`。

---

## 步骤 0 · 先确认基础环境

```powershell
Test-Path 'D:\AA12583\dsh\DeepSeek Harness.exe'   # 期望 True
Test-Path 'D:\AA12583\dsh\resources\app.asar'     # 期望 True
(Get-Content 'D:\AA12583\dsh\version' -Raw).Trim() # 期望 44.0.0
```

**期望输出**：两个 `True` 与 `44.0.0`。
若 DSH 还没装：先安装 `0.2.0-rc.2`（Electron 44.0.0），再继续。本包不含 DSH 程序本体。

---

## 步骤 1 · 看一眼计划，不写任何东西

```powershell
cd <BUNDLE>
.\tools\restore.cmd -DryRun -ComponentsDir "D:\dsh-components"
```

**期望输出要点**：

```
DSH replica restore
  bundle       : <BUNDLE>
  DSH home     : C:\Users\<你>\.dsh
  components   : D:\dsh-components
  MODE         : DryRun (nothing is written)

== 1. sanity checks
  manifest     : 1179 files, built 2026-10-16T...
  source DSH   : 0.2.0-rc.2  (app.asar sha256 983CA71114E6DFD3...)
  [ok] DSH install  : D:\AA12583\dsh
  [ok] app.asar matches the source machine byte for byte
  [ok] bundle layout complete

== 2. preflight
  new    .\payload\components
         -> D:\dsh-components
  ...（8 条目标路径，已存在的会标 EXISTS）
  Plugin side effects: the four third-party plugins ... stay INACTIVE
  until you list them in dsh.profile.bundles (Settings -> Plugins).

DryRun complete. Re-run without -DryRun to apply.
```

**检查**：目标路径是否都符合你的预期（尤其 `DSH home` 与 `components`）。
`app.asar differs from the source machine` 只是警告，可以继续；`Could not locate the DSH install root` 才是错误，用 `-DshInstallDir` 指定。

---

## 步骤 2 · 正式还原

```powershell
.\tools\restore.cmd -ComponentsDir "D:\dsh-components" -Force
```

脚本按 1→6 步执行：sanity → preflight → 拷贝 → 凭据 → repoint → verify。

**期望输出要点**：

```
== 3. copying payload
  [ok] -> D:\dsh-components
  [ok] -> C:\Users\<你>\.dsh\profiles
  [ok] -> C:\Users\<你>\.dsh\profiles
  [ok] -> C:\Users\<你>\.dsh\sessions
  [ok] -> C:\Users\<你>\.dsh\storages

== 4. credentials
  [ok] -> C:\Users\<你>\.dsh\.credentials.yaml
  [ok] -> C:\Users\<你>\.dsh\.anonymous-user-id
  [ok] -> C:\Users\<你>\.codex-chatgpt\auth.json

== 5. repointing machine-specific paths
  [ok] cordis.patch.yml rewritten
  gpt-quota.name -> file:///D%3A/dsh-components/gpt-quota-plugin/index.mjs
  session-sync.gitBin -> C:\Users\<你>\.workbuddy\...\git.exe   （或退化为 git）
  [ok] gpt-quota-plugin/index.mjs rewritten
  createRequire -> D:\AA12583\dsh/resources/app.asar/dsh/package.json
  <旧工作区路径>
    -> <新工作区路径>
  [ok] workspace.json rewritten

== 6. verifying
  ...
Verification PASSED (32 checks).

Restore finished.
```

**判定**：最后一行为 `Verification PASSED (32 checks).` 且退出码 0 即成功。
若出现 `[FAIL]`，见文末排查表。

> 不想带凭据：加上 `-SkipSecrets`，第 4 步会显示 `skipped`。
> 不想要工作区历史：加上 `-ClearWorkspaces`，`workspace.json` 会被清空为 `"workspaces": {}`。

---

## 步骤 3 · 单独复验（可选，但建议）

```powershell
.\tools\verify.cmd -ComponentsDir "D:\dsh-components" -DshInstallDir "D:\AA12583\dsh"
```

**期望输出**（共 32 项 PASS，末尾）：

```
== 1. reference files (SHA256)
  [PASS] 20/20 reference files match the manifest
== 2. path tokens fully substituted
  [PASS] clean: ...\profiles\desktop\cordis.patch.yml
  [PASS] clean: ...\gpt-quota-plugin\index.mjs
  [PASS] patch contains ui-settings enabled: true
  [PASS] patch contains account completion: api-key
  [PASS] patch contains performanceUsage: detailed
  [PASS] patch contains agent model gpt-6.1-sol
  [PASS] patch contains gpt-quota revision 5
  [PASS] gpt-quota points at a real file URL
== 3. JSON parses            （13 个 json 全部 ok）
== 4. patch layer shape
  [PASS] cordis.patch.yml has 12 top-level entries (expected >= 7)
  [PASS] sessions restored: 4 conversation folder(s)
== 5. plugin sources parse
  [PASS] syntax ok: index.mjs / quota.mjs / client.js
== 6. DSH install layout
  [PASS] app.asar present: 121348951 bytes
  [PASS] app.asar byte-identical to the source machine
  [PASS] codex bridge binary restored
  [PASS] codex auth.json in place

Verification PASSED (32 checks).
```

---

## 步骤 4 · 启动 DSH 并核对界面

启动 DSH（若已在运行，**重启**，patch 层只在启动时读取），然后逐项核对：

| 检查项 | 期望 |
|---|---|
| 侧边栏工作区 | 出现 `组件`、`查资料`、`新关卡`（清过则只有新的空列表） |
| 主题 | 深色、字号 16 |
| 设置页 | 可打开（`ui-settings.enabled: true`） |
| 账号设置 | 显示已完成、`api-key` 认证方式 |
| 默认模型 | `GPT (Codex bridge)` / `GPT-6.1 Sol` |
| 模型选择弹层 | 出现 GPT 配额浮窗（gpt-quota 插件已挂载） |
| 设置 → 插件 | 能看到 4 个第三方插件处于未启用/可启用状态 |

**若配额浮窗没出现**：说明 `gpt-quota` 未挂载。检查
`C:\Users\<你>\.dsh\profiles\desktop\cordis.patch.yml` 里 `gpt-quota` 的 `name` 是否为真实的
`file:///...gpt-quota-plugin/index.mjs`，且该文件存在；再确认 `%USERPROFILE%\.codex-chatgpt\auth.json` 可读。

---

## 步骤 5 · 确认 Codex 桥已被 DSH 自动拉起

`gpt-bridge-autostart` 插件会在 DSH 启动时自动拉起桥，无需手动开窗口。DSH 起来后确认：

```powershell
Get-NetTCPConnection -State Listen | Where-Object LocalPort -eq 18080    # 期望 LISTENING
Get-Content <ComponentsDir>\gpt-bridge-autostart\autostart.log           # 期望末尾是 "ready on 127.0.0.1:18080"
Invoke-WebRequest http://127.0.0.1:18080/v1/models -Headers @{ Authorization = 'Bearer dummy' } -UseBasicParsing |
  Select-Object -ExpandProperty Content
```

**期望**：端口 `LISTENING`、`autostart.log` 含 `apply() entered` → `spawn() accepted` → `ready`、
`/v1/models` 返回含 `gpt-5.6-luna` / `gpt-6-luna` / `gpt-6.1-sol` 的 JSON。

桥的父进程应该是 `DeepSeek Harness`（可用来确认不是脚本残留）：

```powershell
$pid = (Get-NetTCPConnection -State Listen | Where-Object LocalPort -eq 18080).OwningProcess
Get-Process -Id $pid | Select-Object Id,ProcessName
(Get-CimInstance Win32_Process -Filter "ProcessId=$pid").ParentProcessId |
  ForEach-Object { (Get-Process -Id $_).ProcessName }
```

**只有排障时才手动起桥**（此时插件或登录自启会因"端口已占用"跳过，不会重复拉起）：

```powershell
# 代理端口不是 7892 时先设：set DSH_LOCAL_PROXY=http://127.0.0.1:10809
<ComponentsDir>\openai-api-server-via-codex\start-server.cmd
```

返回 401 / 连接被拒时：确认 `%USERPROFILE%\.codex-chatgpt\auth.json` 有效、代理可用，并看 `autostart.log` 里是否有 `spawn threw` 或 `exited code=...`。

---

## 步骤 6 · 启用第三方插件（可选）

`profiles\desktop\package.json` 的 `dependencies` 里已有这 4 个包，但 `dsh.profile.bundles` 没列它们，所以不加载。编辑：

```powershell
$p = "$env:USERPROFILE\.dsh\profiles\desktop\package.json"
Copy-Item $p "$p.before-enable"
notepad $p
```

把 `bundles` 改成：

```json
"bundles": [
  "@deepseek-ai/dsh-base",
  "@deepseek-ai/dsh-web-app",
  "dsh-desktop-pet",
  "dsh-image-gen",
  "dsh-plugin-manager-plus",
  "dsh-session-sync"
]
```

保存后重启 DSH。也可改用 设置 → 插件 页面操作（推荐，插件页会自己写这个文件）。

---

## 附：故障排查

| 现象 | 原因与处理 |
|---|---|
| `因为在此系统上禁止运行脚本` | 用了 `.ps1` 直跑。改用 `.cmd` 启动器，或加 `-ExecutionPolicy Bypass -File` |
| `Could not locate the DSH install root` | 传 `-DshInstallDir "X:\...\DeepSeek Harness"` |
| `Access to the path '...' is denied` | 目标目录无写权限或被安全软件拦住；换目录或提权 |
| `[FAIL] 20/20 reference files` 中有 mismatch | 包被改动过；用 `node .\tools\build-manifest.mjs .` 重算，或重新获取包 |
| `[FAIL] unsubstituted in ...cordis.patch.yml` | repoint 没跑或失败；手动跑 `.\tools\repoint.ps1 -ComponentsDir <dir> -DshInstallDir <dir>` |
| `[FAIL] syntax error: index.mjs` | 文件被编辑器改坏；与 `reference\gpt-quota-plugin\index.mjs` 对比 |
| `node --test` 报 `spawn EPERM` | 沙箱禁止 Node 子进程管道 stdio，非测试失败；用 `node .\gpt-quota-plugin\quota.test.mjs` 直接跑 |
| 模型不存在 / 调用即失败 | 桥没起、代理不通、Codex 登录态失效，或默认模型指向 `gpt-local` 而桥不在 |
| 会话列表是空的 | 用了 `-ClearWorkspaces`，或 `workspace.json` 的路径指向不存在的目录 |
