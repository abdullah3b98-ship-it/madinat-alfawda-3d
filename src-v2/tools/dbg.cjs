const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage(); await p.setViewport({ width: 640, height: 360 });
  await p.goto('http://localhost:8765/');
  await p.waitForFunction(() => window.__game && window.__game.mode() === 'menu', { timeout: 120000 });
  await p.evaluate(() => { __game.setQ('low'); __game.weather('clear'); __game.tod(12); });
  await p.click('#bPlay'); await sleep(5000);
  const r = await p.evaluate(() => {
    const env = __game.env(), sc = env.scene, cam = env.camera;
    const out = { cam: cam.position.toArray().map(v => +v.toFixed(1)), near: cam.near, far: cam.far, fog: env.fog.density, fogc: env.fog.color.getHexString(), exp: env.renderer.toneMappingExposure, hemi: env.hemi.intensity, sun: env.sun.intensity, amb: env.amb.intensity, flash: env.flash, kids: [] };
    sc.children.forEach(c => out.kids.push([c.type, c.name, c.visible, c.children.length, c.material ? (c.material.type + ' ' + (c.material.opacity ?? '')) : '']));
    return out;
  });
  console.log(JSON.stringify(r));
  await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
