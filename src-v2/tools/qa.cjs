// Playwright QA: load, menu, play, drive, shoot, shop, house, FPS on Low. Usage: node tools/qa.cjs [url] [prefix]
const { chromium } = require('playwright-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const url = process.argv[2] || 'http://localhost:8765/';
  const out = process.argv[3] || '/workspace/qa/from-designer/v2';
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [], fails = [];
  p.on('pageerror', e => errs.push('PE ' + (e.stack || e.message).slice(0, 300)));
  p.on('console', m => { if (m.type() === 'error') errs.push('E ' + m.text().slice(0, 200)); });
  p.on('requestfailed', r => fails.push(r.url())); p.on('response', r => { if (r.status() >= 400) fails.push(r.status() + ' ' + r.url()); });
  const R = {}; const G = (f, a) => p.evaluate(f, a);
  const t0 = Date.now(); await p.goto(url + (url.includes('?') ? '&' : '?') + 'qa=' + Date.now());
  await p.waitForFunction(() => window.__game && window.__game.mode() === 'menu', null, { timeout: 180000 }); R.loadS = (Date.now() - t0) / 1000;
  await G(() => { __game.setQ('low'); __game.weather('clear'); __game.tod(12); });
  await sleep(2500); await p.screenshot({ path: out + '-menu.png' });
  await p.click('#bPlay'); await sleep(5000); R.mode = await G(() => __game.mode());
  await p.screenshot({ path: out + '-play.png' });
  const samp = async () => { const a = []; for (let i = 0; i < 5; i++) { await sleep(1000); a.push(await G(() => __game.fps())); } return +(a.reduce((x, y) => x + y) / a.length).toFixed(1); };
  R.fpsLow = await samp(); R.drawLow = await G(() => __game.env().renderer.info.render.calls); R.triLowK = await G(() => Math.round(__game.env().renderer.info.render.triangles / 1000));
  // drive
  R.drive = await G(async () => { const g = __game.g(), L = __game.L; const c = g.cars.filter(c => c.dead <= 0 && !c.drv).sort((a, b) => Math.hypot(a.x - g.p.x, a.z - g.p.z) - Math.hypot(b.x - g.p.x, b.z - g.p.z))[0] || g.cars[0]; g.p.x = c.x + 1; g.p.z = c.z + 1; L.toggleCar(g); return { inCar: !!g.p.car, name: g.p.car && g.p.car.t.n, x: g.p.car ? g.p.car.x : 0, z: g.p.car ? g.p.car.z : 0 }; });
  await p.keyboard.down('KeyW'); await sleep(3500); await p.screenshot({ path: out + '-drive.png' }); await p.keyboard.up('KeyW');
  R.driveMoved = await G(d => { const g = __game.g(), c = g.p.car; return c ? +Math.hypot(c.x - d.x, c.z - d.z).toFixed(1) : -1; }, R.drive);
  await G(() => { const g = __game.g(); if (g.p.car) __game.L.toggleCar(g); });
  await sleep(800);
  // shoot
  R.shoot = await G(() => { const g = __game.g(); g.p.has[1] = true; g.p.ammo[1] = Math.max(30, g.p.ammo[1]); __game.L.selW(g, 1); return g.p.ammo[1]; });
  await p.mouse.move(640, 360); await p.mouse.down(); await sleep(1500); await p.screenshot({ path: out + '-shoot.png' }); await p.mouse.up();
  R.shotsFired = R.shoot - await G(() => __game.g().p.ammo[1]);
  // shop: buy + steal
  await G(() => __game.enter('market')); await sleep(2500);
  R.shopInside = await G(() => __game.inside() && __game.inside().kind);
  const m0 = await G(() => __game.g().p.money);
  await G(() => __game.hotAct('shelf:0', false)); await sleep(800); await p.screenshot({ path: out + '-shop.png' });
  await sleep(500); const bb = await (await p.$('#shI .item button')).boundingBox(); await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await sleep(300);
  R.bought = m0 - await G(() => __game.g().p.money);
  await G(() => __game.hotAct('shelf:1', true)); R.wantedAfterSteal = await G(() => __game.g().wanted);
  R.inv = await G(() => JSON.stringify(__game.inv()));
  await p.keyboard.press('Escape'); await G(() => __game.exitInterior()); await sleep(800);
  await G(() => { const g = __game.g(); g.wanted = 0; });
  // house: fridge + bed
  await G(() => __game.enter('home')); await sleep(2500); R.houseInside = await G(() => __game.inside() && __game.inside().kind);
  await G(() => __game.hotAct('fridge', false)); await sleep(800); await p.screenshot({ path: out + '-house.png' });
  R.fridgeItems = await p.$$eval('#shI .item', e => e.length);
  await p.keyboard.press('Escape'); await G(() => __game.exitInterior()); await sleep(800);
  // medium quality sample
  await G(() => __game.setQ('medium')); await sleep(2500); await p.screenshot({ path: out + '-medium.png' }); R.drawMed = await G(() => __game.env().renderer.info.render.calls);
  await G(() => __game.setQ('low'));
  R.errors = errs.slice(0, 10); R.failed = fails.slice(0, 10);
  console.log(JSON.stringify(R, null, 1));
  await b.close();
  if (errs.length || R.mode !== 'play') process.exit(1);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
