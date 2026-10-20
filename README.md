# DSH 双机同步仓库

一台电脑上装好的 DSH 插件、皮肤、文档、配置，换台电脑要重新折腾一遍——这个仓库就是为了消灭这件事。

**一个仓库 = 一份可移植的 DSH 插件环境。** 两台电脑都连到同一个远端，谁改了东西推上去，另一边拉下来就能用。

---

## 一、仓库里有什么

```
组件/
├─ EAC-skin-loader/         皮肤加载器（工作区 link 插件）
├─ dsh-our-free-model/      自建模型目录插件（工作区 link 插件）
├─ dsh-image-gen/           图片生成插件源码
├─ gpt-quota-plugin/        配额浮窗插件（cordis 直接 file:// 挂载）
├─ gpt-bridge-autostart/    桥接进程自启插件（同上）
├─ openai-api-server-via-codex/  GPT 本地桥（含 exe）
├─ girl-pet-*/  skin-repo/  session-sync-pkg/  pmplus-pkg/ …   其它插件源码与素材
├─ workbuddy-to-dsh/dsh-plugin/  WorkBuddy 插件（模板，不含 .bridge-token）
├─ dsh-replica-20261016/    某次安装的完整快照（含 docs/payload，用于对照复刻）
│
├─ config/profiles/         ★ 可移植的 DSH 配置模板（路径已占位符化）
│   ├─ desktop/package.json        插件清单 + link: 依赖
│   ├─ desktop/cordis.patch.yml    用户 patch 层（主题、模型、浮窗、宠物…）
│   ├─ web|headless/package.json
│   └─ PLACEHOLDERS.txt            占位符说明
├─ docs/
│   ├─ 环境与踩坑.md         ★ 装机的硬事实、git 不在 PATH、.env 陷阱、编码坑
│   └─ 插件索引.md           哪个目录是什么插件、怎么挂载
├─ assets/desktop-pet/pets/ 桌面宠物资源（deepseek 皮肤）
├─ scripts/                 一键部署与同步脚本
├─ DSH-插件清单.md          本机实测的插件条目清单
├─ session-sync-readme.md
└─ .gitignore / .gitattributes
```

### 为什么配置要单独放一份 `config/`

`~/.dsh/profiles/desktop/package.json` 里长这样：

```json
"@dsh-eac/skin-loader-pack": "link:D:/AA12583/dsh/组件/EAC-skin-loader"
```

`D:/AA12583/...` 是**这台电脑**的路径，换台电脑盘符或目录不同就废了。
所以仓库里存的是占位符版本：

```json
"@dsh-eac/skin-loader-pack": "link:@DSH_COMPONENTS@/EAC-skin-loader"
```

`setup.ps1` / `sync.ps1` 会按本机实际位置替换回来。四个占位符：

| 占位符 | 含义 |
|---|---|
| `@DSH_COMPONENTS@` | 本仓库根目录的绝对路径（正斜杠），如 `D:/AA12583/dsh/组件` |
| `@COMPONENT_URI@` | 同一目录的 `file://` URI，中文已百分号编码，供 cordis 的 `file:///...` 模块地址用 |
| `@USERPROFILE@` | 用户目录，如 `C:/Users/tanyu` |
| `@WORKBUDDY_PLUGIN@` | `dsh-plugin-workbuddy` 的目录，默认取仓库里的 `workbuddy-to-dsh/dsh-plugin` |

> WorkBuddy 插件若在本机有独立开发目录，设一个环境变量就能覆盖：
> `setx DSH_WORKBUDDY_PLUGIN "C:\Users\你\workbuddy-to-dsh\dsh-plugin"`

---

## 二、新电脑首次部署

前提：那台电脑已经装好 DSH（不需要装 git，脚本会自己找）。

```powershell
# 1. 克隆到任意位置（路径随意，脚本会自己算）
git clone <你的远端地址> D:\AA12583\dsh\组件
cd D:\AA12583\dsh\组件

# 2. 一键部署
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
```

`setup.ps1` 会依次做四件事：

1. 把 `config/profiles/*` 还原成本机真实路径，写进 `~/.dsh/profiles/`
   （已存在的文件先备份成 `.bak-时间戳`）
2. 调 DSH 自带的 pnpm 安装插件依赖（`dsh plugin --profile desktop install`），
   `link:` 依赖直接指向本仓库里的源码，改代码即时生效，不用重新打包
3. 把宠物资源铺到 `~/.dsh/desktop-pet/pets/`
4. 设置用户环境变量 `DSH_IDE_GIT_BIN`（dsh-ide-git 不读 PATH，只认这个变量）

**然后完全退出 DSH 再启动**——bundle 列表和配置只在启动时读一次。

网络不好时可以分两步：`setup.ps1 -SkipInstall`，等网好再 `dsh plugin --profile desktop install`。

---

## 三、日常两条动线

```
电脑 A 改完       →  .\scripts\sync.ps1 push
电脑 B 要用       →  .\scripts\sync.ps1 pull
```

