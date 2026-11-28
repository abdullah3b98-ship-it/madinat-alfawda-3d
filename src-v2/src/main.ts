import * as THREE from "three";
import * as L from "./logic";
import { genWorld, mkMini, WorldData, Door } from "./world";
import { makeTextures } from "./render/tex";
import { buildCity, City } from "./render/city";
import { Env, Quality, Weather, WEATHERS, WEATHER_EN } from "./render/env";
import { Actors, OUTFITS } from "./render/actors";
import { setShemTex, animate } from "./render/human";
import { setHeadlights } from "./render/vehicles";
import { buildInterior, blockedIn, Interior, Hot } from "./render/interiors";
import { CSS, h, $, UIStack } from "./ui";
import { loadManifest, setFileVolume, playVoice, setLoaderRenderer, loadLazy } from "./assets";
import { FX } from "./fx/effects";
import * as SFX from "./sfx";

const { VOX, HOOK, WP } = L;
const VERSION = "v2.0 — Phase 1";
export const CUR = "$"; // currency symbol (single place to change)
const money = (n: number): string => CUR + Math.round(n).toLocaleString("en-US");
// ---------------- settings & save
type Settings = { q: Quality; sens: number; vol: number; tts: boolean; weather: Weather | "auto"; invertY: boolean };
const SET: Settings = { q: "medium", sens: 1, vol: 0.8, tts: true, weather: "auto", invertY: false, ...(JSON.parse(localStorage.getItem("madinat_v2_settings") || "{}") as Partial<Settings>) };
const saveSet = (): void => { localStorage.setItem("madinat_v2_settings", JSON.stringify(SET)); };
type Save = { money: number; hp: number; has: boolean[]; ammo: number[]; w: number; inv: Record<string, number>; tod: number; outfit: number; owned: number[]; carCol: string; t: number };
const SAVE_KEY = "chaoscity_v2_save";
const loadSave = (): Save | null => { try { const s = localStorage.getItem(SAVE_KEY); return s ? (JSON.parse(s) as Save) : null; } catch (_e) { return null; } };
const ITEMS: Record<string, { n: string; price: number; hp: number; cat: number; ic: string }> = {
  water: { n: "Bottled Water", price: 2, hp: 6, cat: 0, ic: "💧" }, pepsi: { n: "Cola", price: 3, hp: 8, cat: 0, ic: "🥤" }, juice: { n: "Orange Juice", price: 4, hp: 10, cat: 0, ic: "🧃" }, laban: { n: "Milk", price: 5, hp: 12, cat: 0, ic: "🥛" }, energy: { n: "Energy Drink", price: 6, hp: 14, cat: 0, ic: "⚡" },
  chips: { n: "Chips", price: 3, hp: 6, cat: 1, ic: "🍟" }, choco: { n: "Chocolate Bar", price: 4, hp: 8, cat: 1, ic: "🍫" }, dates: { n: "Granola Bar", price: 4, hp: 12, cat: 1, ic: "🥜" }, biscuit: { n: "Cookies", price: 3, hp: 6, cat: 1, ic: "🍪" },
  tuna: { n: "Canned Tuna", price: 6, hp: 15, cat: 2, ic: "🐟" }, beans: { n: "Baked Beans", price: 4, hp: 14, cat: 2, ic: "🥫" }, bread: { n: "Bread", price: 2, hp: 10, cat: 2, ic: "🍞" }, cheese: { n: "Cheese", price: 7, hp: 14, cat: 2, ic: "🧀" },
  soap: { n: "Soap", price: 4, hp: 0, cat: 3, ic: "🧼" }, tissue: { n: "Paper Towels", price: 5, hp: 0, cat: 3, ic: "🧻" },
};
const FOOD = [{ n: "Hot Dog", price: 6, hp: 20, ic: "🌭" }, { n: "Cheeseburger & Fries", price: 14, hp: 50, ic: "🍔" }, { n: "Pancake Stack", price: 10, hp: 35, ic: "🥞" }, { n: "Steak Dinner", price: 32, hp: 100, ic: "🥩" }, { n: "Milkshake", price: 6, hp: 12, ic: "🥤" }, { n: "Coffee & Donut", price: 5, hp: 15, ic: "☕" }];

