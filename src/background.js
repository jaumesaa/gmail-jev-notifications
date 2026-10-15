import {DEFAULTS, settings, sanitizeMessage, messageKey, budgetUsage, isFresh, buildRequest, shouldNotify, gmailURL, cleanText} from '../extension/lib/core.js';

const NATIVE_ID = 'io.github.jaumesaa.GmailJev';
let tail = Promise.resolve();
function serial(job) {
  const result = tail.then(job);
  tail = result.catch(() => {});
  return result;
}
async function native(message) {
  const result = await browser.runtime.sendNativeMessage(NATIVE_ID, message);
  if (!result || result.ok !== true) throw new Error(result?.error || 'No se pudo conectar con la app de Gmail con Jev.');
  return result;
}
async function read() {
  const data = await browser.storage.local.get(['config', 'queue', 'seen', 'usage', 'activity', 'health']);
  return {...data, config: settings(data.config || DEFAULTS), queue: data.queue || [], seen: data.seen || [], activity: data.activity || []};
}
async function log(status, extra = {}) {
  const {activity} = await read();
  await browser.storage.local.set({activity: [{at: Date.now(), status, ...extra}, ...activity].slice(0, 40)});
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function readFullMessage(message) {
  const tab = await browser.tabs.create({url:'about:blank', active:false});
  const stored = await browser.storage.local.get('readerJobs');
  const job = {id:message.id, wasUnread:message.wasUnread, token:crypto.randomUUID(), startedAt:Date.now()};
  await browser.storage.local.set({readerJobs:{...(stored.readerJobs || {}), [tab.id]:job}});
  await browser.tabs.update(tab.id, {url:message.threadURL});
  let result = null;
  for (let attempt=0; attempt<30; attempt++) {
    try { result = await browser.tabs.sendMessage(tab.id, {type:'readFull', token:job.token}); if (result) break; }
    catch { await wait(1000); }
  }
  if (result?.restored) {
    const stored = await browser.storage.local.get('readerJobs');
    const jobs = stored.readerJobs || {}; delete jobs[tab.id];
    await browser.storage.local.set({readerJobs:jobs});
    await browser.tabs.remove(tab.id);
  }
  if (!result?.ok) throw new Error(`Lectura de Gmail: ${result?.error || 'No se pudo leer/restaurar el correo. Revisa la pestaña temporal que sigue abierta.'}`);
  return {...message, body:cleanText(result.email.body, 12000), bodyTruncated:String(result.email.body).length>12000, sender:cleanText(result.email.sender || message.sender, 300), recipients:Array.isArray(result.email.recipients) ? result.email.recipients : [], source:'gmail-open-message'};
}
async function enqueue(raw, sender) {
  if (sender.frameId !== 0 || !gmailURL(sender.url) || !sender.tab) throw new Error('Solo se aceptan vistas previas de Gmail.');
  const data = await read();
  if (!data.config.active || raw.revision !== data.config.revision) return {ok: true, ignored: true};
  const message = sanitizeMessage(raw.email || {}, sender.url);
  if (!isFresh(message, data.config.enabledAt)) return {ok: true, ignored: true};
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(messageKey(message)));
  const key = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (data.seen.includes(key)) return {ok: true, ignored: true};
  if (data.queue.length >= 50) throw new Error('Hay demasiados mensajes pendientes. Revisa la conexión.');
  await browser.storage.local.set({
    seen: [...data.seen, key].slice(-2000),
    queue: [...data.queue, {key, message, revision: data.config.revision, attempt: 0, nextAt: 0}]
  });
  await drain();
  return {ok: true};
}
async function drain() {
  // One persistent queue, shared by every Gmail tab; reserve the daily call before I/O.
  let data = await read();
  if (!data.config.active) return;
  let queue = data.queue.filter(item => item.revision === data.config.revision && isFresh(item.message, data.config.enabledAt));
  await browser.storage.local.set({queue});
  const index = queue.findIndex(item => item.nextAt <= Date.now());
  if (index < 0) { if (queue.length) await schedule(); return; }
  const item = queue[index];
  let usage = budgetUsage(data.usage);
  if (usage.calls >= data.config.dailyLimit) {
    await browser.storage.local.set({config: {...data.config, active: false}, queue: []});
    await log('Límite diario alcanzado. El filtro se ha pausado.');
    return;
  }
  try {
    const email = data.config.readFull ? await readFullMessage(item.message) : item.message;
    const beforeCall = await read();
    if (!beforeCall.config.active || beforeCall.config.revision !== item.revision) return;
    usage = {...budgetUsage(beforeCall.usage), calls: budgetUsage(beforeCall.usage).calls + 1};
    await browser.storage.local.set({usage});
    const answer = await native({command: 'evaluate', request: buildRequest(email, data.config)});
    if (!Number.isFinite(answer.probability) || answer.probability < 0 || answer.probability > 1) throw new Error('Respuesta de Jev no válida.');
    const current = await read();
    usage = budgetUsage(current.usage);
    usage.inputTokens += Math.max(0, Number(answer.inputTokens) || 0);
    queue = current.queue.filter(entry => entry.key !== item.key);
    await browser.storage.local.set({usage, queue});
    if (!current.config.active || current.config.revision !== item.revision) return;
    const notify = shouldNotify(answer.probability, current.config.threshold);
    let delivery = '';
    if (notify) {
      try {
        const result = await native({command: 'notify', title: item.message.subject || 'Nuevo correo relevante', body: email.sender, url: item.message.threadURL, style:current.config.alertStyle});
        delivery = result.warning ? ` · ${result.warning}` : ' · aviso enviado';
      } catch (error) { delivery = ` · ${error.message}`; }
    }
    await log(notify ? `Coincide${delivery}` : 'Sin aviso', {probability: answer.probability, model: answer.model, fields: email.body ? 'Remitente, asunto, fecha, vista previa, cuerpo y destinatarios disponibles' : 'Remitente, asunto, fecha y vista previa'});
  } catch (error) {
    const current = await read();
    queue = current.queue.filter(entry => entry.key !== item.key);
    const retryable = !/clave|401|403|422|400|llavero|configura|Lectura de Gmail/i.test(error.message);
    if (retryable && item.attempt < 2 && current.config.active && current.config.revision === item.revision) {
      queue.push({...item, attempt: item.attempt + 1, nextAt: Date.now() + 60000 * 2 ** item.attempt});
    }
    await browser.storage.local.set({queue});
    await log(error.message);
  }
  if (queue.length) await schedule();
}
async function schedule() { await browser.alarms.create('drain', {delayInMinutes: 1}); }
function trustedUI(sender) {
  return !sender.tab?.url?.startsWith('https://') && sender.url?.startsWith(browser.runtime.getURL(''));
}
async function handle(message, sender) {
  if (message?.type === 'readerJob') {
    if (!sender.tab || sender.frameId !== 0 || !gmailURL(sender.url)) return {ok:true,job:null};
    const stored = await browser.storage.local.get('readerJobs');
    return {ok:true,job:stored.readerJobs?.[sender.tab.id] || null};
  }
  if (message?.type === 'email') return enqueue(message, sender);
  if (message?.type === 'health') {
    if (!sender.tab || sender.frameId !== 0 || !gmailURL(sender.url)) throw new Error('Origen no válido.');
    const {health = {}} = await read();
    health[new URL(sender.url).pathname] = {at: Date.now(), ...message.info};
    await browser.storage.local.set({health});
    return {ok: true};
  }
  if (!trustedUI(sender)) throw new Error('Abre los ajustes de la extensión.');
  if (message?.type === 'status') {
    const data = await read();
    const key = await native({command: 'keyStatus'});
    const stored = await browser.storage.local.get('readerJobs');
    return {ok: true, config: data.config, usage: budgetUsage(data.usage), activity: data.activity, health: data.health || {}, keyConfigured: key.configured, pending: data.queue.length, readers:Object.keys(stored.readerJobs || {}).length};
  }
  if (message?.type === 'saveKey') return native({command: 'saveKey', key: message.key});
  if (message?.type === 'deleteKey') return native({command: 'deleteKey'});
  if (message?.type === 'testKey') {
    return native({command: 'evaluate', request: buildRequest({sender: 'Twitch <no-reply@twitch.tv>', subject: 'haeyoday is live on Twitch!', preview: 'haeyoday just went live. Watch VALORANT now.', body:'haeyoday just started a live stream on Twitch. Watch haeyoday streaming VALORANT now.', receivedAt:Date.now(), wasUnread:true, source: 'gmail-open-message'}, {...DEFAULTS, criteria: 'Notify when this email announces that haeyoday has started streaming live on Twitch. Exclude recaps and promotions.'})});
  }
  if (message?.type === 'testNotification') {
    const {config} = await read();
    return native({command: 'notify', title: 'Gmail con Jev está preparado', body: 'Este es un aviso de prueba.', url: 'https://mail.google.com/mail/u/0/#inbox', style:config.alertStyle});
  }
  if (message?.type === 'saveConfig') {
    const config = settings(message.config || {});
    if (config.active && !config.criteria) throw new Error('Escribe qué correos merecen un aviso.');
    if (config.active && !(await native({command: 'keyStatus'})).configured) throw new Error('Configura primero tu clave de TypeSafe.');
    config.revision = crypto.randomUUID();
    config.enabledAt = Date.now();
    await browser.storage.local.set({config, queue: [], health: {}});
    await log(config.active ? 'Filtro activado. Esperando correos nuevos.' : 'Filtro pausado.');
    return {ok: true};
  }
  if (message?.type === 'clearHistory') {
    await browser.storage.local.set({activity: []});
    return {ok: true};
  }
  throw new Error('Acción desconocida.');
}
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Pausing invalidates in-flight decisions immediately, without waiting for Jev.
  const immediate = message?.type === 'readerJob' || (message?.type === 'saveConfig' && trustedUI(sender));
  const result = immediate ? handle(message, sender) : serial(() => handle(message, sender));
  result.then(sendResponse, error => sendResponse({ok: false, error: error.message}));
  return true; // Keep Safari's response channel alive through native async work.
});
browser.alarms.onAlarm.addListener(alarm => {if (alarm.name === 'drain') serial(drain).catch(() => {});});
browser.runtime.onInstalled.addListener(() => serial(async () => {
  const data = await browser.storage.local.get('config');
  if (!data.config) await browser.storage.local.set({config: DEFAULTS});
  await schedule();
}));
browser.runtime.onStartup.addListener(() => serial(schedule).catch(() => {}));
