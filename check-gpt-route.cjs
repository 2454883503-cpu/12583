const fs=require('fs'),crypto=require('crypto'),http=require('http'),yaml=require('C:/Users/tanyu/dsh/node_modules/yaml');
const records=yaml.parse(fs.readFileSync('C:/Users/tanyu/.dsh/.credentials.yaml','utf8')).records;
const secret=Buffer.from(records['client-connection/browser-session'].payload.secret,'base64url');
const authority='127.0.0.1:19387',now=Date.now();
const body=Buffer.from(JSON.stringify({version:1,authority,issuedAt:now,expiresAt:now+600000})).toString('base64url');
const cookie='dsh-auth-'+crypto.createHash('sha256').update(authority).digest('base64url')+'=v1.'+body+'.'+crypto.createHmac('sha256',secret).update(body).digest('base64url');
const call=(endpoint,args={})=>new Promise((resolve,reject)=>{
  const payload=JSON.stringify({type:'client-request',rpcId:crypto.randomUUID(),method:endpoint,payload:{args}});
  const req=http.request({host:'127.0.0.1',port:19387,path:'/api/'+endpoint,method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}},res=>{let s='';res.on('data',x=>s+=x);res.on('end',()=>resolve({status:res.statusCode,body:s}));});
  req.on('error',reject);req.end(payload);
});
(async()=>{
  for(const [endpoint,args] of [['llm/listProviders',{}],['llm/listConfigurableProviders',{}]]){
    const r=await call(endpoint,args);
    let out=r.body;
    try{const j=JSON.parse(r.body);out=JSON.stringify(j.result).slice(0,900);}catch{}
    console.log(`\n== ${endpoint} HTTP ${r.status}\n${out}`);
  }
})().catch(e=>console.log('ERROR',e.message));
