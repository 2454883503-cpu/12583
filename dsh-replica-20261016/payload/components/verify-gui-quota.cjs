const fs=require('fs'),crypto=require('crypto'),http=require('http'),yaml=require('C:/Users/tanyu/dsh/node_modules/yaml');
const records=yaml.parse(fs.readFileSync('C:/Users/tanyu/.dsh/.credentials.yaml','utf8')).records;
const secret=Buffer.from(records['client-connection/browser-session'].payload.secret,'base64url');
const authority='127.0.0.1:19387',now=Date.now();
const body=Buffer.from(JSON.stringify({version:1,authority,issuedAt:now,expiresAt:now+600000})).toString('base64url');
const cookie='dsh-auth-'+crypto.createHash('sha256').update(authority).digest('base64url')+'=v1.'+body+'.'+crypto.createHmac('sha256',secret).update(body).digest('base64url');
const path=process.argv[2]||'/';const post=process.argv[3]&&JSON.stringify({type:'client-request',rpcId:crypto.randomUUID(),method:path.replace('/api/',''),payload:{args:{force:true}}});
const req=http.request({host:'127.0.0.1',port:19387,path,method:post?'POST':'GET',headers:{Cookie:cookie,...post?{'Content-Type':'application/json'}:{}}},res=>{let s='';res.on('data',x=>s+=x);res.on('end',()=>{fs.writeFileSync('gui-quota-verify.txt',s);console.log('HTTP',res.statusCode,'length',s.length,'quota present',s.includes('dsh-gpt-quota'));if(post)console.log(s);});});req.on('error',e=>console.log(e.message));req.end(post);
