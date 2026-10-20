import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import net from 'node:net';
import { existsSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DEFAULT_BRIDGE_DIR = 'D:\\AA12583\\dsh\\组件\\openai-api-server-via-codex';
const DEFAULT_PORT = 18080;
const DEFAULT_PROXY = 'http://127.0.0.1:7892';
const EXE_NAME = 'openai-api-server-via-codex.exe';

/** Best-effort diagnostic trail next to this package. DSH writes no host log
 * when startup succeeds, so this is the only way to see why the bridge did not
 * come up. Never throws. */
export function trace(message) {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    appendFileSync(join(here, 'autostart.log'), `${new Date().toISOString()} ${message}\n`, 'utf8');
  } catch { }
}

/** Normalize plugin config plus environment overrides into one settings object.
 * Relative or empty values fall back to the source-machine defaults so a
 * partial patch entry can never produce an unusable spawn. */
export function resolveSettings(config = {}, env = process.env) {
  const pick = (value, fallback) => (typeof value === 'string' && value.trim() ? value.trim() : fallback);
  const proxy = pick(config.proxyURL, pick(env.DSH_LOCAL_PROXY, DEFAULT_PROXY));
  const bridgeDir = pick(config.bridgeDir, DEFAULT_BRIDGE_DIR);
  const parsedPort = Number(config.port);
  const parsedRetries = Number(config.maxRetries);
  const parsedRetryDelay = Number(config.retryDelayMs);
  return {
    bridgeDir,
    execPath: join(bridgeDir, EXE_NAME),
    port: Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort < 65536 ? parsedPort : DEFAULT_PORT,
    authPath: pick(config.authPath, join(homedir(), '.codex-chatgpt', 'auth.json')),
    proxyURL: proxy,
    graceMs: Number.isInteger(config.graceMs) && config.graceMs >= 0 ? config.graceMs : 10000,
    // Retries cover the boot race with a separately started bridge (e.g. the
    // Windows Startup shortcut): one bounded retry by default.
    maxRetries: Number.isInteger(parsedRetries) && parsedRetries >= 0 ? parsedRetries : 1,
    retryDelayMs: Number.isInteger(parsedRetryDelay) && parsedRetryDelay >= 0 ? parsedRetryDelay : 5000,
  };
}

/** True when something already accepts TCP connections on the port. */
export function isPortUp(port, host = '127.0.0.1', timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

/** Problem strings for preconditions that would make the spawn pointless. */
export function diagnose(settings) {
  const problems = [];
  if (!existsSync(settings.execPath)) problems.push(`bridge executable not found: ${settings.execPath}`);
  if (!existsSync(settings.authPath)) problems.push(`codex credentials not found: ${settings.authPath}`);
  return problems;
}

/** The fully explicit ctx.subprocess.spawn() spec for the bridge.
 * stdin is ignored (the bridge is an HTTP server, not a REPL), and the child
 * environment states the proxy explicitly because the harness scrubs
 * credential-shaped and DSH_* names from inherited environments. */
export function spawnSpec(settings) {
  return {
    argv: [settings.execPath, '-auth-json', settings.authPath, '-port', String(settings.port), '-verbose'],
    cwd: settings.bridgeDir,
    stdio: {
      stdin: 'ignore',
      stdout: { maxBytes: 8 * 1024 },
      stderr: { maxBytes: 16 * 1024 },
    },
    graceMs: settings.graceMs,
    env: {
      HTTPS_PROXY: settings.proxyURL,
      HTTP_PROXY: settings.proxyURL,
      NO_PROXY: 'localhost,127.0.0.1',
    },
  };
}
