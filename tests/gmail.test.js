import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';

function fixture() {
  const {document} = parseHTML('<html><body><table><tbody></tbody></table></body></html>');
  let change, interval;
  const storageChange = [];
  const sent = [];
  const now = Date.now();
  const config = {active:true, revision:'r1', enabledAt:now-60000};
  const context = {
    document, location:{pathname:'/mail/u/0/', hash:'#inbox'}, window:{addEventListener(){}},
    MutationObserver: class {constructor(fn){change=fn;} observe(){}},
    setTimeout: fn => {interval=fn; return 1;}, clearTimeout(){}, setInterval: fn => {interval=fn;},
    browser: {storage:{local:{get:async()=>({config})}, onChanged:{addListener:fn=>storageChange.push(fn)}}, runtime:{sendMessage:async m=>{sent.push(m);return {ok:true};}}},
    module:{exports:{}}, Date, console
  };
  vm.runInNewContext(readFileSync('extension/gmail.js','utf8'), context);
  return {document, context, sent, config, helpers:context.module.exports, scan:async()=>{interval();await new Promise(r=>setImmediate(r));}, row:(id, subject, date=new Date().toString()) => {
    const row = document.createElement('tr'); row.className='zA';
    row.innerHTML = `<td class="yW"><span email="test@example.com" name="Test">Test</span></td><td><span class="bog" data-legacy-thread-id="${id}">${subject}</span><span class="y2"> - Preview</span></td><td class="xW"><span title="${date}">Now</span></td>`;
    document.querySelector('tbody').prepend(row); return row;
  }};
}
test('Read Spanish and English Gmail timestamps without confusing month mar with weekday', () => {
  const {helpers} = fixture();
  for (const text of ['Thu, Oct 15, 2026, 7:03 PM', 'jue, 15 oct 2026, 19:03', '15 de octubre de 2026, 19:03', '15 mar 2026, 19:03']) assert.ok(helpers.timestamp(text)>0, text);
  assert.equal(helpers.timestamp('not a date'), 0);
});
test('Baseline old inbox; evaluate a new preview once; detect reply on same thread', async () => {
  const f=fixture();
  f.row('old','Old message'); await f.scan();
  assert.equal(f.sent.filter(x=>x.type==='email').length,0);
  const row=f.row('new','haeyoday is live!'); await f.scan(); await f.scan();
  assert.equal(f.sent.filter(x=>x.type==='email').length,1);
  row.querySelector('.y2').textContent=' - A new reply'; await f.scan();
  assert.equal(f.sent.filter(x=>x.type==='email').length,2);
});
test('Navigation and paused mode do not send old or newly rendered messages', async () => {
  const f=fixture(); f.row('old','Old'); await f.scan();
  f.context.location.hash='#search/test'; f.row('search','Search result'); await f.scan();
  f.context.location.hash='#inbox'; await f.scan();
  f.config.active=false; f.row('paused','Paused message'); await f.scan();
  assert.equal(f.sent.filter(x=>x.type==='email').length,0);
});
test('Unknown or historical timestamps fail closed and report health', async () => {
  const f=fixture(); f.row('baseline','Old'); await f.scan();
  f.row('bad','No timestamp','unknown'); f.row('ancient','Historical','Oct 1, 2026, 12:00'); await f.scan();
  assert.equal(f.sent.filter(x=>x.type==='email').length,0);
  assert.ok(f.sent.some(x=>x.type==='health'&&x.info.unparsed===1));
});

test('Read the thread identifier when Gmail places it around the subject',()=>{
  const f=fixture();
  const row=f.row('abc123','Synthetic subject');
  const subject=row.querySelector('.bog');
  subject.removeAttribute('data-legacy-thread-id');
  const wrapper=f.document.createElement('span');
  wrapper.setAttribute('data-legacy-thread-id','abc123');
  subject.replaceWith(wrapper); wrapper.append(subject);
  assert.equal(f.helpers.extract(row).id,'abc123');
});