`scripts\` 里还有两个可双击的快捷入口：`提交并推送.ps1`、`拉取并应用.ps1`。

### 在 DSH 界面里改了设置怎么办

主题、字号、默认模型、开关插件……这些只写进 `~/.dsh/profiles/desktop/cordis.patch.yml`，仓库并不知道。
所以**改完界面设置后**要多跑一步，把实时配置反向回填成模板：

```powershell
.\scripts\capture-profile.ps1 -Push
```

它做的事正好相反：把本机绝对路径换回占位符，写回 `config/profiles/`，然后提交推送。

### `pull` 到底做了什么

1. 有未提交改动先 `git stash`
2. `git pull --rebase`
3. 模板还原成本机路径并写回 `~/.dsh/profiles/`（内容没变就不动文件）
4. `package.json` 变了就自动重装依赖
5. `git stash pop` 恢复你的改动

---

## 四、配置远端

**当前状态**：`origin` 指向本机离线备份库 `D:\AA12583\dsh-backup\dsh-components.git`，
已经推上去了，换盘/U 盘拷走就能用，但**另一个房间以外的电脑拿不到**。

接真正的远端只需一条命令（本机没有 GitHub 凭据，所以这步留给你）：

```powershell
.\scripts\connect-remote.ps1 -Url https://github.com/<你>/dsh-components.git
```

它会自动：配 github 代理（本机直连不通，必须走 `127.0.0.1:7892`）、把 origin 换成新地址、
原离线库改名为 `backup` 继续保留、推送全部分支、把地址写回 `scripts\remote.conf`。

有 PAT 的话加上 `-Token ghp_xxx`（classic token 勾 `repo` 权限），就不用每次登录。

> **务必建私有仓库**：`dsh-replica-20261016/` 含完整安装快照、会话缓存和大量文档。
> 密钥文件已被 `.gitignore` 拦住，但快照本身不适合公开。

**不想上公网的话**，U 盘 / 网盘就够了，当前 `origin` 已经是这个形态：

```powershell
# 在另一台电脑上，把整个 D:\AA12583\dsh-backup 拷过去，然后
git clone D:\AA12583\dsh-backup\dsh-components.git D:\AA12583\dsh\组件
# 之后 origin 指向本地路径，push/pull 照常工作
```

**局域网自建**：Gitea / GitLab 开个私有仓库，用同一套 `connect-remote.ps1`。

---

## 五、哪些东西**不会**进仓库

`.gitignore` 里明确排除，都是"能重新生成"或"绝不能外传"的：

| 排除项 | 原因 |
|---|---|
| `node_modules/` | 重新 install 即可，34 MB+ |
| `.verify/`、`dist/`、`*.tsbuildinfo` | 构建产物 |
| `*.log`、`position.json`、`state.json`、`token-ledger.json` | 本机运行时状态 |
| `.credentials.yaml`、`secrets/`、`auth.json`、`.env`、`*.pem/key`、`.bridge-token` | **凭据与密钥** |

> ⚠️ 已经有真实 API Key 落在 `dsh-replica-20261016/payload/dsh-home/secrets/.credentials.yaml` 里，被 `.gitignore` 拦住了。
> **不要用 `git add -f` 强行加进来**；如果曾经加过，记得当作已泄露处理并轮换密钥。

大压缩包（`skin-src.tar.gz` 40 MB、`dsh-replica-20261016.zip` 32 MB 等）是保留的原始素材，
首次克隆会慢一点，之后增量很小。介意的话可以改成 Git LFS，或单独丢网盘。

---

## 六、踩过的坑（都在脚本里处理了）

| 坑 | 处理方式 |
|---|---|
| 这台机器 `git` 不在 PATH | `Find-Git` 依次找 环境变量/PortableGit/Fork 内置/常见安装位置；也可 `setx DSH_SYNC_GIT <路径>` |
| 仓库路径含中文 | cordis 的 `file://` 地址用百分号编码的 `@COMPONENT_URI@`，不用手写 |
| 配置文件是 UTF-8 无 BOM | 脚本一律按 `UTF8Encoding($false)` 读写，避免 BOM 把 YAML/JSON 弄坏 |
| `.ps1` 含中文时 5.1 报语法错 | 必须存成 **UTF-8 with BOM**；`config/**` 反之必须无 BOM |
| pnpm 用 `link:` 指向工作区源码 | `setup.ps1` 先还原 `package.json` 再 install，链接才对得上 |
| dsh-ide-git 报 "cannot start git" | `setup.ps1` 自动写 `DSH_IDE_GIT_BIN` 用户环境变量（**不能**写进 `~/.dsh/.env`，会致命报错） |
| 两台机器 CRLF/LF 不同导致整文件 diff | `.gitattributes` 统一 `text=auto`，仓库里按 LF 存 |
| DSH 恢复机制会重写 `cordis.patch.yml` | 仓库里始终留着一份，随时 `capture-profile.ps1` 对照恢复 |
| github.com 直连失败 | 必须走本机代理 `127.0.0.1:7892`，`connect-remote.ps1` 会自动配进 `.git/config` |

更细的排查记录在 [docs/环境与踩坑.md](docs/环境与踩坑.md)。

---

## 七、常用命令速查

```powershell
.\scripts\sync.ps1 status          # 看有没有未提交/未推送
.\scripts\sync.ps1 pull            # 拉取并应用
.\scripts\sync.ps1 push            # 提交并推送
.\scripts\capture-profile.ps1      # 界面改完设置后，回填配置模板
.\scripts\setup.ps1                # 新机器一键部署（可重复跑，幂等）
.\scripts\connect-remote.ps1 -Url https://github.com/<你>/dsh-components.git   # 接真远端
```

