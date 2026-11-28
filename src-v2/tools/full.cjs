const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const url = process.argv[2] || 'http://localhost:8765/';
  const out = process.argv[3] || '/workspace/v2-test';
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
  const errs = []; p.on('pageerror', e => errs.push('PE ' + (e.stack || e.message).slice(0, 400))); p.on('console', m => { if (m.type() === 'error') errs.push('E ' + m.text().slice(0, 300)); });
  await p.goto(url);
  await p.waitForFunction(() => window.__game && window.__game.mode() === 'menu', { timeout: 120000 });
  const G = (f, ...a) => p.evaluate(f, ...a);
  await G(() => { __game.setQ('medium'); __game.weather('clear'); __game.tod(10.5); });
  await sleep(5000); await p.screenshot({ path: out + '-menu.png' });
  await p.click('#bPlay'); await sleep(6000);
  console.log('mode', await G(() => __game.mode()), 'fps', await G(() => __game.fps()));
  await p.screenshot({ path: out + '-play-day.png' });
  await p.keyboard.down('KeyW'); await sleep(2500); await p.keyboard.up('KeyW'); await p.screenshot({ path: out + '-walk.png' });
  await G(() => { __game.tod(21.5); }); await sleep(4000); await p.screenshot({ path: out + '-night.png' });
  await G(() => { __game.tod(14); __game.weather('rain'); }); await sleep(4000); await p.screenshot({ path: out + '-rain.png' });
  await G(() => { __game.weather('sand'); }); await sleep(3000); await p.screenshot({ path: out + '-sand.png' });
  await G(() => { __game.weather('clear'); });
  for (const k of ['market', 'rest', 'hotel', 'home']) { await G(k => __game.enter(k), k); await sleep(2500); await p.screenshot({ path: out + '-in-' + k + '.png' }); console.log(k, 'inside', await G(() => !!__game.inside())); await G(() => __game.exitInterior()); await sleep(800); }
  await G(() => __game.phone()); await sleep(1200); await p.screenshot({ path: out + '-phone.png' }); await G(() => __game.phone());
  await p.keyboard.press('Escape'); await sleep(1000); await p.screenshot({ path: out + '-pause.png' }); console.log('mode', await G(() => __game.mode()));
  console.log('errors', JSON.stringify(errs.slice(0, 15)));
  await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
