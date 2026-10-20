const fs=require('fs'),crypto=require('crypto'),http=require('http'),yaml=require('C:/Users/tanyu/dsh/node_modules/yaml');
const records=yaml.parse(fs.readFileSync('C:/Users/tanyu/.dsh/.credentials.yaml','utf8')).records;
const secret=Buffer.from(records['client-connection/browser-session'].payload.secret,'base64url');
const authority='127.0.0.1:19387',now=Date.now();
const body=Buffer.from(JSON.stringify({version:1,authority,issuedAt:now,expiresAt:now+600000})).toString('base64url');
const cookie='dsh-auth-'+crypto.createHash('sha256').update(authority).digest('base64url')+'=v1.'+body+'.'+crypto.createHmac('sha256',secret).update(body).digest('base64url');
const request=(opts,payload)=>new Promise((resolve,reject)=>{const req=http.request(opts,res=>{let s='';res.on('data',x=>s+=x);res.on('end',()=>resolve({status:res.statusCode,body:s,headers:res.headers}));});req.on('error',reject);req.end(payload);});
const dsh=(endpoint,args={})=>request({host:'127.0.0.1',port:19387,path:'/api/'+endpoint,method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'}},JSON.stringify({type:'client-request',rpcId:crypto.randomUUID(),method:endpoint,payload:{args}}));
const bridge=(path,payload)=>request({host:'127.0.0.1',port:18080,path,method:payload?'POST':'GET',headers:payload?{'Content-Type':'application/json'}:{}},payload);
const brief=v=>{try{const j=JSON.parse(v);return JSON.stringify(j.result??j).slice(0,700);}catch{return String(v).slice(0,300);}};
(async()=>{
  console.log('1) bridge healthz:',(await bridge('/healthz')).body.trim());
  const models=await bridge('/v1/models');
  let ids=[];try{ids=JSON.parse(models.body).data.map(m=>m.id);}catch{}
  console.log('2) bridge /v1/models HTTP',models.status,'->',ids.join(', ')||'(unparsed)');
  const reg=await dsh('llm/discoverModels',{settingsNs:'llm-pi-ai',request:{provider:'gpt-local'}});
  console.log('3) DSH route registry (gpt-local) HTTP',reg.status,'->',brief(reg.body));
  const live=await dsh('llm/discoverModels',{settingsNs:'llm-pi-ai',request:{baseURL:'http://127.0.0.1:18080/v1',api:'openai-completions',apiKey:'dummy'}});
  console.log('4) DSH -> bridge network probe HTTP',live.status,'->',brief(live.body));
  const completion=await bridge('/v1/chat/completions',JSON.stringify({model:'gpt-6.1-sol',messages:[{role:'user',content:'Reply with exactly: DISPATCH_OK'}],max_tokens:16}));
  let text='';try{text=JSON.parse(completion.body).choices[0].message.content;}catch{text=String(completion.body).slice(0,200);}
  console.log('5) real GPT completion HTTP',completion.status,'->',JSON.stringify(text));
})().catch(e=>console.log('ERROR',e.message));
