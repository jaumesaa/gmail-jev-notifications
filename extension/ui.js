const $ = id => document.getElementById(id);
let current = null;
async function request(message) {
  if (!globalThis.browser?.runtime) throw new Error('Abre esta pantalla desde la extensión instalada en Safari.');
  const result = await browser.runtime.sendMessage(message);
  if (!result?.ok) throw new Error(result?.error || 'No se pudo completar la acción.');
  return result;
}
function feedback(text, error = false) { $('feedback').textContent = text; $('feedback').classList.toggle('error', error); }
async function refresh(fill = false) {
  const data = await request({type: 'status'});
  current = data.config;
  if (fill) {
    $('criteria').value = current.criteria;
    for (const field of ['threshold', 'dailyLimit', 'model', 'readFull', 'alertStyle']) if ($(field)) $(field).value = String(current[field]);
  }
  if ($('badge')) { $('badge').textContent = current.active ? 'Activo' : 'Pausado'; $('badge').classList.toggle('active', current.active); }
  if ($('readingMode')) $('readingMode').textContent = current.readFull ? 'Lee el cuerpo en una pestaña temporal y restaura el estado sin leer. Mantén Recibidos abierto.' : 'Se evalúan remitente, asunto y vista previa. Mantén Recibidos abierto.';
  const health = Object.values(data.health).filter(item => Date.now() - item.at < 45000);
  $('health').textContent = !current.active ? 'Filtro pausado.' : !health.length ? 'Esperando Gmail: abre Recibidos y permite el acceso de la extensión.' : health.some(item => item.rawRows>0 && item.rows===0) ? 'Gmail ha cambiado su formato. No se pueden leer las filas; hace falta actualizar el adaptador.' : health.some(item => item.unparsed > 0) ? 'Gmail conectado. Algunas fechas no se reconocen; esos mensajes se omiten.' : `Gmail conectado · ${health.length} cuenta(s) en Recibidos`;
  $('usage').textContent = `${data.usage.calls} / ${current.dailyLimit} consultas hoy (UTC) · ${data.pending} pendientes${data.readers ? ` · ${data.readers} pestaña(s) de lectura: revisa su estado sin leer` : ''}`;
  if ($('keyState')) $('keyState').textContent = data.keyConfigured ? 'Clave guardada en el llavero. No se muestra de nuevo.' : 'Todavía no hay una clave guardada.';
  if ($('activity')) {
    $('activity').replaceChildren();
    for (const item of data.activity) {
      const li = document.createElement('li');
      li.textContent = `${new Date(item.at).toLocaleTimeString()} · ${item.status}${typeof item.probability === 'number' ? ` · ${Math.round(item.probability * 100)} %` : ''}${item.fields ? ` · ${item.fields}` : ''}`;
      $('activity').append(li);
    }
  }
}
function on(id, job) {
  $(id)?.addEventListener('click', async () => {
    const button = $(id); button.disabled = true;
    try { await job(); await refresh(); } catch (error) { feedback(error.message, true); }
    finally { button.disabled = false; }
  });
}
async function save(active) {
  const config = {...(current || {}), active, criteria: $('criteria').value};
  for (const field of ['threshold', 'dailyLimit', 'model', 'alertStyle']) if ($(field)) config[field] = $(field).value;
  if ($('readFull')) config.readFull = $('readFull').value === 'true';
  await request({type: 'saveConfig', config});
  feedback(active ? 'Activado. La lista actual se toma como referencia; se evaluarán los correos que lleguen después.' : 'Pausado. No se enviarán nuevas consultas.');
}
on('activate', () => save(true));
on('pause', () => save(false));
on('saveKey', async () => { await request({type: 'saveKey', key: $('key').value}); $('key').value = ''; feedback('Clave guardada. Puedes probar la conexión.'); });
on('deleteKey', async () => { await request({type: 'saveConfig', config: {...current, active: false}}); await request({type: 'deleteKey'}); feedback('Clave borrada y filtro pausado.'); });
on('testKey', async () => { const result = await request({type: 'testKey'}); feedback(`Conexión correcta · ${result.model} · muestra: ${Math.round(result.probability * 100)} % de coincidencia. Esta prueba usa tu saldo.`); });
on('testNotification', async () => { const result = await request({type: 'testNotification'}); feedback(result.warning || 'Aviso de prueba enviado.'); });
on('clearHistory', async () => { await request({type: 'clearHistory'}); feedback('Actividad borrada.'); });
on('settings', async () => { await browser.tabs.create({url: browser.runtime.getURL('settings.html')}); });
refresh(true).catch(error => feedback(error.message, true));
setInterval(() => refresh().catch(() => {}), 5000);
