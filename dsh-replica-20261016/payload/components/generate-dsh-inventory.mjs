// Build a human-readable inventory of this DSH install's plugin composition
// from the authoritative patch layers extracted out of app.asar.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/AA12583/dsh/组件/_dsh/node_modules/_at_deepseek-ai';
const PROFILES = 'C:/Users/tanyu/.dsh/profiles';

const LAYERS = [
  { tag: 'base bundle', file: `${ROOT}/dsh-base/cordis.patch.yml` },
  { tag: 'web-app bundle', file: `${ROOT}/dsh-web-app/cordis.patch.yml` },
  { tag: 'user patch (desktop)', file: `${PROFILES}/desktop/cordis.patch.yml` },
];

const PRESETS = ['standard', 'ptc', 'minimal', 'cordis'];

function parsePatch(text, tag) {
  const lines = text.split(/\r?\n/);
  const entries = [];
  let current = null;
  for (const line of lines) {
    const start = line.match(/^(\s*)-\s+(id|insert):\s*(.*)$/);
    if (start) {
      if (start[2] === 'id') {
        current = { indent: start[1].length, id: start[3].trim(), name: null, disabled: null, tag };
        entries.push(current);
      } else {
        current = null;
      }
      continue;
    }
    if (!current) continue;
    // Only module identifiers count as an entry's module: '@scope/pkg', 'file://...', 'cordis:group'.
    const name = line.match(/^\s*name:\s*['"]?((?:@[^'"\s]+|file:[^'"\s]+|cordis:[^'"\s]+))['"]?/);
    if (name && current.name === null) { current.name = name[1]; continue; }
    const dis = line.match(/^\s*disabled:\s*(.+?)\s*$/);
    if (dis) current.disabled = dis[1];
  }
  return entries.filter((e) => e.name);
}

function state(entry) {
  if (!entry.disabled) return '启用';
  if (entry.disabled === 'true') return '随包关闭';
  return `条件（${entry.disabled.replace(/^!!js\s*/, '')}）`;
}

function moduleOf(entry) {
  if (entry.name.startsWith('file:')) return entry.name;
  return entry.name.replace(/^@deepseek-ai\//, '');
}

function category(entry) {
  const n = entry.name;
  if (n.startsWith('file:')) return '本地 / 第三方';
  if (/tool-|tool$/.test(n)) return '工具（模型可用）';
  if (n.includes('client-ui')) return '浏览器界面（client-ui）';
  if (n.includes('client-')) return '浏览器客户端基础设施';
  if (/llm|web-search|web-fetch|deepseek-account|credentials|authorization/.test(n)) return '模型与账号';
  if (/session|compaction|token-meter|spill|checkpoint/.test(n)) return '会话与上下文';
  if (/agent|subagent|skill|goal|plan|workflow|commands|command-|persona|system-prompt|time-context/.test(n)) return '智能体能力';
  if (/sandbox|approval|permission|fs-|attachment|jobs|spill/.test(n)) return '沙箱、审批与文件';
  if (/api-|host-|webserver|desktop|frontend|web$|sdk|acp/.test(n)) return '宿主与 API 面';
  if (/storage|otel|telemetry|hmr|loader|typert|settings|config|home-paths|shell|subprocess|terminal|timeout|util|brand|package-manifest|invariant|lazy|scope|atomic|chunked|deque|spill/.test(n)) return '基础设施';
  return '其他';
}

const all = [];
for (const layer of LAYERS) {
  if (!fs.existsSync(layer.file)) { console.log(`skip missing ${layer.file}`); continue; }
  all.push(...parsePatch(fs.readFileSync(layer.file, 'utf8'), layer.tag));
}

const presetData = {};
for (const p of PRESETS) {
  const file = `${ROOT}/dsh-web-app/presets/${p}.patch.yml`;
  presetData[p] = fs.existsSync(file) ? parsePatch(fs.readFileSync(file, 'utf8'), `preset ${p}`) : [];
}

const hostRows = all.filter((e) => e.tag !== 'user patch (desktop)');
const userRows = all.filter((e) => e.tag === 'user patch (desktop)');

const OPTIONAL = [
  ['@deepseek-ai/dsh-experimental-agent-team-profile', 'Agent Teams：多智能体协作的工具、宿主能力与 Web 界面'],
  ['@deepseek-ai/dsh-experimental-voice-input-bundle', '本地 SenseVoice 语音输入（首次使用时下载运行时）'],
  ['@deepseek-ai/dsh-experimental-auto-review', 'Auto 权限预设下的逐工具 LLM 授权复核'],
  ['@deepseek-ai/dsh-experimental-schedule-bundle', 'Schedule 定时任务页与 time context'],
];

const TEMPLATES = [
  ['acp', 'dsh-base + dsh-acp-app（编辑器 ACP 接入）'],
  ['web', 'dsh-base + dsh-web-app（Web / 桌面载体现用）'],
  ['headless', 'dsh-base + dsh-headless'],
  ['sdk', 'dsh-base + dsh-sdk-app'],
  ['sdk-minimal', 'dsh-sdk-minimal'],
];

const byCat = new Map();
for (const e of hostRows) {
  const c = category(e);
  if (!byCat.has(c)) byCat.set(c, []);
  byCat.get(c).push(e);
}
const order = ['工具（模型可用）', '智能体能力', '会话与上下文', '模型与账号', '沙箱、审批与文件', '宿主与 API 面', '浏览器界面（client-ui）', '浏览器客户端基础设施', '基础设施', '本地 / 第三方', '其他'];

const md = [];
md.push('# DSH 插件清单（本机实测）');
md.push('');
md.push(`- 运行版本：\`0.2.0-rc.2\`（\`@deepseek-ai/dsh\`，源码仓库 github.com/deepseek-ai/deepseek-harness）`);
md.push(`- profile：\`desktop\`（另有 \`web\`），组合包：\`@deepseek-ai/dsh-base\` + \`@deepseek-ai/dsh-web-app\``);
md.push(`- 宿主面 loader 条目：**${hostRows.length}** 条（base ${hostRows.filter((e) => e.tag === 'base bundle').length} + web-app ${hostRows.filter((e) => e.tag === 'web-app bundle').length}）`);
md.push(`- 用户 patch 层条目：**${userRows.length}** 条`);
md.push('');
md.push('> 数据来源：从 `app.asar` 解出的各 bundle `cordis.patch.yml`、本机 `%USERPROFILE%\\.dsh\\profiles\\desktop\\cordis.patch.yml`、以及 `dsh-app-boot` 中写死的 `OPTIONAL_BUNDLES` / `PROFILE_TEMPLATES`。');
md.push('');

md.push('## 一、随装可选、默认关闭的 4 个官方组合包');
md.push('');
md.push('| 组合包 | 作用 | 状态 |');
md.push('|---|---|---|');
for (const [name, desc] of OPTIONAL) md.push(`| \`${name}\` | ${desc} | 随安装提供、默认关闭、可在插件页开启，不可卸载 |`);
md.push('');

md.push('## 二、随安装提供的 profile 模板');
md.push('');
md.push('| 模板 | 组合包 |');
md.push('|---|---|');
for (const [name, desc] of TEMPLATES) md.push(`| \`${name}\` | ${desc} |`);
md.push('');

md.push('## 三、智能体预设（agent preset，会话级插件组合）');
md.push('');
md.push('| 预设 | 条目数 | 说明 |');
md.push('|---|---|---|');
md.push(`| \`standard\` | ${presetData.standard.length} | 默认预设（\`agent-preset-registry\` 的 \`default: standard\`） |`);
md.push(`| \`ptc\` | ${presetData.ptc.length} | 带 PTC 运行时/工作流变体 |`);
md.push(`| \`minimal\` | ${presetData.minimal.length} | 最小工具面 |`);
md.push(`| \`cordis\` | ${presetData.cordis.length} | 完整编码态：bash/pwsh/fs/subagent/workflow/ralph 等 |`);
md.push('');
md.push('宿主面把工具行关掉、改由预设挂载（`dsh-web-app/cordis.patch.yml` 里成片的 `disabled: true` 就是这些行），所以同一台机器上不同会话可以有不同工具集。');
md.push('');

md.push('## 四、宿主面插件明细（按能力分组）');
md.push('');
for (const cat of order) {
  const rows = byCat.get(cat);
  if (!rows) continue;
  md.push(`### ${cat}（${rows.length}）`);
  md.push('');
  md.push('| 条目 id | 模块 | 状态 |');
  md.push('|---|---|---|');
  for (const e of rows.sort((a, b) => a.id.localeCompare(b.id))) {
    md.push(`| \`${e.id}\` | \`${moduleOf(e)}\` | ${state(e)} |`);
  }
  md.push('');
}

md.push('## 五、本机用户 patch 层（你自己的改动）');
md.push('');
md.push('| 条目 id | 模块 / 配置 | 说明 |');
md.push('|---|---|---|');
for (const e of userRows) md.push(`| \`${e.id}\` | \`${moduleOf(e)}\` | 来自 \`profiles/desktop/cordis.patch.yml\` |`);
md.push('');
md.push('其中 `gpt-quota` 是 \`file:///D:/AA12583/dsh/组件/gpt-quota-plugin/index.mjs\` —— 你本地自写的插件；`llm-pi-ai` 通过 \`openai-api-server-via-codex\` 桥接进程接入了 GPT 系列模型；其余是界面偏好（主题、聊天视图、账号设置）。');
md.push('');
md.push('## 六、清单在哪看 / 怎么改');
md.push('');
md.push('| 入口 | 能力 |');
md.push('|---|---|');
md.push('| 侧边栏「插件」页（`ui-plugin-manager`） | 唯一可写入口：启停条目、选择/安装/删除组合包 |');
md.push('| 设置 →「内置插件」（`ui-settings-plugins` + `ui-settings-plugin-inventory`） | 只读清单快照：加载顺序、启用状态、存活阶段 |');
md.push('| `dsh plugin --profile <name> add|remove|why ...` | 命令行，参数原样转发给 profile 目录里的 pnpm |');
md.push('| `%USERPROFILE%\\.dsh\\profiles\\<profile>\\cordis.patch.yml` | 人工编辑层（最后应用，优先级最高） |');
md.push('');
md.push('安装第三方插件的 spec 形式：npm 包名、绝对本地路径、git 地址、tarball。注册表默认官方 npm，失败回退 `registry.npmmirror.com`；安装前会用 `pnpm view` 检查 DSH peer 版本兼容性。');
md.push('');
md.push('安全边界（来自 `dsh-plugin-manager` 文档）：安装的宿主代码在宿主进程内运行，**不受工作区沙箱限制**；插件管理工具需要 `danger-full-access` 或单次批准；pnpm 依赖构建脚本需另行批准。');
md.push('');

const out = 'D:/AA12583/dsh/组件/DSH-插件清单.md';
fs.writeFileSync(out, md.join('\n'), 'utf8');
console.log(`wrote ${out}: host ${hostRows.length} rows, user ${userRows.length}, presets ${PRESETS.map((p) => p + ':' + presetData[p].length).join(' ')}`);
