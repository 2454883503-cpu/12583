# DSH 状态复刻包（2026-10-16）

> ⚠️ **本包含明文凭据。** `payload\dsh-home\secrets\` 内有 `DEEPSEEK_API_KEY` / DeepSeek 账号 token（`.credentials.yaml`）与 ChatGPT/Codex 登录态（`codex-auth.json`）。任何拿到这个包的人都能以你的身份调用模型。不要上传网盘公开链接、不要发到群里、不要进 git 仓库。若要一个不含凭据的版本，用 `-SkipSecrets` 还原即可（包里仍有凭据文件，只是不安装）。

这是一份**把源机器的 DSH 使用状态整体搬到另一台机器**的复刻包。源机器上的 DSH 程序本体（`app.asar`）**未被改动**，所以本包不包含、也不需要替换 DSH 程序，只需在目标机器安装同版本 DSH，然后还原配置层。

---

## 一、包里有什么

| 目录 | 内容 | 还原到 |
|---|---|---|
| `payload\components\` | 本地插件 `gpt-quota-plugin`（含单测）、**`gpt-bridge-autostart`（随 DSH 自动拉起 Codex 桥）**、Codex→OpenAI 桥 `openai-api-server-via-codex`（exe+zip+启动脚本）、参考文档 `_dsh\`、分析脚本与清单 md | `<ComponentsDir>` |
| `payload\dsh-home\profiles\` | `desktop` profile 全部文件（含 `node_modules`，即新装的 4 个第三方插件）与 `web` profile | `%USERPROFILE%\.dsh\profiles` |
| `reference\profiles\` | 源机器**实时**配置快照 + 4 个 patch 版本 + `pnpm-lock.yaml` | 同上的 profile 目录（**不覆盖 patch**） |
| `payload\dsh-home\sessions\` | 4 个工作区、9 个会话的历史记录 | `%USERPROFILE%\.dsh\sessions` |
| `payload\dsh-home\storages\` | `workspace.json` + 10 份会话投影缓存 | `%USERPROFILE%\.dsh\storages` |
| `payload\dsh-home\secrets\` | 凭据三件套（见上方警告） | `%USERPROFILE%\.dsh\` 与 `%USERPROFILE%\.codex-chatgpt\` |
| `raw\` | 大体积只读产物：`asar-index.json`（1.7 MB，asar 文件索引）、`gui-quota-verify.txt` | **不还原**，仅供查阅 |
| `tools\` | `restore` / `repoint` / `verify` 脚本 + `.cmd` 启动器 + 清单生成器 | 留包内运行 |
| `MANIFEST.json` | 1179 个文件的 SHA256/大小、路径规则、token 表、4 个 patch 版本对照 | — |

**规模**：约 48 MiB（其中 profile `node_modules` 35.5 MB / 1043 文件，Codex 桥 10.3 MB）。

## 二、包里**没有**什么（有意为之）

- **DSH 程序本体**：`app.asar`（121 MB）未改动，源机器上 SHA256 = `983CA71114E6DFD3…`。目标机器请自行安装 `0.2.0-rc.2`（Electron 44.0.0）。`restore.ps1` 会核对 `app.asar` 哈希：一致则提示 byte-identical，不一致则警告（不会有别的后果）。
- **`%LOCALAPPDATA%` 下的 Electron 缓存、`.dsh\logs\`**：与状态无关。
- **pnpm store / 全局 node 缓存**：`node_modules` 已带实物，无需联网重装。

## 三、前置条件（目标机器）

1. **Windows x64**，已安装 DSH `0.2.0-rc.2`。
2. **Node.js**（可选）：仅 `verify-restore.ps1` 的语法自检需要；没有就跳过该项检查。
3. **执行策略**：Windows 默认策略会禁止直接运行 `.ps1`。用包内 `.cmd` 启动器即可（它只对本进程加 `-ExecutionPolicy Bypass`，不改系统策略），或手动加参数：
   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\restore.ps1 -DryRun
   ```
4. **GPT 系列模型相关**（若不使用 GPT 模型可跳过）：
   - 一个能访问 `chatgpt.com` 的本地代理。源机器用 `127.0.0.1:7892`（自由猫）。端口不同就设环境变量 `DSH_LOCAL_PROXY`，或启动 `start-server.cmd` 前 `set DSH_LOCAL_PROXY=...`。
   - Codex 登录态：本包已带 `codex-auth.json`；若失效，重新登录 Codex 生成后放到 `%USERPROFILE%\.codex-chatgpt\auth.json`。
   - 桥进程要在跑：`<ComponentsDir>\openai-api-server-via-codex\start-server.cmd`（监听 `127.0.0.1:18080`）。