// ---------------- DOM
const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
document.body.innerHTML = `<canvas id="gl" tabindex="0"></canvas><canvas id="hud"></canvas>
<div id="loading" class="ui on"><div class="logo" style="font-size:54px"><img class="logoImg" src="assets/ui/logo.png" alt="Chaos City | مدينة الفوضى" onerror="this.parentNode.innerHTML='CHAOS CITY<small>مدينة الفوضى</small>'"></div><div class="bar"><i id="lbar"></i></div><div id="ltxt" style="color:#aab">Preparing the city...</div></div>
<div id="menu" class="ui"><div class="side">
 <div class="logo" id="logoBox"><img class="logoImg" src="assets/ui/logo.png" alt="Chaos City | مدينة الفوضى" onerror="this.parentNode.innerHTML='CHAOS CITY<small>مدينة الفوضى</small>'"><small>Open World · 3D</small></div>
 <div class="tag">Sultan is waiting… the city never sleeps 🌆</div>
 <button class="btn" id="bPlay"><span class="i">▶</span>Start Game</button>
 <button class="btn" id="bCont"><span class="i">⟲</span>Continue</button>
 <button class="btn" id="bSet"><span class="i">⚙</span>Settings</button>
 <button class="btn" id="bCtl"><span class="i">🎮</span>Controls</button>
 <button class="btn" id="bAbout"><span class="i">ℹ</span>About</button>
</div><div class="ver">${VERSION}</div></div>
<div id="pause" class="ui"><div class="side"><h1>Paused</h1>
 <button class="btn" id="pRes"><span class="i">▶</span>Resume</button>
 <button class="btn" id="pSave"><span class="i">💾</span>Save Game</button>
 <button class="btn" id="pSet"><span class="i">⚙</span>Settings</button>
 <button class="btn" id="pCtl"><span class="i">🎮</span>Controls</button>
 <button class="btn" id="pMenu"><span class="i">⌂</span>Main Menu</button></div></div>
<div id="settings" class="ui"><div class="panel"><h2>Settings</h2>
 <div class="row"><span class="k">Graphics quality</span><div class="seg" id="sQ"><button data-v="low">Low</button><button data-v="medium">Medium</button><button data-v="high">High</button></div></div>
 <div class="row"><span class="k">Mouse / gamepad sensitivity</span><input type="range" id="sSens" min="0.3" max="2.5" step="0.05"></div>
 <div class="row"><span class="k">Volume</span><input type="range" id="sVol" min="0" max="1" step="0.02"></div>
 <div class="row"><span class="k">Sultan's voice</span><div class="seg" id="sTts"><button data-v="1">On</button><button data-v="0">Off</button></div></div>
 <div class="row"><span class="k">Invert vertical axis</span><div class="seg" id="sInv"><button data-v="0">No</button><button data-v="1">Yes</button></div></div>
 <div class="row"><span class="k">Weather</span><div class="seg" id="sW" style="flex-wrap:wrap"><button data-v="auto">Auto</button>${WEATHERS.map((w: Weather) => `<button data-v="${w}">${WEATHER_EN[w]}</button>`).join("")}</div></div>
 <button class="btn back" data-back="1"><span class="i">↩</span>Back</button></div></div>
<div id="controls" class="ui"><div class="panel"><h2>Controls</h2><div class="cols"><div><h3>⌨️ Keyboard & mouse</h3>${[...L.HELP_KB, ["E", "Enter buildings / interact (or get in a car)"], ["R", "Steal (inside stores)"], ["T", "Phone"], ["F9", "Developer info"]].map((r: string[]) => `<div class="kv"><b>${r[0]}</b><span>${r[1]}</span></div>`).join("")}</div>
 <div><h3>🎮 PlayStation controller</h3>${[...L.HELP_PAD, ["△", "Enter buildings / interact"], ["○", "Steal / back"], ["Share / touchpad", "Phone"]].map((r: string[]) => `<div class="kv"><b>${r[0]}</b><span>${r[1]}</span></div>`).join("")}</div></div>
 <button class="btn back" data-back="1"><span class="i">↩</span>Back</button></div></div>
<div id="about" class="ui"><div class="panel"><h2>About</h2><p style="line-height:1.8;font-size:16px"><b>CHAOS CITY</b> (مدينة الفوضى) — an open-world American city in your browser. Cruise a downtown of glass skyscrapers, quiet suburbs with lawns and mailboxes, a busy commercial strip, parks, and the beach-side highway. Walk into the 24/7 store, the supermarket, the diner, the hotel and your own house — buy, or steal (and deal with the cops 👮).<br>Your buddy <b>Sultan</b> 🧔 is a Saudi guy in a sharp suit: he hears you through the mic (V), understands Saudi Arabic, gets happy or annoyed, wanders on his own and answers in his own voice.<br>Day and night, rain, thunderstorms and dust storms.</p><p style="color:#9aa">${VERSION} · three.js · بدون حسابات ولا تتبّع.</p>
 <button class="btn back" data-back="1"><span class="i">↩</span>Back</button></div></div>
<div id="phone" class="ui"><div class="ph"><div class="scr"><div class="bar"><span id="phT">12:00</span><span>📶 🔋</span></div><div class="clock" id="phC">12:00</div><div class="date" id="phD"></div><div id="phMain" class="apps">
 <button class="app" data-app="map"><span style="background:#34a853">🗺️</span>Map</button>
 <button class="app" data-app="call"><span style="background:#0f9d58">📞</span>Call Sultan</button>
 <button class="app" data-app="weather"><span style="background:#4285f4">⛅</span>Weather</button>
 <button class="app" data-app="garage"><span style="background:#ea4335">🚗</span>Garage</button>
 <button class="app" data-app="clothes"><span style="background:#a142f4">👕</span>Clothes</button>
 <button class="app" data-app="save"><span style="background:#f9ab00">💾</span>Save</button></div><div id="phSub" class="sub" style="display:none"></div></div></div></div>
<div id="shop" class="ui"><div class="panel"><h2 id="shT"></h2><div id="shM" style="margin:-6px 0 12px;color:#7CFC7C;font-weight:800"></div><div class="items" id="shI"></div><button class="btn back" data-back="1"><span class="i">↩</span>Close</button></div></div>
<div id="prompt" class="ui"><div id="prT"></div></div>
<div id="fade" class="ui on" style="display:flex"><div class="t" id="fadeT"></div></div>`;
const UI = new UIStack();
const glc = $("#gl") as HTMLCanvasElement, hudc = $("#hud") as HTMLCanvasElement, hx = hudc.getContext("2d") as CanvasRenderingContext2D;
const prog = (f: number, s: string): void => { ($("#lbar") as HTMLElement).style.width = Math.round(f * 100) + "%"; $("#ltxt").textContent = s; };
const nextFrame = (): Promise<void> => new Promise((r: () => void) => requestAnimationFrame(() => setTimeout(r, 0)));

let fx: FX;
let env: Env, W: WorldData, city: City, A: Actors, g: L.Game;
let mode: "load" | "menu" | "play" | "pause" = "load";
let inside: Interior | null = null, insideDoor: Door | null = null, IP = { x: 0, z: 0, a: 0, ph: 0, mv: 0, sit: false, yaw: -Math.PI / 2, pitch: 0.25 };
const interiors = new Map<string, Interior>();
let inv: Record<string, number> = {}, owned: number[] = [0, 1], outfit = 0, carCol = "#c0c4c8", personal: L.Car | null = null, tvOn = false, stolen = 0, shopTitle = "";
let fpsN = 0, fpsT = 0, fps = 0, frameMs = 0;
let menuT = 0;
const TS = 1; // time scale: 1 game hour per real minute

async function boot(): Promise<void> {
  env = new Env(glc); setLoaderRenderer(env.renderer);
  prog(0.05, "Loading files..."); await loadManifest((f: number) => prog(0.05 + f * 0.25, "Loading models..."));
  try { await Promise.race([document.fonts.load("800 40px Kufi"), new Promise((r: (v: unknown) => void) => setTimeout(r, 1500))]); await document.fonts.load("700 20px Cairo"); } catch (_e) { /* fonts optional */ }
  prog(0.35, "Building the city..."); await nextFrame();
  W = genWorld();
  const T = makeTextures(env.renderer.capabilities.getMaxAnisotropy() > 4 ? 8 : 4); setShemTex(T.shemagh);
  city = buildCity(W, T, "Cairo, sans-serif"); env.scene.add(city.root);
  prog(0.7, "Preparing characters..."); await nextFrame();
  g = L.newGame(W.B, mkMini(W));
  const sv = loadSave(); if (sv) { outfit = sv.outfit ?? 0; owned = sv.owned || owned; carCol = sv.carCol || carCol; }
  A = new Actors(env.scene, outfit, (x: number, z: number) => { const bx = Math.floor(x / L.BS), bz = Math.floor(z / L.BS); return bx >= 0 && bz >= 0 && bx < L.NB && bz < L.NB && W.B[bz * L.NB + bx].d === 5; });
  hooks();
  env.thunder = () => { const r = fx.lightning(undefined, { x: g.p.x, y: 0, z: g.p.z }); SFX.thunder(r.thunderDelay); };
  env.setQuality(SET.q, innerWidth, innerHeight);
  if (SET.weather !== "auto") { env.autoWeather = false; env.setWeather(SET.weather, true); } else env.setWeather("clear", true);
  VOX.tts = SET.tts; HOOK.vol = SET.vol;
  fx = new FX(env.scene, { onLightningFlash: (k: number) => { env.flash = Math.max(env.flash, k); } });
  // warm-up: populate traffic around the menu camera
  for (let i = 0; i < 3; i++) L.update(g, 0.016);
  prog(1, "Ready"); await nextFrame();
  $("#loading").classList.remove("on"); toMenu();
  setTimeout(() => $("#fade").classList.remove("on"), 50);
  requestAnimationFrame(loop);
}

// ---------------- hooks into logic
function hooks(): void {
  HOOK.phone = () => togglePhone();
  HOOK.tri = () => interact();
  HOOK.voiceFile = (t: string) => playVoice(t, SET.vol, (b: boolean) => { VOX.busy = b; if (!b) VOX.quietT = Date.now() + 700; });
  HOOK.ev = (n: string, x: number, y: number, z: number, a: number) => gameEvent(n, x, y, z, a);
}
function toast(s: string): void { L.msg(g, s); }

