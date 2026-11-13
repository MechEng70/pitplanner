// Drive the 0.2.0 (Capacitor) app's WebView over Chrome DevTools, for the upgrade test (TASKS T-012, T-038).
// Emulator only: its userdebug image opens a DevTools socket for every WebView, so the real release APK can
// be driven through its own screens. No dependencies (Node's WebSocket).
//   node webview.mjs <port> look                     headings, buttons, checkboxes, radios and options on screen
//   node webview.mjs <port> click <role> <name> [n]  click the control with that role and name, n times
//   node webview.mjs <port> wait <text>              wait up to 20 s for the text
//   node webview.mjs <port> reload                   reload the page (after changing what the app has saved)
//   node webview.mjs <port> eval <js>                evaluate (async) JavaScript, print the JSON result
const [port, cmd, ...args] = process.argv.slice(2);

const pages = await (await fetch(`http://localhost:${port}/json`)).json();
const page = pages.find(p => p.type === 'page');
if (!page) throw new Error('no WebView page on that port');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((ok, bad) => {
  ws.onopen = ok;
  ws.onerror = bad;
});
let id = 0;
const pending = new Map();
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  pending.get(m.id)?.(m);
  pending.delete(m.id);
};
const send = (method, params) =>
  new Promise(ok => {
    pending.set(++id, ok);
    ws.send(JSON.stringify({ id, method, params }));
  });
async function evaluate(js) {
  const m = await send('Runtime.evaluate', { expression: js, awaitPromise: true, returnByValue: true });
  if (m.result?.exceptionDetails) throw new Error(m.result.exceptionDetails.exception?.description ?? 'page error');
  return m.result?.result?.value;
}

// Runs in the page: controls by role and accessible name (aria-label, else its label, else its text).
const HELPERS = `(() => {
  const SEL = {
    button: 'button,[role=button]',
    checkbox: 'input[type=checkbox],[role=checkbox]',
    radio: 'input[type=radio],[role=radio]',
    option: '[role=option]',
    heading: 'h1,h2,.t-sheetTitle',
  };
  const shown = e => e.getClientRects().length > 0;
  const name = e =>
    (e.getAttribute('aria-label') || e.closest('label')?.innerText || e.innerText || '').replace(/\\s+/g, ' ').trim();
  // The top sheet or overlay screen when one is open: controls under it cannot be reached by a user.
  const scope = () => [...document.querySelectorAll('.sheet,.overlay-screen')].filter(shown).at(-1) ?? document;
  const all = role => [...scope().querySelectorAll(SEL[role])].filter(shown);
  return { SEL, name, all };
})()`;

const sleep = ms => new Promise(r => setTimeout(r, ms));
let code = 0;
try {
  if (cmd === 'look') {
    const out = await evaluate(`(() => { const h = ${HELPERS};
      return Object.fromEntries(Object.keys(h.SEL).map(r => [r, h.all(r).map(e =>
        h.name(e).slice(0, 60) + (e.disabled ? ' (disabled)' : '') + (e.checked || e.getAttribute('aria-checked') === 'true' ? ' (on)' : ''))]));
    })()`);
    console.log(JSON.stringify(out));
  } else if (cmd === 'click') {
    const [role, name, times = '1'] = args;
    for (let i = 0; i < Number(times); i++) {
      const done = await evaluate(`(() => { const h = ${HELPERS};
        const want = ${JSON.stringify(name)};
        const list = h.all(${JSON.stringify(role)});
        const e = list.find(x => h.name(x) === want) ?? list.find(x => h.name(x).includes(want));
        if (!e) return 'no ${role} named ' + want + '; have: ' + list.map(h.name).join(' | ').slice(0, 400);
        if (e.disabled) return want + ' is disabled';
        e.scrollIntoView({ block: 'center' });
        e.click();
        return 'ok';
      })()`);
      if (done !== 'ok') throw new Error(done);
      await sleep(400);
    }
    await sleep(600);
    console.log(`clicked ${role} "${name}"${times === '1' ? '' : ` x${times}`}`);
  } else if (cmd === 'wait') {
    let found = false;
    for (let i = 0; i < 40 && !found; i++) {
      // A page that is still loading has no body yet, or its context is gone: ask again.
      found = await evaluate(`!!document.body && document.body.innerText.includes(${JSON.stringify(args[0])})`).catch(
        () => false,
      );
      if (!found) await sleep(500);
    }
    if (!found) throw new Error(`"${args[0]}" did not show`);
    console.log(`shows "${args[0]}"`);
  } else if (cmd === 'reload') {
    await send('Page.reload', {});
    await sleep(1500);
    console.log('reloaded');
  } else if (cmd === 'eval') {
    console.log(JSON.stringify(await evaluate(`(async () => { ${args[0]} })()`)));
  } else {
    throw new Error('usage: webview.mjs <port> look | click <role> <name> [n] | wait <text> | reload | eval <js>');
  }
} catch (e) {
  console.error(String(e.message ?? e));
  code = 1;
}
ws.close();
process.exit(code);