## 四、还原（三步）

```powershell
cd <解压后的包根目录>

# 1) 先看计划，不落盘
.\tools\restore.cmd -DryRun

# 2) 正式还原（components 放哪自己定；不传就放在包根 components\）
.\tools\restore.cmd -ComponentsDir "D:\dsh-components" -Force

# 3) 还原脚本最后会自动跑 verify，也可以单独再跑
.\tools\verify.cmd -ComponentsDir "D:\dsh-components" -DshInstallDir "D:\AA12583\dsh"
```

常用开关：

| 开关 | 作用 |
|---|---|
| `-DshHome <dir>` | 目标 DSH home，默认 `%USERPROFILE%\.dsh` |
| `-ComponentsDir <dir>` | 组件落地目录，默认包根下 `components\` |
| `-DshInstallDir <dir>` | DSH 安装根目录；不传会按环境变量→常见路径→注册表 Uninstall 键自动探测 |
| `-PortableGit <exe>` | `dsh-session-sync` 用的 `git.exe`；不传会探测，找不到就退化为裸 `git` |
| `-CodexHome <dir>` | Codex 凭据目录，默认 `%USERPROFILE%\.codex-chatgpt` |
| `-SkipSecrets` | 完全不还原凭据（三件套都不装） |
| `-ClearWorkspaces` | 不要工作区历史，清空侧边栏工作区列表 |
| `-WorkspacePathMap old=new` | 手写工作区路径改写规则，可重复 |
| `-DryRun` | 只打印计划 |
| `-Force` | 目标已存在时继续（否则只警告不中止） |

还原脚本**只写** `<DshHome>`、`<ComponentsDir>`、`<CodexHome>` 三处，且每次改写前都生成 `.bak-<时间戳>` 备份。

## 五、三个 patch 版本：本包用哪个、怎么换

源机器上 `cordis.patch.yml` 在 `17:21:19` 被一次 **DSH profile recovery 改写**，写成了降级版（旧的挪到 `.bak-1792142479700`）。所以存在多个版本：

| 文件 | 状态 | 特点 |
|---|---|---|
| `payload\dsh-home\profiles\desktop\cordis.patch.yml` | **本包实际安装的就是它** | 恢复前基准 + 你的 `reasoningEffort: medium` + 补回 `gpt-quota.revision: 5` |
| `reference\profiles\desktop\cordis.patch.yml` | 源机器**实时**状态 | **降级**：`ui-settings.enabled=false`、`completion=skipped`、`usage=compact`、`developerTools=false`、`performanceUsage=compact`、`gpt-quota` 丢了 `revision`、`session-sync` 覆盖被删 |
| `reference\profiles\desktop\cordis.patch.yml.bak-1792142479700` | 恢复前基准 | 即上表第一行的来源；差别只有 `reasoningEffort: high`（本包用 `medium`） |
| `reference\profiles\desktop\cordis.patch.yml.restored-keep` | 恢复中途的手工保存 | 与基准同内容 |

**想改用实时那份**（需要手动补路径）：

```powershell
$home_ = "$env:USERPROFILE\.dsh"
Copy-Item .\reference\profiles\desktop\cordis.patch.yml "$home_\profiles\desktop\cordis.patch.yml" -Force
# 把写死的源机器路径换成 token，再跑 repoint 回填
$p = "$home_\profiles\desktop\cordis.patch.yml"
(Get-Content $p -Raw -Encoding UTF8).Replace(
  "file:///D:/AA12583/dsh/%E7%BB%84%E4%BB%B6", '__COMPONENTS_DIR_URL__'
) | Set-Content $p -Encoding UTF8 -NoNewline
.\tools\repoint.ps1 -ComponentsDir "D:\dsh-components" -DshInstallDir "D:\AA12583\dsh"
```

（`repoint.ps1` 本身不认识降级与否，它只负责把 token 和旧路径填成新机器的实际值。）

## 六、跨机器绝对路径一览（由 `repoint.ps1` 处理）

| # | 位置 | 源机器值 | 现在 |
|---|---|---|---|
| 1 | `cordis.patch.yml` 的 `gpt-quota.name` | `file:///D:/AA12583/dsh/%E7%BB%84%E4%BB%B6/…` | token `__COMPONENTS_DIR_URL__` |
| 2 | `gpt-quota-plugin\index.mjs` 的 `createRequire` | `D:/AA12583/dsh/resources/app.asar/dsh/package.json` | token `__DSH_INSTALL_DIR__` |
| 3 | `gpt-quota-plugin` 的代理地址 | `http://127.0.0.1:7892` 写死 | 读环境变量 `DSH_LOCAL_PROXY`，缺省仍是 7892 |
| 4 | `start-server.cmd` 的代理 | 同上写死 | 读 `DSH_LOCAL_PROXY` |
| 5 | `cordis.patch.yml` 的 `session-sync.gitBin` | `C:\Users\tanyu\.workbuddy\…\git.exe` | token `__PORTABLE_GIT__` |
| 6 | `storages\workspace.json` 的工作区路径 | `D:\AA12583\dsh\组件` 等 | 按规则改写，或 `-ClearWorkspaces` |

