import { resolveSettings, isPortUp, diagnose, spawnSpec, trace } from './lib.mjs';

// Start (and keep) the openai-api-server-via-codex bridge alive for the whole
// DSH session, so the `gpt-local` provider in llm-pi-ai is reachable as soon as
// DSH starts. DSH's subprocess service owns the child: disposing the service
// terminates the managed process range, so the bridge never outlives the app.

// Diagnostic trail: proves the module loaded, and in which process.
trace(`module evaluated pid=${process.pid} type=${process.type ?? 'node'}`);

// `subprocess` is provided by @deepseek-ai/dsh-subprocess-local in the desktop
// composition. Declaring it here makes Cordis defer apply() until the service
// is live, which is simpler and safer than polling for it.
export const inject = ['subprocess'];

// Explicit identity so the loader's plugin-name resolution has something to read.
export const name = 'gpt-bridge-autostart';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function apply(ctx) {
  const log = ctx.logger ?? console;
  // `ctx.config` is a service-backed accessor that throws without its own
  // inject entry; the fiber's raw config is what the loader validated.
  const config = ctx.fiber?._config ?? {};
  const settings = resolveSettings(config);

  trace(`apply() entered; port=${settings.port} bridgeDir=${settings.bridgeDir}`);

  let handle = null;
  let cancelled = false;
  let attempts = 0;

  async function ensureBridge() {
    if (cancelled) return;
    attempts++;

    const problems = diagnose(settings);
    if (problems.length > 0) {
      for (const problem of problems) { log.warn(`[gpt-bridge] ${problem}`); trace(`precondition: ${problem}`); }
      log.warn('[gpt-bridge] bridge not started; the gpt-local provider stays unreachable until this is fixed');
      return;
    }

    if (await isPortUp(settings.port)) {
      log.info(`[gpt-bridge] 127.0.0.1:${settings.port} already accepting connections; leaving it alone`);
      trace(`port ${settings.port} already up; not spawning`);
      return;
    }
    if (cancelled) return;

    let spec;
    try {
      spec = spawnSpec(settings);
      handle = ctx.subprocess.spawn(spec);
      trace(`spawn() accepted; argv=${JSON.stringify(spec.argv)}`);
    } catch (error) {
      log.error(`[gpt-bridge] spawn failed: ${error?.message ?? error}`);
      trace(`spawn threw: ${error?.stack ?? error?.message ?? error}`);
      return;
    }

    log.info(`[gpt-bridge] started ${settings.execPath} on port ${settings.port}`);

    // Wait for readiness without failing the plugin load: DSH must keep working
    // even when the local proxy or the Codex credentials are broken.
    for (let i = 0; i < 20 && !cancelled; i++) {
      await wait(250);
      if (await isPortUp(settings.port)) {
        log.info(`[gpt-bridge] ready on 127.0.0.1:${settings.port}`);
        trace(`ready on 127.0.0.1:${settings.port}`);
        break;
      }
      if (handle.exitCode !== undefined) {
        trace(`exited before ready; exitCode=${handle.exitCode}`);
        break;
      }
    }

    const current = handle;
    current.done.then(
      ({ exitCode, signal }) => {
        if (cancelled) return;
        let stderr = '';
        try { stderr = current.collected?.stderr?.readFrom?.(0)?.toString('utf8')?.trim() ?? ''; } catch { }
        log.warn(`[gpt-bridge] exited (code=${exitCode} signal=${signal ?? 'none'})${stderr ? `: ${stderr.split('\n').slice(-3).join(' | ')}` : ''}`);
        trace(`exited code=${exitCode} signal=${signal ?? 'none'} stderr=${stderr.replace(/\n/g, ' | ')}`);
        // Bounded retries cover the boot race with a separately started bridge
        // (the Windows Startup shortcut) without retrying forever.
        if (attempts <= settings.maxRetries && exitCode !== 0) {
          log.info(`[gpt-bridge] retry ${attempts}/${settings.maxRetries} in ${settings.retryDelayMs}ms`);
          trace(`scheduling retry ${attempts}/${settings.maxRetries}`);
          setTimeout(() => { ensureBridge(); }, settings.retryDelayMs);
        }
      },
      (error) => { log.warn(`[gpt-bridge] wait failed: ${error?.message ?? error}`); trace(`wait failed: ${error?.message ?? error}`); },
    );
  }

  // ctx.effect is the Cordis lifecycle hook: the returned disposer runs when
  // the plugin is unloaded or the app shuts down.
  try {
    ctx.effect(() => {
      const running = ensureBridge();
      return async () => {
        cancelled = true;
        trace('dispose() called');
        await running.catch(() => { });
        if (handle) {
          try { handle.terminate(); } catch (error) { log.warn(`[gpt-bridge] terminate failed: ${error?.message ?? error}`); }
        }
      };
    }, 'gpt-bridge-autostart');
  } catch (error) {
    log.error(`[gpt-bridge] could not register lifecycle effect: ${error?.message ?? error}`);
    trace(`effect threw: ${error?.stack ?? error?.message ?? error}`);
  }
}
