import { homedir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createQuotaReader } from './quota.mjs';
const runtimeRequire=createRequire('D:/AA12583/dsh/resources/app.asar/dsh/package.json');
const {TypertRemoteService,Remote}=await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-typert-protocol')).href);
export const inject = ['typert'];
export function apply(ctx) {
  const read = createQuotaReader({authPath:join(homedir(),'.codex-chatgpt','auth.json'),proxyURL:'http://127.0.0.1:7892'});
  const initializers=[];
  class QuotaController extends TypertRemoteService {
    constructor(ctx){super(ctx,'gptQuota');for(const init of initializers)init.call(this);}
    async read(force){return read({force:force===true});}
  }
  Remote(QuotaController.prototype.read,{kind:'method',name:'read',static:false,private:false,addInitializer:fn=>initializers.push(fn)});
  new QuotaController(ctx);
}