> 关于第 2 项：这个路径必须指向 **app.asar 内部**，Electron 的 asar 虚拟文件系统才认。asar 外 `Test-Path` 一定是 False，那不是故障。asar 内部确实存在 `dsh/node_modules/@deepseek-ai/dsh/package.json`（见 `raw\asar-index.json`）。

## 六之二、Codex 桥随 DSH 自动启动（`gpt-bridge-autostart`）

**不用再手动双击 `start-server.cmd`。** 本包新增的本地插件 `gpt-bridge-autostart` 会通过 DSH 的 `ctx.subprocess` 服务把桥作为**受管子进程**拉起；DSH 退出或插件卸载时由插件 `dispose` 终止，桥的父进程就是 `DeepSeek Harness`。

源机器上的实测轨迹（`autostart.log`）就是它工作的证据：

```
module evaluated pid=19868
apply() entered; port=18080
spawn() accepted; argv=[...openai-api-server-via-codex.exe, -auth-json, ...,-port,18080,-verbose]
ready on 127.0.0.1:18080
dispose() called          ← 重启 DSH 时旧桥被终止
...下一次启动重新 apply/spawn/ready
```

- patch 条目（已包含在还原后的 `cordis.patch.yml`）：
  ```yaml
  - insert:
      - id: gpt-bridge-autostart
        name: '__COMPONENTS_DIR_URL__/gpt-bridge-autostart/index.mjs'
        config:
          maxRetries: 10
          retryDelayMs: 30000
  ```
- 可选的 `config` 字段（都有默认值）：

  | 字段 | 默认 | 说明 |
  |---|---|---|
  | `bridgeDir` | `D:\AA12583\dsh\组件\openai-api-server-via-codex` | 桥 exe 所在目录 |
  | `port` | `18080` | 必须与 `llm-pi-ai` 的 `baseURL` 端口一致 |
  | `authPath` | `%USERPROFILE%\.codex-chatgpt\auth.json` | Codex 登录态 |
  | `proxyURL` | `DSH_LOCAL_PROXY` → `http://127.0.0.1:7892` | 桥访问 chatgpt.com 用的本地代理 |
  | `graceMs` | `10000` | 终止宽限期 |
  | `maxRetries` / `retryDelayMs` | `1` / `5000` | 失败后重试次数与间隔（本包配置为 10 次 / 30 秒，覆盖开机竞态） |

- 行为细节：启动前先探测端口，已有桥在跑就跳过、不重复拉起；`authPath` 或 exe 缺失时**只告警、不影响 DSH 启动**；桥异常退出会记录 stderr 并按上面的重试配置补拉。
- 诊断：插件在同目录写 `autostart.log`（`module evaluated / apply() entered / spawn() accepted / ready / exited / dispose`）。GPT 连不上时先看它。
- 单独跑测试：`node gpt-bridge-autostart/index.test.mjs`（6 个用例：配置归一化、端口探测、缺失诊断、spawn 规格、真实拉起桥 + HTTP 200 + dispose 终止）。

### 与"登录自启"的关系（可选，双保险）

源机器上另有一层不依赖 DSH 的兜底：启动文件夹里的 `DSH Codex Bridge.lnk` → `openai-api-server-via-codex\start-server-hidden.vbs`（无窗口启动桥）。两层不会打架：谁先起来都行，后到的一方探测到 18080 已被占用就跳过。只想用一种的话：

- 想要"DSH 在才有桥" → 删掉启动文件夹里的 `DSH Codex Bridge.lnk`，只留插件。
- 想要"开机就有桥、DSH 未启动也能用" → 保留快捷方式；插件仍会做健康兜底。

在其他机器上重建登录自启：

