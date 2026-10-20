const fs=require('fs'),crypto=require('crypto'),http=require('http'),yaml=require('C:/Users/tanyu/dsh/node_modules/yaml');
const records=yaml.parse(fs.readFileSync('C:/Users/tanyu/.dsh/.credentials.yaml','utf8')).records;
const secret=Buffer.from(records['client-connection/browser-session'].payload.secret,'base64url');
const authority='127.0.0.1:19387',now=Date.now();
const body=Buffer.from(JSON.stringify({version:1,authority,issuedAt:now,expiresAt:now+600000})).toString('base64url');
const cookie='dsh-auth-'+crypto.createHash('sha256').update(authority).digest('base64url')+'=v1.'+body+'.'+crypto.createHmac('sha256',secret).update(body).digest('base64url');
const get=(path)=>new Promise((resolve,reject)=>{http.get({host:'127.0.0.1',port:19387,path,headers:{Cookie:cookie}},res=>{let s='';res.on('data',x=>s+=x);res.on('end',()=>resolve({status:res.statusCode,body:s}));}).on('error',reject);});
// Read the SSE graph for a fixed window, then parse every COMPLETE frame (frames can span chunks).
const readGraph=()=>new Promise((resolve)=>{let buf='';const req=http.get({host:'127.0.0.1',port:19387,path:'/plugins/events',headers:{Cookie:cookie}},res=>{res.on('data',b=>{buf+=b.toString();});});const done=()=>{try{req.destroy();}catch{}resolve(buf);};setTimeout(done,2500);req.on('error',()=>resolve(buf));});
(async()=>{
  const raw=await readGraph();
  const frames=raw.split('\n\n').map(s=>s.replace(/^data: /,'')).filter(Boolean).map(s=>{try{return JSON.parse(s);}catch{return null;}}).filter(Boolean);
  console.log('frames parsed:',frames.length,frames.map(f=>f.type).join(','));
  let row=null;
  for(const f of frames) for(const e of (f.graph?.entries||[])) if(String(e.id).includes('quota')) row=e;
  console.log('graph row:',row?JSON.stringify(row):'ABSENT');
  if(row){
    const comboUrl='/'+String(row.url).replace(/^\//,'');
    const combo=await get(comboUrl);
    console.log('combo fetch',combo.status,'bytes',combo.body.length);
    console.log('  has subdued lock svg (strokeLinecap):',combo.body.includes('strokeLinecap'));
    console.log('  still has emoji lock:',combo.body.includes('🔒'));
    console.log('  has lock persistence key:',combo.body.includes('dsh.gpt-quota.locked.v1'));
    const current=fs.readFileSync('gpt-quota-plugin/client.js','utf8');
    console.log('  served bytes === file bytes:',combo.body.length>0&&combo.body.includes(current.slice(0,120)));
  }
})().catch(e=>console.log('ERROR',e.message));
