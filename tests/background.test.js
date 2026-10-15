import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {DEFAULTS} from '../extension/lib/core.js';

async function setup({dailyLimit=100, evaluate, reader, notify, bundled=false}={}) {
  const values = {config:{...DEFAULTS, readFull:false, active:true, criteria:'Notify haeyoday stream starts', revision:'r1', enabledAt:Date.now()-60000, dailyLimit}};
  const calls=[];
  let listener;
  globalThis.browser = {
    storage:{local:{get:async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(key=>[key, structuredClone(values[key])])), set:async data=>Object.assign(values, structuredClone(data))}},
    runtime:{getURL:path=>'safari-web-extension://trusted/'+path, onMessage:{addListener:fn=>listener=fn}, onInstalled:{addListener(){}}, onStartup:{addListener(){}}, sendNativeMessage:async(id, message)=>{
      calls.push(message);
      if(message.command==='keyStatus')return {ok:true,configured:true};
      if(message.command==='evaluate')return evaluate?evaluate(message):{ok:true,probability:0.95,model:'jev-1.13.0',inputTokens:200};
      if(message.command==='notify' && notify)return notify(message);
      return {ok:true};
    }},
    alarms:{create:async()=>{},onAlarm:{addListener(){}}}
  };
  browser.tabs = {
    create:async options=>{calls.push({command:'createTab',options});return {id:91};},
    update:async(id, options)=>{assert.ok(values.readerJobs[id]);calls.push({command:'updateTab',id,options});},
    sendMessage:async(id,message)=>reader ? reader(id,message) : {ok:true,restored:true,email:{body:'Full message body',sender:'Ana <ana@example.com>',recipients:['me@example.com']}},
    remove:async id=>calls.push({command:'removeTab',id})
  };
  if(bundled) vm.runInThisContext(readFileSync('extension/background.js','utf8'));
  else await import(`../src/background.js?test=${crypto.randomUUID()}`);
  const sender={url:'https://mail.google.com/mail/u/0/#inbox',tab:{id:1,url:'https://mail.google.com/mail/u/0/#inbox'},frameId:0};
  const ui={url:'safari-web-extension://trusted/popup.html'};
  const email=(id='abc')=>({type:'email',revision:'r1',email:{id,subject:'haeyoday is live!',sender:'Twitch',preview:'Watch now',receivedAt:Date.now()}});
  return {values,calls,send:(message, source=sender)=>new Promise(resolve=>listener(message,source,resolve)),email,ui,sender};
}
test('Deduplicate identical arrivals from multiple Gmail tabs and store only a hash', async()=>{
  const f=await setup();const message=f.email();
  await Promise.all([f.send(message),f.send(message,{...f.sender,tab:{id:2}})]);
  assert.equal(f.calls.filter(x=>x.command==='evaluate').length,1);
  assert.equal(f.calls.filter(x=>x.command==='notify').length,1);
  assert.match(f.values.seen[0],/^[a-f0-9]{64}$/);
  assert.equal(f.values.queue.length,0);
});
test('Reject page-origin settings and messages from subframes', async()=>{
  const f=await setup();
  assert.equal((await f.send({type:'saveKey',key:'secret'})).ok,false);
  assert.equal((await f.send(f.email(),{...f.sender,frameId:1})).ok,false);
  assert.equal(f.calls.length,0);
});
test('Reserve daily calls before network; pause when budget is exhausted', async()=>{
  const f=await setup({dailyLimit:1});
  await f.send(f.email('first'));await f.send(f.email('second'));
  assert.equal(f.calls.filter(x=>x.command==='evaluate').length,1);
  assert.equal(f.values.config.active,false);
  assert.equal(f.values.queue.length,0);
});
test('Offline errors stay pending with delayed retry, never become a negative decision', async()=>{
  const f=await setup({evaluate:async()=>{throw new Error('TypeSafe no responde');}});
  await f.send(f.email());
  assert.equal(f.values.queue.length,1);
  assert.equal(f.values.queue[0].attempt,1);
  assert.ok(f.values.queue[0].nextAt>Date.now());
  assert.equal(f.calls.filter(x=>x.command==='notify').length,0);
});
test('Pausing during an outstanding Jev request prevents its notification', async()=>{
  let release;
  const f=await setup({evaluate:()=>new Promise(resolve=>release=resolve)});
  const pending=f.send(f.email());
  while(!release)await new Promise(resolve=>setImmediate(resolve));
  await f.send({type:'saveConfig',config:{...f.values.config,active:false}},f.ui);
  release({ok:true,probability:0.99,model:'jev-1.13.0',inputTokens:200});
  await pending;
  assert.equal(f.values.config.active,false);
  assert.equal(f.calls.filter(x=>x.command==='notify').length,0);
});
test('Authentication failure is reported and not retried', async()=>{
  const f=await setup({evaluate:async()=>({ok:false,error:'Clave rechazada (401)'})});
  await f.send(f.email());
  assert.equal(f.values.queue.length,0);
  assert.match(f.values.activity[0].status,/401/);
});
test('Full reader registers a job before navigation, restores/closes and includes body/recipients', async()=>{
  const f=await setup(); f.values.config.readFull=true;
  await f.send(f.email());
  assert.equal(f.calls.find(x=>x.command==='createTab').options.active,false);
  const evaluation=f.calls.find(x=>x.command==='evaluate');
  assert.equal(evaluation.request.state.email.body,'Full message body');
  assert.deepEqual(evaluation.request.state.email.recipients,['me@example.com']);
  assert.equal(f.calls.filter(x=>x.command==='removeTab').length,1);
  assert.deepEqual(f.values.readerJobs,{});
});
test('Failed unread restoration leaves the tab open, does not call Jev and is not retried', async()=>{
  const f=await setup({reader:async()=>({ok:false,restored:false,error:'Cannot restore unread'})}); f.values.config.readFull=true;
  await f.send(f.email());
  assert.equal(f.calls.filter(x=>x.command==='removeTab').length,0);
  assert.equal(f.calls.filter(x=>x.command==='evaluate').length,0);
  assert.equal(f.values.queue.length,0);
  assert.ok(f.values.readerJobs[91]);
  assert.match(f.values.activity[0].status,/Lectura de Gmail/);
});

test('Selected notification channel is forwarded and native handoff warnings are preserved', async()=>{
  const f=await setup({notify:()=>({ok:true,warning:'Solicitud enviada a GmailJev.'})});
  f.values.config.alertStyle='panel';
  await f.send(f.email());
  assert.equal(f.calls.find(x=>x.command==='notify').style,'panel');
  assert.match(f.values.activity[0].status,/Solicitud enviada/);
  f.values.config.alertStyle='system';
  assert.equal((await f.send({type:'testNotification'},f.ui)).warning,'Solicitud enviada a GmailJev.');
  assert.equal(f.calls.filter(x=>x.command==='notify').at(-1).style,'system');
  assert.equal((await f.send({type:'testNotification'})).ok,false);
});

test('Packaged classic background preserves Spanish accents without relying on document encoding',async()=>{
  const source=readFileSync('extension/background.js','utf8');
  assert.equal(/[^\x00-\x7f]/.test(source),false);
  const f=await setup({bundled:true});
  await f.send({type:'testNotification'},f.ui);
  assert.equal(f.calls.find(x=>x.command==='notify').title,'Gmail con Jev está preparado');
});
