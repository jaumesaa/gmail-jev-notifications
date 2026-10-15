(() => {
  const api = globalThis.browser;
  let config = null, route = '', baseline = new Map(), initialized = false, timer = null, readerTab = false;
  const months = {ene:'jan', enero:'jan', febrero:'feb', mar:'mar', marzo:'mar', abr:'apr', abril:'apr', mayo:'may', jun:'jun', junio:'jun', jul:'jul', julio:'jul', ago:'aug', agosto:'aug', sept:'sep', septiembre:'sep', oct:'oct', octubre:'oct', nov:'nov', noviembre:'nov', dic:'dec', diciembre:'dec'};
  function timestamp(text) {
    const normalized = String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/\bde\b/g, ' ').replace(/^(lun|lunes|mar|martes|mie|miercoles|jue|jueves|vie|viernes|sab|sabado|dom|domingo)\b,?/, '')
      .replace(/\b[a-z]+\b/g, word => months[word] || word).replace(/a\.?\s*m\.?/g, 'AM').replace(/p\.?\s*m\.?/g, 'PM').replace(/\s+/g, ' ').trim();
    return Date.parse(normalized) || 0;
  }
  function extract(row) {
    const subjectNode = row.querySelector('.bog');
    const id = subjectNode?.dataset.legacyThreadId || row.dataset.legacyThreadId || row.querySelector('[data-legacy-thread-id]')?.dataset.legacyThreadId || subjectNode?.dataset.threadId;
    const senderNodes = [...row.querySelectorAll('.yW [email]')];
    const date = row.querySelector('.xW [title]');
    if (!id || !date) return null;
    return {
      id, sender: senderNodes.map(node => `${node.getAttribute('name') || node.textContent} <${node.getAttribute('email')}>`).join(', '),
      subject: subjectNode.textContent?.trim() || '', preview: (row.querySelector('.y2')?.textContent || '').replace(/^\s*-\s*/, ''),
      receivedAt: timestamp(date.getAttribute('title')), wasUnread: row.classList.contains('zE')
    };
  }
  function signature(email) { return JSON.stringify(email); }
  async function scan() {
    if (readerTab || !config?.active) { initialized = false; baseline.clear(); return; }
    // Only the inbox. Navigation/search/category changes establish a new baseline.
    const nextRoute = location.pathname + location.hash;
    if (nextRoute !== route) { route = nextRoute; initialized = false; baseline.clear(); }
    if (!/^#inbox(?:$|\?)/.test(location.hash)) return;
    const rows = [...document.querySelectorAll('tr.zA')];
    if (!rows.length && !document.querySelector('[role="main"]')) return;
    const messages = rows.map(extract).filter(Boolean);
    let unparsed = 0;
    for (const email of messages) {
      const key = signature(email);
      const previous = baseline.get(email.id);
      if (initialized && previous !== key && email.receivedAt >= config.enabledAt - 60000 && Date.now() - email.receivedAt < 15 * 60000) {
        // The background enforces freshness and global deduplication again.
        const result = await api.runtime.sendMessage({type: 'email', revision: config.revision, email});
        if (result?.ok === false) continue; // Retry on the next scan, not a busy loop.
      }
      baseline.set(email.id, key);
      if (!email.receivedAt) unparsed++;
    }
    initialized = true;
    await api.runtime.sendMessage({type: 'health', info: {rows: messages.length, rawRows: rows.length, unparsed, source: 'Recibidos', fields: ['remitente', 'asunto', 'fecha', 'vista previa']}});
  }
  let busy = false;
  async function run() {
    if (busy) return;
    busy = true;
    try { await scan(); } catch { /* The popup shows a stale heartbeat if Safari disconnects. */ }
    finally { busy = false; }
  }
  async function load() {
    const job = await api.runtime.sendMessage({type: 'readerJob'});
    readerTab = !!job?.job;
    const data = await api.storage.local.get('config');
    if (config?.revision !== data.config?.revision) { initialized = false; baseline.clear(); }
    config = data.config;
    await run();
  }
  api.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.config) load(); });
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(run, 800);
  }).observe(document.body, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'data-legacy-thread-id']});
  window.addEventListener('hashchange', run);
  setInterval(run, 15000);
  load();
  // Export only in Node's isolated fixture environment, never to the Gmail page.
  if (typeof module !== 'undefined' && module.exports) module.exports = {timestamp, extract};
})();