// ---------------- menu flow
function toMenu(): void { mode = "menu"; g.started = false; g.menuCam = true; UI.open("#menu"); ($("#bCont") as HTMLButtonElement).disabled = !loadSave() && !g.ever; SFX.menuMusic(true); if (document.pointerLockElement) document.exitPointerLock(); }
function startGame(fresh: boolean): void {
  setTimeout(() => { void loadLazy(); }, 4000);
  SFX.click(); SFX.menuMusic(false);
  const sv = loadSave();
  if (fresh || !sv) {
    if (fresh) { inv = {}; owned = [0, 1]; outfit = 0; A.setOutfit(outfit); }
    if (!g.ever || fresh) { const p = g.p; p.x = W.home.x; p.z = W.home.z - 4; p.hp = 100; p.money = 500; p.car = null; g.wanted = 0; env.tod = 16.5; placeSultan(); }
  } else if (!g.ever) applySave(sv);
  fadeTo(() => { UI.closeAll(); mode = "play"; g.started = true; g.ever = true; g.menuCam = false; lock(); }, "");
}
function applySave(s: Save): void {
  const p = g.p; p.money = s.money; p.hp = s.hp; p.has = s.has; p.ammo = s.ammo; p.w = s.w; inv = s.inv || {}; env.tod = s.tod; outfit = s.outfit; owned = s.owned; carCol = s.carCol;
  A.setOutfit(outfit); p.x = W.home.x; p.z = W.home.z - 4; p.car = null; g.wanted = 0; placeSultan();
}
function placeSultan(): void { const b = g.b; b.x = g.p.x + 1.5; b.z = g.p.z - 1.5; b.car = null; b.ride = false; b.mode = 0; b.dead = 0; b.hp = 100; }
function doSave(): void {
  const p = g.p; const s: Save = { money: p.money, hp: p.hp, has: p.has, ammo: p.ammo, w: p.w, inv, tod: env.tod, outfit, owned, carCol, t: Date.now() };
  localStorage.setItem(SAVE_KEY, JSON.stringify(s)); toast("💾 Game saved");
}
function pause(): void { if (mode !== "play") return; SFX.pause(true); if (UI.top() === "#phone" || UI.top() === "#shop") { UI.closeAll(); g.ui = false; return; } mode = "pause"; g.started = false; g.keys.clear(); g.mDown = false; g.rDown = false; UI.open("#pause"); if (document.pointerLockElement) document.exitPointerLock(); }
function resume(): void { SFX.click(); SFX.pause(false); UI.closeAll(); mode = "play"; g.started = true; g.ui = false; lock(); }
function fadeTo(mid: () => void, text: string, hold = 350): void { $("#fadeT").textContent = text; $("#fade").classList.add("on"); setTimeout(() => { mid(); setTimeout(() => $("#fade").classList.remove("on"), hold); }, 460); }
function lock(): void { try { const r = (glc as unknown as { requestPointerLock: () => unknown }).requestPointerLock(); if (r && typeof (r as Promise<void>).catch === "function") (r as Promise<void>).catch(() => undefined); } catch (_e) { /* */ } glc.focus(); }

function bindMenus(): void {
  $("#bPlay").onclick = () => startGame(true);
  $("#bCont").onclick = () => startGame(false);
  $("#bSet").onclick = () => { SFX.click(); syncSettings(); UI.push("#settings"); };
  $("#bCtl").onclick = () => { SFX.click(); UI.push("#controls"); };
  $("#bAbout").onclick = () => { SFX.click(); UI.push("#about"); };
  $("#pRes").onclick = () => resume();
  $("#pSave").onclick = () => { SFX.click(); doSave(); };
  $("#pSet").onclick = () => { SFX.click(); syncSettings(); UI.push("#settings"); };
  $("#pCtl").onclick = () => { SFX.click(); UI.push("#controls"); };
  $("#pMenu").onclick = () => { SFX.click(); toMenu(); };
  document.querySelectorAll("[data-back]").forEach((b: Element) => { (b as HTMLElement).onclick = () => { SFX.click(); back(); }; });
  const seg = (id: string, f: (v: string) => void): void => { $(id).querySelectorAll("button").forEach((b: Element) => { (b as HTMLElement).onclick = () => { SFX.click(); f((b as HTMLElement).dataset.v as string); syncSettings(); saveSet(); }; }); };
  seg("#sQ", (v: string) => { SET.q = v as Quality; env.setQuality(SET.q, innerWidth, innerHeight); });
  seg("#sTts", (v: string) => { SET.tts = v === "1"; VOX.tts = SET.tts; });
  seg("#sInv", (v: string) => { SET.invertY = v === "1"; });
  seg("#sW", (v: string) => { SET.weather = v as Weather | "auto"; if (v === "auto") env.autoWeather = true; else { env.autoWeather = false; env.setWeather(v as Weather, false); } });
  ($("#sSens") as HTMLInputElement).oninput = (e: Event) => { SET.sens = +(e.target as HTMLInputElement).value; saveSet(); };
  ($("#sVol") as HTMLInputElement).oninput = (e: Event) => { SET.vol = +(e.target as HTMLInputElement).value; SFX.volume(SET.vol); setFileVolume(SET.vol); HOOK.vol = SET.vol; saveSet(); };
  document.querySelectorAll("#phMain .app").forEach((b: Element) => { (b as HTMLElement).onclick = () => phoneApp((b as HTMLElement).dataset.app as string); });
}
function syncSettings(): void {
  const on = (id: string, v: string): void => { $(id).querySelectorAll("button").forEach((b: Element) => (b as HTMLElement).classList.toggle("on", (b as HTMLElement).dataset.v === v)); };
  on("#sQ", SET.q); on("#sTts", SET.tts ? "1" : "0"); on("#sInv", SET.invertY ? "1" : "0"); on("#sW", SET.weather);
  ($("#sSens") as HTMLInputElement).value = String(SET.sens); ($("#sVol") as HTMLInputElement).value = String(SET.vol);
}
function back(): void {
  const t = UI.top();
  if (t === "#phone" && ($("#phSub") as HTMLElement).style.display !== "none") { phoneHome(); return; }
  if (t === "#phone" || t === "#shop") { UI.closeAll(); g.ui = false; return; }
  if (t === "#pause") { resume(); return; }
  if (UI.stack.length > 1) UI.pop();
}