```powershell
$vbs = "<ComponentsDir>\openai-api-server-via-codex\start-server-hidden.vbs"
$lnk = Join-Path ([Environment]::GetFolderPath('Startup')) 'DSH Codex Bridge.lnk'
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($lnk)
$sc.TargetPath = 'wscript.exe'; $sc.Arguments = "`"$vbs`""; $sc.WindowStyle = 7
$sc.Save()
```

## 七、已知差异与坑

1. **4 个第三方插件是"装了但没启用"**。`profiles\desktop\node_modules` 与其 `package.json` 的 `dependencies` 里有 `dsh-desktop-pet`、`dsh-image-gen`、`dsh-plugin-manager-plus`、`dsh-session-sync`，但它们**不在** `dsh.profile.bundles` 里，所以加载器不会挂载。要启用，把它们加进 `profiles\desktop\package.json`：
   ```json
   "dsh": { "profile": { "bundles": [
     "@deepseek-ai/dsh-base",
     "@deepseek-ai/dsh-web-app",
     "dsh-desktop-pet", "dsh-image-gen", "dsh-plugin-manager-plus", "dsh-session-sync"
   ] } }
   ```
   然后重启 DSH，或在 设置 → 插件 里操作。`pnpm-workspace.yaml` 已带 `allowBuilds: dsh-desktop-pet: true` 与 `minimumReleaseAgeExclude: dsh-image-gen@0.9.1`。
2. **`dsh-image-gen` 的版本豁免没有复刻**。源机器上 `0.4.1` 被兼容性检查拒绝（peerDependencies 要求 `^0.1.2-rc.1`），装的是 `0.9.1`。如果目标机器再次触发同类检查，需要重新走一遍 `dsh plugin allow-version` 或用插件页授权。
3. **`dsh-session-sync` 需要 git**。源机器 PATH 里没有 git，所以用 PortableGit 绝对路径覆盖 `gitBin`。`repoint.ps1` 会重写路径中的用户名与安装位置；目标机器没装就把 `gitBin` 改成裸 `git`。
4. **默认模型是 GPT 桥**。patch 里 `agent-default-model` = `provider: gpt-local` / `model: gpt-6.1-sol` / `reasoningEffort: medium`。**没起桥进程时，新会话默认模型不可用**；先把 `start-server.cmd` 跑起来，或在 设置 → 模型 里临时切回 DeepSeek。
5. **`ui-settings.enabled` 在本包里是 `true`**（即你恢复前那份）。若你其实更喜欢实时那份的极简设置页，见第五节。
6. **凭据可能仍与源机器的会话绑定**。`.credentials.yaml` 里的账号 token 与 `codex-auth.json` 都是登录态快照，跨机可能被判定失效；失效就重新登录，其余状态不受影响。
7. **`reference\` 与 `raw\` 是档案，不是状态**。`raw\asar-index.json` 是 16:11 拍的 asar 索引快照，可能与你机器上的 DSH 版本不完全对应；`payload\components\_dsh\` 里的 README/patch 副本同理。它们只是分析资料。

## 八、验证与自查

`tools\verify-restore.ps1` 会检查 6 组、共 32 项：reference 文件哈希、token 是否全部替换、JSON 是否可解析、patch 条目数与关键行、`node --check` 语法、`app.asar` 与桥二进制是否就位。全部通过时退出码 0。

本包在交付前已在两个隔离沙箱实测：完整还原 + 默认工作区路径改写（32/32 通过）、`-ClearWorkspaces` 变体（32/32 通过）、`-DryRun` 不落盘、插件单测 3/3 通过。

若怀疑包被改动过，重新核对整包哈希：

```powershell
node .\tools\build-manifest.mjs .    # 重新生成 MANIFEST.json
.\tools\verify.cmd -ComponentsDir <你的 components 目录> -DshInstallDir <你的 DSH 安装目录>
```

> 注：`node --test` 在受限沙箱里可能报 `spawn EPERM`，那是沙箱禁止子进程管道 stdio，不是测试失败。用 `node .\gpt-quota-plugin\quota.test.mjs` 直接跑可绕过。

## 九、目录速查

```
dsh-replica-20261016\
├─ README-复刻说明.md      本文件
├─ RESTORE.md              逐步命令 + 期望输出
├─ MANIFEST.json           1179 文件哈希清单 / 规则 / token / patch 版本对照
├─ tools\
│   ├─ restore.ps1  restore.cmd    主还原（含 -DryRun / -SkipSecrets / -ClearWorkspaces）
│   ├─ repoint.ps1                 只重写绝对路径，可单独反复跑
│   ├─ verify-restore.ps1  verify.cmd
│   └─ build-manifest.mjs          重新生成 MANIFEST.json
├─ payload\  reference\  raw\
```
