import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
function fixture(html) {
  const {document}=parseHTML(`<html><body>${html}</body></html>`);
  let result;
  let resolveResult;
  const ready=new Promise(resolve=>resolveResult=resolve);
  const job={id:'abc',wasUnread:true,token:'token'};
  const context={document,browser:{runtime:{sendMessage:async message=>{if(message.type==='readerJob')return {job};result=message.result;resolveResult(result);return {ok:true};}}},setTimeout:fn=>setImmediate(fn),module:{exports:{}}};
  vm.runInNewContext(readFileSync('extension/reader.js','utf8'),context);
  return {document,job,helpers:context.module.exports,run:()=>ready};
}
test('Read the latest visible message with sender and available recipients',()=>{
  const f=fixture('<div class="adn"><div class="a3s">Old body</div></div><div class="adn"><span class="gD" name="Ana" email="ana@example.com"></span><span class="g2" email="me@example.com"></span><div class="a3s">Latest body</div></div>');
  const email=f.helpers.extractBody();
  assert.equal(email.body,'Latest body');
  assert.equal(email.sender,'Ana <ana@example.com>');
  assert.equal(email.recipients[0],'me@example.com');
});
test('Restore unread in the reader tab before returning an extracted body',async()=>{
  const f=fixture('<div class="a3s">Hello</div><div role="button" aria-label="Marcar como no leído"></div>');
  f.helpers.unreadButton().click=()=>{
    f.document.body.innerHTML='<table><tr class="zA zE"><td><span data-legacy-thread-id="abc"><span class="bog">Hello</span></span></td></tr></table>';
  };
  const result=await f.run();
  assert.equal(result.ok,true);assert.equal(result.restored,true);assert.equal(result.email.body,'Hello');
});
test('Do not report success when the unread control is missing',async()=>{
  const f=fixture('<div class="a3s">Hello</div>');
  const result=await f.run();
  assert.equal(result.ok,false);assert.equal(result.restored,false);
});
test('Originally read messages are left read',async()=>{
  const f=fixture('<div class="a3s">Hello</div>'); f.job.wasUnread=false;
  const result=await f.run();assert.equal(result.ok,true);assert.equal(result.restored,true);
});

test('Accept Gmail Spanish unread confirmation while the conversation remains visible',async()=>{
  const f=fixture('<div class="a3s">Hello</div><button aria-label="Marcar como no leído"></button>');
  f.helpers.unreadButton().click=()=>{
    const notice=f.document.createElement('div');notice.setAttribute('role','alert');notice.textContent='Se ha marcado la conversación como no leída.';f.document.body.append(notice);
  };
  const result=await f.run();assert.equal(result.ok,true);assert.equal(result.restored,true);
});
