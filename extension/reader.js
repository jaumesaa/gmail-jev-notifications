(() => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  let busy = false;
  function extractBody() {
    const bodies = [...document.querySelectorAll('.a3s')].filter(node => node.textContent.trim());
    const last = bodies.at(-1);
    if (!last) return null;
    const container = last.closest('.adn') || last.parentElement;
    const sender = container?.querySelector('.gD[email]');
    return {
      body: last.innerText || last.textContent,
      sender: sender ? `${sender.getAttribute('name') || sender.textContent} <${sender.getAttribute('email')}>` : '',
      recipients: [...(container?.querySelectorAll('.g2[email]') || [])].map(node => node.getAttribute('email')),
      source: 'gmail-open-message'
    };
  }
  function unreadButton() {
    return [...document.querySelectorAll('[role="button"],button')].find(node => {
      const label = (node.getAttribute('aria-label') || node.getAttribute('data-tooltip') || '').trim();
      return /^(marcar como no le[ií]do|mark as unread)$/i.test(label);
    });
  }
  async function restore(job) {
    if (!job.wasUnread) return true;
    // Restore only our own temporary reader, never the user's original Gmail tab.
    const button = unreadButton();
    if (!button) return false;
    button.click();
    for (let attempt = 0; attempt < 30; attempt++) {
      await wait(300);
      const row = [...document.querySelectorAll('tr.zA')].find(row => {
        const subject = row.querySelector('.bog');
        return (subject?.dataset.legacyThreadId || row.dataset.legacyThreadId || row.querySelector('[data-legacy-thread-id]')?.dataset.legacyThreadId || subject?.dataset.threadId) === job.id;
      });
      if (row?.classList.contains('zE')) return true;
      const notices = [...document.querySelectorAll('[role="alert"],.bAq')].map(node => node.textContent).join(' ');
      if (/marcad[oa].{0,60}(?:no le[ií]d[oa]|sin leer)|marked as unread/i.test(notices)) return true;
    }
    return false;
  }
  async function read(job) {
    if (busy) return {ok:false,error:'Lector ocupado.'};
    busy = true;
    let email = null;
    try {
      for (let attempt = 0; attempt < 40; attempt++) {
        email = extractBody();
        if (email) break;
        await wait(300);
      }
      const restored = await restore(job);
      if (!restored) return {ok:false,error:'No se pudo confirmar el estado sin leer. Revisa la pestaña de lectura que sigue abierta.', restored:false};
      if (!email) return {ok:false,error:'Gmail no expone un cuerpo de texto compatible (p. ej., correo dinámico).',restored:true};
      return {ok:true,email,restored:true};
    } finally { busy = false; }
  }
  // The reader owns the async work. Safari need not hold a tabs.sendMessage
  // response channel open while Gmail loads and unread state is restored.
  browser.runtime.sendMessage({type:'readerJob'}).then(async result => {
    if (!result?.job) return;
    let outcome;
    try { outcome = await read(result.job); }
    catch { outcome = {ok:false,error:'Error de lectura de Gmail.',restored:false}; }
    await browser.runtime.sendMessage({type:'readerResult',token:result.job.token,result:outcome});
  }).catch(() => {});
  if (typeof module !== 'undefined' && module.exports) module.exports = {extractBody, unreadButton};
})();
