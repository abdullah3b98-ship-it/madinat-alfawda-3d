const puppeteer = require('puppeteer-core');
(async () => {
  const url = process.argv[2] || 'http://localhost:8765/';
  const out = process.argv[3] || '/workspace/v2-test';
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
  const errs = []; p.on('pageerror', e => errs.push('PE ' + (e.stack||e.message).slice(0,400))); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text().slice(0, 300)); });
  await p.goto(url);
  await p.waitForFunction(() => window.__game && window.__game.mode() === 'menu', { timeout: 120000 });
  await new Promise(r => setTimeout(r, 4000));
  await p.screenshot({ path: out + '-menu.png' });
  console.log('menu fps', await p.evaluate(() => window.__game.fps()));
  console.log('errors', JSON.stringify(errs.slice(0, 20)));
  await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
