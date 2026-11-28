// DOM UI: main menu, pause, settings, controls, about, phone, shop panel, prompt, fade, loading
export const CSS = `
@font-face{font-family:Cairo;src:url(fonts/cairo.ttf) format("truetype");font-weight:200 1000;font-display:swap}
@font-face{font-family:Kufi;src:url(fonts/kufi.ttf) format("truetype");font-weight:100 900;font-display:swap}
:root{--acc:#ff8a1f;--acc2:#ffcf4a;--glass:rgba(14,16,22,.62);--line:rgba(255,255,255,.14)}
*{box-sizing:border-box}
html,body{margin:0;height:100%;overflow:hidden;background:#07080b;color:#f4f5f7;font-family:Cairo,"Noto Sans Arabic",system-ui,sans-serif}
#gl,#hud{position:fixed;inset:0;width:100%;height:100%;display:block}
#hud{pointer-events:none}
.ui{position:fixed;inset:0;display:none;direction:ltr}
.ui.on{display:flex}
#menu{align-items:stretch;justify-content:flex-start;background:linear-gradient(90deg,rgba(0,0,0,.0) 0%,rgba(0,0,0,.15) 45%,rgba(5,6,10,.78) 100%)}
#menu .side{width:min(460px,92vw);padding:6vh 4vw;display:flex;flex-direction:column;gap:10px;justify-content:center;animation:slideIn .8s cubic-bezier(.2,.8,.2,1)}
.logo{font-family:Kufi,Cairo,sans-serif;font-weight:900;font-size:clamp(44px,7vw,86px);line-height:1.05;background:linear-gradient(180deg,#fff7d6 0%,var(--acc2) 35%,var(--acc) 70%,#b33b00 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 6px 18px rgba(255,120,0,.45)) drop-shadow(0 2px 0 rgba(0,0,0,.6));position:relative}
.logoImg{display:block;width:min(440px,86vw);height:auto;filter:drop-shadow(0 10px 30px rgba(0,0,0,.6));animation:logoIn 1.2s cubic-bezier(.2,.8,.2,1)}
@keyframes logoIn{from{opacity:0;transform:scale(.9) translateY(-10px)}to{opacity:1;transform:none}}
.logo small{display:block;font-size:.34em;letter-spacing:.35em;color:#fff;-webkit-text-fill-color:#fff;opacity:.85;font-family:Cairo;font-weight:800;margin-top:6px;filter:none}
.logo .shine{position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.75) 50%,transparent 70%);background-size:250% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:shine 4.5s infinite}
.tag{color:#cfd3da;font-size:15px;margin:2px 0 18px;opacity:.9}
.btn{all:unset;cursor:pointer;display:flex;align-items:center;gap:12px;padding:13px 20px;border-radius:14px;background:var(--glass);border:1px solid var(--line);backdrop-filter:blur(10px);font-size:19px;font-weight:800;transition:transform .18s,background .18s,border-color .18s,box-shadow .18s;color:#fff}
.btn:hover,.btn:focus,.btn.sel{transform:translateX(-8px);background:linear-gradient(90deg,rgba(255,138,31,.95),rgba(255,95,31,.85));border-color:transparent;box-shadow:0 10px 30px rgba(255,110,20,.35)}
.btn .i{width:26px;text-align:center;font-size:20px}
.btn[disabled]{opacity:.4;pointer-events:none}
.ver{position:fixed;left:16px;bottom:12px;font-size:12px;color:#9aa0aa;direction:ltr}
.panel{margin:auto;width:min(720px,94vw);max-height:86vh;overflow:auto;background:rgba(12,14,20,.86);border:1px solid var(--line);border-radius:20px;padding:22px 24px;backdrop-filter:blur(14px);animation:pop .3s ease;box-shadow:0 30px 80px rgba(0,0,0,.5)}
.panel h2{margin:0 0 14px;font-size:26px;font-weight:900;color:var(--acc2)}
.row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line);font-size:16px}
.row .k{font-weight:800;min-width:150px}
.seg{display:flex;gap:6px}.seg button{all:unset;cursor:pointer;padding:6px 14px;border-radius:10px;border:1px solid var(--line);font-weight:700}
.seg button.on,.seg button:focus{background:var(--acc);border-color:transparent}
input[type=range]{width:200px;accent-color:var(--acc)}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:18px}.cols h3{margin:6px 0;color:#fff}
.kv{display:flex;gap:10px;font-size:14px;padding:5px 0;border-bottom:1px dashed var(--line)}.kv b{min-width:120px;color:var(--acc2)}
.back{margin-top:16px}
#pause{background:rgba(0,0,0,.55);backdrop-filter:blur(6px);align-items:center;justify-content:center}
#pause .side{display:flex;flex-direction:column;gap:10px;width:min(380px,90vw);animation:pop .25s}
#pause h1{font-family:Kufi,Cairo;font-size:40px;margin:0 0 10px;text-align:center;color:var(--acc2)}
#phone{pointer-events:none;align-items:flex-end;justify-content:flex-end;padding:3vh 3vw}
.ph{pointer-events:auto;width:300px;height:560px;border-radius:42px;background:#0b0d12;border:3px solid #2a2e37;box-shadow:0 30px 80px rgba(0,0,0,.6),inset 0 0 0 6px #000;padding:16px 14px;display:flex;flex-direction:column;animation:phoneUp .35s cubic-bezier(.2,.9,.2,1)}
.ph .scr{flex:1;border-radius:30px;background:linear-gradient(160deg,#1d3557,#3a0ca3 60%,#f72585);padding:14px;display:flex;flex-direction:column;overflow:hidden}
.ph .bar{display:flex;justify-content:space-between;font-size:13px;font-weight:800;direction:ltr}
.ph .clock{font-size:46px;font-weight:900;text-align:center;margin:8px 0 2px;direction:ltr}
.ph .date{text-align:center;font-size:13px;opacity:.85;margin-bottom:12px}
.apps{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.app{all:unset;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:5px;font-size:12px;font-weight:800;padding:6px 0;border-radius:14px}
.app span{width:58px;height:58px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:28px;box-shadow:0 6px 16px rgba(0,0,0,.35)}
.app:focus span,.app.sel span,.app:hover span{outline:3px solid #fff;transform:scale(1.06)}
.ph .sub{display:flex;flex-direction:column;gap:8px}.ph .sub .btn{font-size:15px;padding:10px 14px}
#shop{align-items:center;justify-content:center;background:rgba(0,0,0,.35)}
.items{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
.item{display:flex;flex-direction:column;gap:6px;padding:12px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid var(--line)}
.item .n{font-weight:900;font-size:17px}.item .p{color:#7CFC7C;font-weight:800}
.item .a{display:flex;gap:6px}.item .a button{all:unset;cursor:pointer;flex:1;text-align:center;padding:7px 8px;border-radius:10px;background:var(--acc);font-weight:800;font-size:14px}
.item .a button.steal{background:#b71c1c}.item .a button:focus{outline:3px solid #fff}
#prompt{pointer-events:none;align-items:flex-end;justify-content:center;padding-bottom:16vh}
#prompt div{background:rgba(0,0,0,.65);border:1px solid var(--line);padding:10px 18px;border-radius:12px;font-weight:800;font-size:18px;animation:pop .2s}
#fade{background:#000;pointer-events:none;opacity:0;transition:opacity .45s;display:flex}
#fade.on{opacity:1}
#fade .t{margin:auto;font-family:Kufi,Cairo;font-size:30px;color:#fff;opacity:.9}
#loading{background:#07080b;align-items:center;justify-content:center;flex-direction:column;gap:18px;z-index:9}
#loading .bar{width:min(380px,70vw);height:6px;border-radius:6px;background:#222;overflow:hidden}#loading .bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--acc2),var(--acc));transition:width .2s}
@keyframes slideIn{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:none}}
@keyframes pop{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
@keyframes phoneUp{from{transform:translateY(120%)}to{transform:none}}
@keyframes shine{0%{background-position:150% 0}60%,100%{background-position:-100% 0}}
`;

