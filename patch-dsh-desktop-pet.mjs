#!/usr/bin/env node
/**
 * 修补 dsh-desktop-pet，使其能在 DSH Desktop 0.2.0-rc.2 上加载。
 *
 * 背景
 * ────
 * dsh-desktop-pet@0.2.0 是按 DSH 客户端 0.0.1-rc.x 时代写的，整套 client 半用的
 * 都是已被 DSH 0.2.0-rc.2 改名/移除的东西，导致它在 web boot 阶段直接失败：
 *
 *   1) require("@deepseek-ai/dsh-client-runtime/client") missed the module table
 *      —— 快照存储能力已从 @deepseek-ai/dsh-client-runtime 拆到
 *         @deepseek-ai/dsh-client-store（rc.2 里前者根本不存在）
 *
 *   2) dsh-desktop-pet: pending (waiting for service: settingsScope)
 *      —— rc.2 里没有 settingsScope 这个服务了。官方同款插件
 *         dsh-client-ui-settings-subagent@0.2.0-rc.2 的标准写法是：
 *           inject: ["slots", "locale", "configForms"]
 *           ctx.configForms.get(NS)            取绑定到该命名空间的表单
 *           ctx.configForms.whileServed([NS])  等 Host 服务该命名空间
 *           ctx.slots.inject("plugins.item")   挂到插件设置页（旧的
 *                                              "settings.plugin.item" 槽名已不存在）
 *
 * 做法
 * ────
 * 改 node_modules/dsh-desktop-pet/ 下两个文件：
 *   package.json —— dsh.client.inject 与 devDependencies 里的包名
 *   lib/client.js —— require 路径、inject 列表、scope 获取方式、插槽名、whileServed 包裹
 *
 * 幂等：重复执行安全。pnpm 重装插件会覆盖 node_modules，重装后重跑本脚本即可。
 *
 * 用法：node patch-dsh-desktop-pet.mjs [profile目录]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const profile = process.argv[2] || join(homedir(), '.dsh', 'profiles', 'desktop');
const pet = join(profile, 'node_modules', 'dsh-desktop-pet');

if (!existsSync(pet)) {
  console.error(`[pet-patch] 未找到插件目录：${pet}`);
  console.error('[pet-patch] 先用 dsh 装上 dsh-desktop-pet，再跑本脚本。');
  process.exit(1);
}

let changed = 0;
const log = (msg) => { changed++; console.log('[pet-patch] ' + msg); };

/* ── 1. package.json ─────────────────────────────────────────────── */
const pkgPath = join(pet, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

const inject = pkg?.dsh?.client?.inject;
if (Array.isArray(inject) && inject.includes('@deepseek-ai/dsh-client-runtime')) {
  pkg.dsh.client.inject = inject.map((id) =>
    id === '@deepseek-ai/dsh-client-runtime' ? '@deepseek-ai/dsh-client-store' : id);
  log('package.json inject: dsh-client-runtime → dsh-client-store');
}
const dev = pkg?.devDependencies;
if (dev && dev['@deepseek-ai/dsh-client-runtime']) {
  delete dev['@deepseek-ai/dsh-client-runtime'];
  dev['@deepseek-ai/dsh-client-store'] = '^0.2.0-rc.2';
  log('package.json devDependencies: dsh-client-runtime → dsh-client-store');
}
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

/* ── 2. lib/client.js ────────────────────────────────────────────── */
const clientPath = join(pet, 'lib', 'client.js');
if (existsSync(clientPath)) {
  let src = readFileSync(clientPath, 'utf8');
  const before = src;

  /* 2a. require 路径（两种形态都收敛到单行） */
  src = src.replace(
    /let _deepseek_ai_dsh_client_store = require\("@deepseek-ai\/dsh-client-store"\);\s*let _deepseek_ai_dsh_client_runtime_client = _deepseek_ai_dsh_client_store;/,
    'let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-store");');
  src = src.replace(
    'require("@deepseek-ai/dsh-client-runtime/client")',
    'require("@deepseek-ai/dsh-client-store")');

  /* 2b. inject 列表里的 settingsScope → configForms */
  src = src.replace(
    /const inject = \[\s*"slots",\s*"locale",\s*"settingsScope"\s*\];/,
    'const inject = [\n\t\t\t"slots",\n\t\t\t"locale",\n\t\t\t"configForms"\n\t\t];');

  /* 2c. scope 获取 + 插槽名 + whileServed 包裹（整段替换，幂等） */
  const OLD_APPLY = `			const controller = new DesktopPetCardController(ctx.settingsScope.bind({ namespace: DESKTOP_PET_NS }));
			ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
				name: "settings.plugin.item",
				id: "desktop-pet",
				order: 30,
				locale: NS,
				inject: () => controller.inject()
			}, DesktopPetCard));`;

  const NEW_APPLY = `			const controller = new DesktopPetCardController(ctx.configForms.get(DESKTOP_PET_NS));
			ctx.effect(() => ctx.configForms.whileServed([DESKTOP_PET_NS], () => ctx.slots.inject("plugins.item", () => ctx.slots.register({
				name: "plugins.item",
				id: "desktop-pet",
				order: 30,
				locale: NS,
				inject: () => controller.inject()
			}, DesktopPetCard))), "ui-desktop-pet: page");`;

  if (src.includes(OLD_APPLY)) src = src.replace(OLD_APPLY, NEW_APPLY);

  if (src !== before) {
    writeFileSync(clientPath, src, 'utf8');
    log('lib/client.js: require / inject / scope / 插槽名 已适配 rc.2');
  }
}

console.log(changed
  ? `[pet-patch] 完成，改动 ${changed} 处。重启 DSH 后桌面宠物应可加载。`
  : '[pet-patch] 无需改动（已是最新状态）。');