// ---------------- phone
function clockStr(): string { const hh = Math.floor(env.tod), mm = Math.floor((env.tod - hh) * 60); return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0"); }
function togglePhone(): void {
  if (mode !== "play") return;
  if (UI.top() === "#phone") { UI.closeAll(); g.ui = false; return; }
  if (UI.top()) return;
  SFX.phone(); phoneHome(); UI.open("#phone"); g.ui = true; g.keys.clear();
}
function phoneHome(): void { ($("#phMain") as HTMLElement).style.display = "grid"; ($("#phSub") as HTMLElement).style.display = "none"; $("#phC").textContent = clockStr(); $("#phT").textContent = clockStr(); $("#phD").textContent = WEATHER_EN[env.wMix < 1 ? env.wNext : env.weather] + " · " + money(g.p.money); UI.focusFirst(); }
function phoneSub(title: string, items: { t: string; f: () => void }[]): void {
  const s = $("#phSub"); s.innerHTML = `<div style="font-weight:900;font-size:18px;margin:4px 0 6px">${title}</div>`;
  for (const it of items) { const b = h("button", { class: "btn" }, it.t); b.onclick = () => { SFX.click(); it.f(); }; s.appendChild(b); }
  const bk = h("button", { class: "btn" }, "↩ Back"); bk.onclick = () => phoneHome(); s.appendChild(bk);
  ($("#phMain") as HTMLElement).style.display = "none"; s.style.display = "flex"; UI.focusFirst();
}
function closePhone(): void { UI.closeAll(); g.ui = false; }
function phoneApp(a: string): void {
  SFX.click();
  if (a === "map") { closePhone(); g.big = true; }
  else if (a === "call") { closePhone(); if (inside) { toast("سلطان: أنا برا أنتظرك 👋"); return; } g.b.menu = 3; L.bConfirm(g); toast("📞 Called Sultan — he's on his way!"); }
  else if (a === "weather") phoneSub("Weather", [{ t: "Auto (changes over time)", f: () => { SET.weather = "auto"; env.autoWeather = true; saveSet(); toast("Weather: auto"); } }, ...WEATHERS.map((w: Weather) => ({ t: WEATHER_EN[w], f: () => { SET.weather = w; env.autoWeather = false; env.setWeather(w, false); saveSet(); toast("Weather: " + WEATHER_EN[w]); } }))]);
  else if (a === "garage") phoneSub("Garage — my car", [{ t: "🚙 Bring my car (SUV)", f: () => { closePhone(); spawnPersonal(); } }, ...["#c0c4c8", "#111111", "#ffffff", "#8b0000", "#1f3a93", "#b8860b"].map((c: string, i: number) => ({ t: ["Silver", "Black", "Pearl White", "Burgundy", "Royal Blue", "Gold"][i] + (carCol === c ? " ✔" : ""), f: () => { carCol = c; toast("Car color updated"); if (personal && personal.dead <= 0) personal.col = hexV3(c); phoneApp("garage"); } }))]);
  else if (a === "clothes") phoneSub("My clothes", owned.map((o: number) => ({ t: OUTFITS[o].n + (o === outfit ? " ✔" : ""), f: () => { outfit = o; A.setOutfit(o); if (inside) inside.scene.add(A.player.root); toast("Wearing: " + OUTFITS[o].n); phoneApp("clothes"); } })).concat([{ t: "🛍️ New clothes? Visit the clothing store downtown", f: () => undefined }]));
  else if (a === "save") { doSave(); }
}
function hexV3(c: string): L.V3 { const k = new THREE.Color(c); return [k.r, k.g, k.b]; }
function spawnPersonal(): void {
  if (inside) { toast("Go outside first"); return; }
  const p = g.p; if (personal) { const i = g.cars.indexOf(personal); if (i >= 0 && personal !== p.car) g.cars.splice(i, 1); }
  // nearest road lane point
  const i = Math.round((p.x - L.RW / 2) / L.BS), j = Math.round((p.z - L.RW / 2) / L.BS);
  const rx = i * L.BS + L.RW / 2, rz = j * L.BS + L.RW / 2;
  let x = p.x, z = p.z, a = 0;
  if (Math.abs(p.x - rx) < Math.abs(p.z - rz)) { x = rx + L.LO; z = p.z + 8; a = Math.PI / 2; } else { z = rz - L.LO; x = p.x + 8; a = 0; }
  const c = L.mkCar(6, x, z, a, 0); c.col = hexV3(carCol); c.t = { ...c.t, n: "My SUV", hp: 260, max: 34, acc: 13 }; c.hp = 260; c.park = true; (c as unknown as { personal: boolean }).personal = true; g.cars.push(c); personal = c;
  toast("🚙 Your car is here");
}

// ---------------- doors & interiors
function nearDoor(): Door | null { if (g.p.car || g.p.dead > 0) return null; let best: Door | null = null, bd = 2.3; for (const d of W.doors) { const dd = Math.hypot(d.x - g.p.x, d.z - g.p.z); if (dd < bd) { bd = dd; best = d; } } return best; }
function nearHot(): Hot | null { if (!inside) return null; let best: Hot | null = null, bd = 1e9; for (const hh of inside.hots) { const d = Math.hypot(hh.x - IP.x, hh.z - IP.z); if (d < hh.r && d < bd) { bd = d; best = hh; } } return best; }
function interact(): boolean {
  if (mode !== "play" || UI.top()) return false;
  if (inside) { const ht = nearHot(); if (ht) hotAct(ht, false); return true; }
  const d = nearDoor(); if (!d) return false;
  if (d.kind === "hosp") { const p = g.p; if (p.hp >= 100) toast("Doctor: You're perfectly healthy 👨‍⚕️"); else if (p.money < 50) toast("Treatment costs " + money(50) + " — not enough cash"); else { p.money -= 50; p.hp = 100; toast("🏥 Treated — " + money(50)); } return true; }
  enter(d); return true;
}
function enter(d: Door): void {
  fadeTo(() => {
    const key = d.kind + ":" + d.name; let I = interiors.get(key); if (!I) { I = buildInterior(d.kind, d.name); interiors.set(key, I); }
    inside = I; insideDoor = d; g.inside = true; stolen = 0;
    IP = { x: I.spawn.x, z: I.spawn.z, a: I.spawn.a, ph: 0, mv: 0, sit: false, yaw: -Math.PI / 2, pitch: 0.25 };
    I.scene.add(A.player.root); A.player.root.visible = true;
    setRenderScene(I.scene);
    if (d.kind === "market") toast("Cashier: Hey there! Welcome in 🛒"); else if (d.kind === "rest") toast("Waitress: Hi hon, what can I get you?"); else if (d.kind === "hotel") toast("Reception: Welcome to the hotel"); else if (d.kind === "home") toast("🏠 Home — your groceries are in the fridge"); else if (d.kind === "clothes") toast("Clothing store: Feel free to try things on");
  }, d.name);
}
function exitInterior(): void {
  fadeTo(() => {
    if (!inside || !insideDoor) return; const d = insideDoor;
    env.scene.add(A.player.root); setRenderScene(env.scene);
    inside = null; insideDoor = null; g.inside = false;
    g.p.x = d.ox; g.p.z = d.oz; g.p.a = d.a + Math.PI; g.yaw = g.p.a;
    if (stolen > 0) { toast("🚨 The cops are coming for the theft!"); }
  }, "");
}
function setRenderScene(s: THREE.Scene): void {
  const c = env.composer; if (c) for (const p of c.passes) { const rp = p as unknown as { scene?: THREE.Scene }; if (rp.scene) rp.scene = s; }
  renderScene = s;
}
let renderScene: THREE.Scene;
function shopPanel(title: string, items: { n: string; ic: string; price: number; sub: string; buy?: () => void; steal?: () => void; use?: () => void; useT?: string }[]): void {
  shopTitle = title; $("#shT").textContent = title; const box = $("#shI"); box.innerHTML = "";
  for (const it of items) {
    const e = h("div", { class: "item" }, `<div class="n">${it.ic} ${it.n}</div><div class="p">${it.price > 0 ? "$" + it.price : ""} <span style="color:#ccc;font-weight:600">${it.sub}</span></div><div class="a"></div>`);
    const a = e.querySelector(".a") as HTMLElement;
    if (it.buy) { const b = h("button", {}, "Buy"); b.onclick = () => { SFX.click(); it.buy!(); refreshMoney(); }; a.appendChild(b); }
    if (it.use) { const b = h("button", {}, it.useT || "Use"); b.onclick = () => { SFX.click(); it.use!(); }; a.appendChild(b); }
    if (it.steal) { const b = h("button", { class: "steal" }, "Steal 🤫"); b.onclick = () => { it.steal!(); refreshMoney(); }; a.appendChild(b); }
    box.appendChild(e);
  }
  refreshMoney(); UI.open("#shop"); g.ui = true;
}
function refreshMoney(): void { $("#shM").textContent = "Cash: " + money(g.p.money) + " · Health: " + Math.round(g.p.hp); }
function heal(n: number): void { g.p.hp = Math.min(100, g.p.hp + n); }
function cashierShout(): void {
  const lines = ["Hey! Stop, thief!", "I saw that! I'm calling the cops!", "Police! I'm being robbed!", "Put that back, you punk!"];
  toast("Cashier: " + lines[Math.floor(Math.random() * lines.length)]); if (inside) inside.npcPos.a = Math.atan2(IP.z - inside.npcPos.z, IP.x - inside.npcPos.x);
  cashierAlarm = 3;
}
let cashierAlarm = 0;
function hotAct(ht: Hot, steal: boolean): void {
  const p = g.p, I = inside as Interior;
  if (ht.id === "exit") { exitInterior(); return; }
  if (ht.id.startsWith("shelf:")) {
    const cat = +ht.id.split(":")[1], names = ["Drinks", "Snacks", "Canned food & bread", "Household"];
    const ks = Object.keys(ITEMS).filter((k: string) => ITEMS[k].cat === cat);
    if (steal) { const k = ks[Math.floor(Math.random() * ks.length)]; inv[k] = (inv[k] || 0) + 1; stolen++; L.crime(g, 1); cashierShout(); toast("Stole " + ITEMS[k].n + " 🤫"); return; }
    shopPanel((I.kind === "market" ? "🛒 " : "") + "Aisle: " + names[cat], ks.map((k: string) => ({ n: ITEMS[k].n, ic: ITEMS[k].ic, price: ITEMS[k].price, sub: ITEMS[k].hp ? "+" + ITEMS[k].hp + " health · in fridge: " + (inv[k] || 0) : "Household", buy: () => { if (p.money < ITEMS[k].price) { toast("Not enough cash"); return; } p.money -= ITEMS[k].price; inv[k] = (inv[k] || 0) + 1; toast("Bought " + ITEMS[k].n + " — sent to your fridge 🧊"); }, steal: () => { inv[k] = (inv[k] || 0) + 1; stolen++; L.crime(g, 1); cashierShout(); closeShop(); toast("Stole " + ITEMS[k].n + " 🤫"); } })));
    return;
  }
  if (ht.id === "menu") { shopPanel("🍽️ " + (insideDoor ? insideDoor.name : "Diner"), FOOD.map((f: { n: string; price: number; hp: number; ic: string }) => ({ n: f.n, ic: f.ic, price: f.price, sub: "+" + f.hp + " health", buy: () => { if (p.money < f.price) { toast("Not enough cash"); return; } if (p.hp >= 100) { toast("You're full! Health is maxed 😄"); return; } p.money -= f.price; heal(f.hp); toast("Enjoy your " + f.n + " 😋"); } }))); return; }
  if (ht.id === "room") { if (p.money < 120) { toast("A room is " + money(120) + " — not enough cash"); return; } p.money -= 120; sleep("Slept at the hotel… 💤"); return; }
  if (ht.id === "bed") { sleep("Slept at home… 💤"); return; }
  if (ht.id === "fridge") { const ks = Object.keys(inv).filter((k: string) => inv[k] > 0); if (!ks.length) { toast("The fridge is empty 🥲 buy some groceries"); return; } shopPanel("🧊 Fridge", ks.map((k: string) => ({ n: ITEMS[k].n + " ×" + inv[k], ic: ITEMS[k].ic, price: 0, sub: ITEMS[k].hp ? "+" + ITEMS[k].hp + " health" : "", use: () => { if (!ITEMS[k].hp) { toast("That's for cleaning, not eating 😅"); return; } inv[k]--; heal(ITEMS[k].hp); toast((ITEMS[k].cat === 0 ? "Drank " : "Ate ") + ITEMS[k].n); hotAct(ht, false); }, useT: ITEMS[k].cat === 0 ? "Drink" : "Eat" }))); return; }
  if (ht.id === "tv") { tvOn = !tvOn; toast(tvOn ? "📺 TV on" : "📺 TV off"); return; }
  if (ht.id === "sofa") { IP.sit = !IP.sit; if (IP.sit) { IP.x = -6.0; IP.z = 0.0; IP.a = 0; } return; }
  if (ht.id === "wardrobe") { phoneApp("clothes"); UI.open("#phone"); g.ui = true; return; }
  if (ht.id === "outfits") { shopPanel("👕 Clothing Store", OUTFITS.map((o: { n: string; price: number }, i: number) => ({ n: o.n, ic: "👔", price: owned.includes(i) ? 0 : o.price, sub: owned.includes(i) ? "Owned" : "", buy: owned.includes(i) ? undefined : () => { if (p.money < o.price) { toast("Not enough cash"); return; } p.money -= o.price; owned.push(i); outfit = i; A.setOutfit(i); I.scene.add(A.player.root); toast("Bought & wearing: " + o.n); closeShop(); }, use: owned.includes(i) ? () => { outfit = i; A.setOutfit(i); I.scene.add(A.player.root); toast("Wearing: " + o.n); } : undefined, useT: "Wear" }))); return; }
}
function closeShop(): void { UI.closeAll(); g.ui = false; }
function sleep(t: string): void { closeShop(); fadeTo(() => { env.tod = (env.tod + 8) % 24; g.p.hp = 100; doSave(); }, t, 1400); }

// ---------------- input
const k2 = new Set<string>();
function gesture(): void { SFX.init(); SFX.volume(SET.vol); setFileVolume(SET.vol); if (mode === "menu") SFX.menuMusic(true); }
function bindInput(): void {
  addEventListener("pointerdown", gesture); addEventListener("keydown", gesture);
  addEventListener("keydown", (e: KeyboardEvent) => {
    const code = e.code;
    if (mode === "load") return;
    if (UI.top() && mode !== "play" || UI.top() === "#shop" || UI.top() === "#phone") {
      if (code === "Escape" || code === "Backspace") { e.preventDefault(); back(); return; }
      if (code === "KeyT" && UI.top() === "#phone") { togglePhone(); return; }
      if (code === "ArrowDown") { e.preventDefault(); UI.move(1); } else if (code === "ArrowUp") { e.preventDefault(); UI.move(-1); }
      else if (code === "ArrowLeft") { e.preventDefault(); UI.slide(1); } else if (code === "ArrowRight") { e.preventDefault(); UI.slide(-1); }
      return;
    }
    if (mode !== "play") return;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Tab"].indexOf(code) >= 0) e.preventDefault();
    if (code === "Escape") { pause(); return; }
    if (e.repeat) return;
    if (code === "F9") { e.preventDefault(); VOX.dbgOn = !VOX.dbgOn; toast(VOX.dbgOn ? "debug on" : "debug off"); return; }
    if (code === "KeyT") { togglePhone(); return; }
    if (inside) { k2.add(code); if (code === "KeyE" || code === "KeyF") interact(); else if (code === "KeyR") { const ht = nearHot(); if (ht && ht.id.startsWith("shelf:")) hotAct(ht, true); } else if (code === "KeyV") L.micToggle(g); else if (code === "KeyB") L.ttsToggle(g); return; }
    g.keys.add(code);
    if (code === "KeyE") { if (!interact()) L.toggleCar(g); }
    else if (code === "KeyF") L.toggleCar(g);
    else if (code === "KeyQ") L.cycleW(g, -1);
    else if (code === "Space" && !g.p.car) g.jumpReq = true;
    else if (code.indexOf("Digit") === 0) L.selW(g, parseInt(code.slice(5), 10) - 1);
    else if (code === "KeyM") g.big = !g.big;
    else if (code === "KeyG") L.bMenu(g);
    else if (code === "KeyV") L.micToggle(g);
    else if (code === "KeyB") { L.ttsToggle(g); SET.tts = VOX.tts; saveSet(); }
    else if (code === "Enter" && g.b.menu >= 0) L.bConfirm(g);
  });
  addEventListener("keyup", (e: KeyboardEvent) => { g.keys.delete(e.code); k2.delete(e.code); });
  addEventListener("blur", () => { g.keys.clear(); k2.clear(); g.mDown = false; g.rDown = false; });
  glc.addEventListener("mousedown", (e: MouseEvent) => { if (mode !== "play" || UI.top()) return; glc.focus(); if (!g.locked) lock(); if (e.button === 0) g.mDown = true; if (e.button === 2) g.rDown = true; });
  addEventListener("mouseup", (e: MouseEvent) => { if (e.button === 0) g.mDown = false; if (e.button === 2) g.rDown = false; });
  addEventListener("mousemove", (e: MouseEvent) => { if (mode !== "play" || UI.top()) return; if (g.locked || g.mDown || g.rDown) { g.ldx += (e.movementX || 0) * SET.sens; g.ldy += (e.movementY || 0) * SET.sens * (SET.invertY ? -1 : 1); } });
  let wheelT = 0;
  glc.addEventListener("wheel", (e: WheelEvent) => { if (mode !== "play") return; e.preventDefault(); const n = performance.now(); if (n - wheelT < 120) return; wheelT = n; L.cycleW(g, e.deltaY > 0 ? 1 : -1); }, { passive: false });
  glc.addEventListener("contextmenu", (e: MouseEvent) => e.preventDefault());
  let wasLocked = false;
  document.addEventListener("pointerlockchange", () => { g.locked = document.pointerLockElement === glc; if (!g.locked && wasLocked && mode === "play" && !UI.top()) pause(); wasLocked = g.locked; });
  addEventListener("gamepadconnected", () => toast("Controller connected 🎮"));
  addEventListener("resize", () => env.resize(innerWidth, innerHeight));
}
// gamepad for UI + interiors (edges)
let gpPrev: boolean[] = [], gpRep = 0;
function pollUIPad(dt: number): void {
  const list = navigator.getGamepads ? navigator.getGamepads() : []; let gp: Gamepad | null = null; for (const q of list) if (q && q.connected) { gp = q; break; }
  if (!gp) { gpPrev = []; return; }
  const now: boolean[] = []; for (let i = 0; i < 18; i++) now.push(i < gp.buttons.length && gp.buttons[i].pressed);
  const ed = (i: number): boolean => now[i] && !gpPrev[i];
  const ay = gp.axes[1] || 0, ax = gp.axes[0] || 0;
  const top = UI.top();
  if (top) {
    gpRep -= dt;
    const dn = now[13] || ay > 0.6, up = now[12] || ay < -0.6, lf = now[14] || ax < -0.6, rt = now[15] || ax > 0.6;
    if ((dn || up || lf || rt) && gpRep <= 0) { gpRep = 0.18; if (dn) UI.move(1); else if (up) UI.move(-1); else if (lf) UI.slide(-1); else if (rt) UI.slide(1); } else if (!(dn || up || lf || rt)) gpRep = 0;
    if (now.some((x: boolean) => x)) gesture();
    if (ed(0)) { const a = document.activeElement as HTMLElement; if (a && a.click) a.click(); }
    if (ed(1)) back();
    if (ed(9) && mode === "pause") resume(); else if (ed(9) && (top === "#phone" || top === "#shop")) back();
    if ((ed(8) || ed(17)) && top === "#phone") togglePhone();
  } else if (mode === "play" && inside) {
    if (ed(3)) interact();
    if (ed(1)) { const ht = nearHot(); if (ht && ht.id.startsWith("shelf:")) hotAct(ht, true); }
    if (ed(9)) pause();
    if (ed(8) || ed(17)) togglePhone();
  } else if (mode === "menu" && ed(0)) { /* handled by focus */ }
  if (mode === "play" && !inside && !top && ed(1)) { /* circle free outside */ }
  gpPrev = now;
}

// ---------------- interior update
function updateInterior(dt: number): void {
  const I = inside as Interior;
  const pad = g.pad, po = pad.on && !g.ui;
  if (!g.ui) {
    IP.yaw += g.ldx * 0.0026; IP.pitch = THREE.MathUtils.clamp(IP.pitch + g.ldy * 0.002, -0.2, 1.0);
    if (k2.has("ArrowLeft")) IP.yaw -= 2 * dt; if (k2.has("ArrowRight")) IP.yaw += 2 * dt;
    if (po) { IP.yaw += pad.rx * 2.8 * dt * SET.sens; IP.pitch = THREE.MathUtils.clamp(IP.pitch + pad.ry * 1.8 * dt, -0.2, 1.0); }
  }
  g.ldx = 0; g.ldy = 0;
  let fwd = (k2.has("KeyW") ? 1 : 0) - (k2.has("KeyS") ? 1 : 0), right = (k2.has("KeyD") ? 1 : 0) - (k2.has("KeyA") ? 1 : 0);
  if (po && (pad.lx !== 0 || pad.ly !== 0)) { right = pad.lx; fwd = -pad.ly; }
  if (g.ui) { fwd = 0; right = 0; }
  if ((fwd || right) && IP.sit) IP.sit = false;
  const cy = Math.cos(IP.yaw), sy = Math.sin(IP.yaw);
  let wx = cy * fwd - sy * right, wz = sy * fwd + cy * right; const len = Math.hypot(wx, wz); if (len > 1) { wx /= len; wz /= len; }
  const run = k2.has("ShiftLeft") || (po && pad.l3), sp = run ? 5.5 : 3.0;
  const nx = IP.x + wx * sp * dt, nz = IP.z + wz * sp * dt;
  if (!blockedIn(I, nx, IP.z, 0.35)) IP.x = nx; if (!blockedIn(I, IP.x, nz, 0.35)) IP.z = nz;
  const ml = Math.hypot(wx, wz); if (ml > 0.1) { IP.ph += dt * sp * 2; IP.mv = Math.min(1, ml); IP.a += L.angDiff(Math.atan2(wz, wx), IP.a) * Math.min(1, dt * 10); } else IP.mv = 0;
  const P = A.player; P.root.position.set(IP.x, IP.sit ? 0.05 : 0, IP.z); P.root.rotation.y = Math.PI / 2 - IP.a;
  animate(P, { ph: IP.ph, mv: IP.mv, spd: IP.mv ? sp : 0, y: 0, aim: 0, aimP: 0, punch: 0, dead: 0, sit: IP.sit ? 1 : 0, crouch: 0, dt, lod: 0 });
  if (P.gun) { P.gun.removeFromParent(); P.gun = null; P.gunId = 0; }
  if (I.npc) { cashierAlarm = Math.max(0, cashierAlarm - dt); I.npc.root.rotation.y = Math.PI / 2 - (cashierAlarm > 0 ? Math.atan2(IP.z - I.npcPos.z, IP.x - I.npcPos.x) : I.npcPos.a); animate(I.npc, { ph: g.t * 3, mv: 0, spd: 0, y: 0, aim: cashierAlarm > 0 ? 1 : 0, aimP: 0.6, punch: 0, dead: 0, sit: 0, crouch: 0, dt, lod: 0 }); }
  if (I.tv) I.tv.emissiveIntensity = tvOn ? 0.8 + Math.sin(g.t * 9) * 0.3 + Math.random() * 0.2 : 0;
  // camera
  const cam = env.camera, tx = IP.x, ty = 1.55, tz = IP.z; let dist = 3.0;
  const cp = Math.cos(IP.pitch);
  for (let d = dist; d > 0.6; d -= 0.1) { const ex = tx - cy * cp * d, ez = tz - sy * cp * d; if (Math.abs(ex) < I.w / 2 - 0.25 && Math.abs(ez) < I.d / 2 - 0.25) { dist = d; break; } dist = d; }
  cam.position.set(tx - cy * cp * dist, Math.min(3.3, ty + Math.sin(IP.pitch) * dist), tz - sy * cp * dist); cam.lookAt(tx, ty - 0.1, tz); cam.fov = 60; cam.updateProjectionMatrix();
  // prompt
  const ht = nearHot(); showPrompt(g.ui ? "" : ht ? ht.label : "");
}
let promptCur = "";
function showPrompt(s: string): void { if (s === promptCur) return; promptCur = s; if (s) { $("#prT").textContent = s; $("#prompt").classList.add("on"); } else $("#prompt").classList.remove("on"); }

// ---------------- cinematic menu camera
const camPath = new THREE.CatmullRomCurve3([[200, 70, 120], [360, 110, 220], [520, 60, 300], [520, 40, 470], [360, 30, 560], [180, 55, 480], [110, 25, 160], [250, 45, 90]].map((p: number[]) => new THREE.Vector3(p[0], p[1], p[2])), true, "catmullrom", 0.5);
function menuCamera(dt: number): void {
  menuT += dt * 0.006; const u = menuT % 1, cam = env.camera;
  const p = camPath.getPointAt(u), q = camPath.getPointAt((u + 0.02) % 1);
  cam.position.copy(p); const look = new THREE.Vector3(L.WORLD / 2, 20, L.WORLD / 2).lerp(q, 0.55); look.y = Math.max(5, q.y - 20); cam.lookAt(look); cam.fov = 55; cam.updateProjectionMatrix();
  // keep traffic/peds alive around the camera
  g.p.x = THREE.MathUtils.clamp(q.x, 20, L.WORLD - 20); g.p.z = THREE.MathUtils.clamp(q.z, 20, L.WORLD - 20);
}

// ---------------- main loop
let last = performance.now();
function loop(now: number): void {
  requestAnimationFrame(loop);
  const t0 = performance.now(); const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = Math.max(last, now);
  pollUIPad(dt);
  const act = L.pollPad(g);
  if (act === 1 && mode === "play" && !UI.top()) pause();
  else if (act >= 1 && mode === "pause" && UI.top() === "#pause") { /* handled in pollUIPad */ }
  if (g.pad.on) { g.pad.rx *= SET.sens; g.pad.ry *= SET.sens * (SET.invertY ? -1 : 1); }
  if (mode === "menu") { g.started = false; L.update(g, dt); menuCamera(dt); }
  else if (mode === "play") {
    if (inside) { L.update(g, dt); updateInterior(dt); }
    else { L.update(g, dt); }
  }
  const cam = env.camera;
  if (mode !== "menu" && !inside) {
    cam.position.set(g.ex, g.ey, g.ez); cam.lookAt(g.tx, g.ty, g.tz);
    const fov = g.p.car ? 70 : g.aiming ? 42 : 62; if (Math.abs(cam.fov - fov) > 0.1) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 8); cam.updateProjectionMatrix(); }
  }
  cam.updateMatrixWorld();
  const pv = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); g.pv = new Float32Array(pv.elements);
  // world environment
  const focus = inside ? new THREE.Vector3(g.p.x, 0, g.p.z) : mode === "menu" ? new THREE.Vector3(cam.position.x, 0, cam.position.z) : new THREE.Vector3(g.p.x, 0, g.p.z);
  if (mode !== "pause") env.update(dt, focus, mode === "menu" ? TS * 3 : TS, city.lampPos);
  city.wind.value = env.cur.wind; city.update(cam.position, env.night, env.wet, g.t);
  setHeadlights(env.night);
  A.q = env.q; if (!inside) A.sync(g, mode === "pause" ? 0 : dt, cam.position, env.night, mode === "menu");
  // ambience audio
  fx.setRain(inside ? 0 : env.cur.rain); fx.setRainCenter({ x: cam.position.x, y: 0, z: cam.position.z }); fx.update(mode === "pause" ? 0 : dt);
  audioFrame(cam);
  // prompts outside
  if (!inside) { const d = mode === "play" && !UI.top() ? nearDoor() : null; showPrompt(d ? (d.kind === "hosp" ? "Press E / △ for treatment (" + money(50) + ") — " + d.name : "Press E / △ to enter — " + d.name) : ""); }
  if (inside) { renderer().render(inside.scene, cam); } else env.render();
  // HUD
  const Wd = innerWidth, Hd = innerHeight, d2 = Math.min(2, devicePixelRatio || 1);
  if (hudc.width !== Math.round(Wd * d2) || hudc.height !== Math.round(Hd * d2)) { hudc.width = Math.round(Wd * d2); hudc.height = Math.round(Hd * d2); }
  hx.setTransform(d2, 0, 0, d2, 0, 0);
  if (mode === "play" || mode === "pause") { if (inside) hudInside(Wd, Hd); else { L.hud(g, hx, Wd, Hd); hudExtra(Wd, Hd); } } else hx.clearRect(0, 0, Wd, Hd);
  // fps
  frameMs = frameMs * 0.95 + (performance.now() - t0) * 0.05;
  fpsN++; const nowF = performance.now(); if (!fpsT) fpsT = nowF; if (nowF - fpsT >= 1000) { fps = fpsN * 1000 / (nowF - fpsT); fpsT = nowF; fpsN = 0; (window as unknown as { __fps: number }).__fps = fps; }
}
const GUNS = ["pistol", "pistol", "uzi", "shotgun", "ak", "sniper", "rpg"] as const;
function gameEvent(n: string, x: number, y: number, z: number, a: number): void {
  if (inside || mode === "menu") return;
  const pos = { x, y, z }, d = Math.hypot(x - g.p.x, z - g.p.z);
  if (n === "gun") { const gn = GUNS[a] || "pistol"; SFX.oneShot(gn, pos, 0.9, "gun_" + gn); const dir = { x: Math.cos(g.yaw), y: 0, z: Math.sin(g.yaw) }; if (d < 3 && a !== 6) fx.shell({ x: x + dir.z * 0.2, y: 1.3, z: z - dir.x * 0.2 }, { x: -dir.z, y: 0, z: dir.x }, a === 3 ? "shotgun" : a >= 4 ? "rifle" : "pistol"); }
  else if (n === "npcgun") SFX.oneShot("pistol", pos, 0.8, a === 3 ? "gun_ak" : "gun_pistol");
  else if (n === "wanted") { let near = false; for (const c of g.cars) if (c.drv === 3 && c.dead <= 0 && Math.hypot(c.x - x, c.z - z) < 45) near = true; for (const e of g.peds) if ((e as unknown as { cop?: boolean }).cop && Math.hypot(e.x - x, e.z - z) < 45) near = true; if (near || a >= 2) { const ln = ["Freeze! Drop your weapon!", "Hands up!"]; playVoice(ln[Math.floor(Math.random() * ln.length)], SET.vol); } }
  else if (n === "punch") SFX.oneShot("punch", pos, 0.8);
  else if (n === "crash") { if (a > 6) SFX.oneShot("crash", pos, Math.min(1, a / 20)); }
  else if (n === "boom") { SFX.oneShot(d < 60 ? "explosion_near" : "explosion_far", pos, 1); fx.explosion(pos, 1, { smoke: 1, debris: 1, scorch: true }); fx.shockwave(pos, 12); }
}
const fwdV = new THREE.Vector3();
function audioFrame(cam: THREE.PerspectiveCamera): void {
  cam.getWorldDirection(fwdV); SFX.listener(cam.position, fwdV);
  const amb = mode === "play" || mode === "menu", io = inside ? 0.25 : 1, C = env.cur;
  SFX.loopSet("rain", "rain", amb && C.rain > 0.05, { intensity: C.rain * io });
  SFX.loopSet("wind", "wind", amb && C.wind > 0.3, { intensity: (C.wind - 0.2) * io });
  SFX.loopSet("sand", "sandstorm", amb && C.sand > 0.1, { intensity: C.sand * io });
  SFX.loopSet("cityD", "city", amb && !inside && env.night < 0.6, { intensity: 0.45 * (1 - env.night), day: 1 }, "city_day_loop");
  SFX.loopSet("cityN", "city", amb && !inside && env.night > 0.4, { intensity: 0.4 * env.night, day: 0 }, "city_night_loop");
  const pc = g.p.car, drive = mode === "play" && !inside && !!pc && pc.dead <= 0;
  const big = !!pc && (pc.t.kind === 4 || pc.t.kind === 5);
  const spd = pc ? Math.hypot(pc.vx, pc.vz) : 0, thr = (g.keys.has("KeyW") ? 1 : 0) + (g.pad.on ? g.pad.r2 : 0);
  SFX.loopSet(big ? "engT" : "engC", big ? "engine_truck" : "engine_car", drive, { speed: spd, throttle: Math.min(1, thr), pos: pc ? { x: pc.x, y: 0.6, z: pc.z } : undefined, volume: 0.8 });
  let cop: L.Car | null = null, cd = 90; if (mode === "play") for (const c of g.cars) if (c.drv === 3 && c.dead <= 0) { const d = Math.hypot(c.x - g.p.x, c.z - g.p.z); if (d < cd) { cd = d; cop = c; } }
  SFX.loopSet("siren", "siren_police", !!cop, { pos: cop ? { x: cop.x, y: 1, z: cop.z } : undefined, mode: Math.floor(g.t / 6) % 2 ? "yelp" : "wail", volume: 0.7 });
}
function renderer(): THREE.WebGLRenderer { return env.renderer; }
function hudExtra(Wd: number, Hd: number): void {
  const c = hx, small = Wd < 620;
  L.txt(c, "🕒 " + clockStr() + "  " + WEATHER_EN[env.wMix < 1 ? env.wNext : env.weather], 14, 24, small ? 13 : 15, "#ffffff", "left");
  if (VOX.dbgOn) { const info = env.renderer.info; L.txt(c, `FPS ${fps.toFixed(0)} · ${frameMs.toFixed(1)}ms · draw ${info.render.calls} · tri ${(info.render.triangles / 1000).toFixed(0)}k · ${SET.q}`, 14, 48, 13, "#9cff9c", "left"); }
}
function hudInside(Wd: number, Hd: number): void {
  const c = hx; c.clearRect(0, 0, Wd, Hd); c.direction = "ltr";
  L.txt(c, "$" + g.p.money.toLocaleString("en-US"), Wd - 14, 26, 24, "#7CFC7C", "right");
  c.fillStyle = "rgba(0,0,0,0.55)"; c.fillRect(Wd - 174, 46, 160, 11); c.fillStyle = g.p.hp > 35 ? "#43a047" : "#e53935"; c.fillRect(Wd - 173, 47, (158 * g.p.hp) / 100, 9);
  const sN = L.stars(g); if (sN > 0) L.txt(c, "★".repeat(sN), Wd - 14, 76, 22, "#ffc107", "right");
  L.txt(c, insideDoor ? insideDoor.name : "", Wd / 2, 26, 20, "#ffe082", "center");
  g.msgs.forEach((m: { s: string; l: number }, i: number) => { c.globalAlpha = Math.min(1, m.l * 2); L.txt(c, m.s, Wd / 2, 60 + i * 30, 20, "#ffffff", "center"); c.globalAlpha = 1; });
  L.vHud(c, Wd, Wd < 620); c.direction = "ltr";
  L.txt(c, "🕒 " + clockStr(), 14, 24, 15, "#ffffff", "left");
}

bindMenus(); bindInput();
boot().then(() => { renderScene = env.scene; void renderScene; (window as unknown as Record<string, unknown>).__game = { L, g: () => g, env: () => env, mode: () => mode, inside: () => inside, enter: (k: string) => { const d = W.doors.find((x: Door) => x.kind === k); if (d) enter(d); }, W: () => W, interact, exitInterior, fps: () => fps, setQ: (q: Quality) => { SET.q = q; env.setQuality(q, innerWidth, innerHeight); }, tod: (t: number) => { env.tod = t; }, weather: (w: Weather) => { env.autoWeather = false; env.setWeather(w, true); }, hotAct: (id: string, s: boolean) => { const ht = inside && inside.hots.find((x: Hot) => x.id === id); if (ht) hotAct(ht, s); }, IP: () => IP, inv: () => inv, phone: () => togglePhone(), phoneApp }; }).catch((e: Error) => { prog(0, "Error: " + e.message); console.error(e); });
void Math; void WP;
