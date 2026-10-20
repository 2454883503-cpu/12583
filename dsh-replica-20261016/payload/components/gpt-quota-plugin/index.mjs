import { homedir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createQuotaReader, defaultProxyURL } from './quota.mjs';
// REPLICA NOTE: the placeholder on line 9 is replaced by restore.ps1 with this
// machine's DSH install root. The resolved path must stay INSIDE app.asar so
// that Electron's asar-aware resolver can reach the bundled @deepseek-ai
// packages.
const runtimeRequire=createRequire('__DSH_INSTALL_DIR__/resources/app.asar/dsh/package.json');
const {TypertRemoteService,Remote}=await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-typert-protocol')).href);
export const inject = ['typert'];
export function apply(ctx) {
  const read = createQuotaReader({authPath:join(homedir(),'.codex-chatgpt','auth.json'),proxyURL:defaultProxyURL()});
  const initializers=[];
  class QuotaController extends TypertRemoteService {
    constructor(ctx){super(ctx,'gptQuota');for(const init of initializers)init.call(this);}
    async read(force){return read({force:force===true});}
  }
  Remote(QuotaController.prototype.read,{kind:'method',name:'read',static:false,private:false,addInitializer:fn=>initializers.push(fn)});
  new QuotaController(ctx);
}
