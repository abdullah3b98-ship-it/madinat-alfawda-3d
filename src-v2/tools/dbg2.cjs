const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage(); await p.setViewport({ width: 480, height: 270 });
  await p.goto('http://localhost:8765/');
  await p.waitForFunction(() => window.__game && window.__game.mode() === 'menu', { timeout: 120000 });
  await p.evaluate(() => { __game.setQ('medium'); __game.weather('clear'); __game.tod(12); });
  await p.click('#bPlay'); await sleep(4000);
  const info = await p.evaluate(() => { const sc = __game.env().scene; return sc.children.map((c, i) => [i, c.type, c.material ? c.material.type : '', c.material && c.material.opacity, c.geometry ? c.geometry.type : '', c.scale.x, c.renderOrder, c.material && c.material.depthTest]).filter(x => x[1] === 'Mesh' || x[1] === 'Points' || x[1]=='LineSegments'); });
  console.log(JSON.stringify(info));
  await p.screenshot({ path: '/tmp/d-base.png' });
  console.log(await p.evaluate(() => { const e = __game.env(); return JSON.stringify({ passes: e.composer.passes.map(x => x.constructor.name), rt: e.composer.renderTarget1.texture.type, bl: [e.bloom.strength, e.bloom.threshold] }); }));
  await p.evaluate(() => { const e = __game.env(); e.update = ((u) => function (...a) { u.apply(this, a); this.bloom.threshold = 100; })(e.update); }); await sleep(1500); await p.screenshot({ path: '/tmp/d-th100.png' });
  await p.evaluate(() => { const e = __game.env(); e.update = ((u) => function (...a) { u.apply(this, a); this.bloom.strength = 0; })(e.update); }); await sleep(1500); await p.screenshot({ path: '/tmp/d-s0.png' });

  await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