export function h(tag: string, attrs: Record<string, string>, html: string): HTMLElement { const e = document.createElement(tag); for (const k of Object.keys(attrs)) e.setAttribute(k, attrs[k]); e.innerHTML = html; return e; }
export const $ = (s: string): HTMLElement => document.querySelector(s) as HTMLElement;

export class UIStack {
  stack: string[] = [];
  open(id: string, reset = true): void { if (document.pointerLockElement) document.exitPointerLock(); for (const s of this.stack) $(s).classList.remove("on"); if (reset) this.stack = []; this.stack.push(id); $(id).classList.add("on"); this.focusFirst(); }
  push(id: string): void { this.open(id, false); }
  pop(): string | null { const top = this.stack.pop(); if (top) $(top).classList.remove("on"); const n = this.stack[this.stack.length - 1]; if (n) { $(n).classList.add("on"); this.focusFirst(); } return n || null; }
  closeAll(): void { for (const s of this.stack) $(s).classList.remove("on"); this.stack = []; }
  top(): string | null { return this.stack[this.stack.length - 1] || null; }
  focusables(): HTMLElement[] { const t = this.top(); if (!t) return []; return Array.from($(t).querySelectorAll("button,input")).filter((e: Element) => (e as HTMLElement).offsetParent !== null && !(e as HTMLButtonElement).disabled) as HTMLElement[]; }
  focusFirst(): void { const f = this.focusables(); if (f.length) setTimeout(() => f[0].focus({ preventScroll: true }), 30); }
  move(d: number): void { const f = this.focusables(); if (!f.length) return; const i = f.indexOf(document.activeElement as HTMLElement); const n = f[(i + d + f.length) % f.length]; n.focus(); n.scrollIntoView({ block: "nearest" }); }
  slide(d: number): void { const a = document.activeElement as HTMLInputElement; if (a && a.type === "range") { a.value = String(+a.value + d * (+a.step || 1) * 5); a.dispatchEvent(new Event("input")); } else this.move(d); }
}
