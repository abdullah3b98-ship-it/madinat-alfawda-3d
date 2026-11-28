import re
# Collect optional external assets into dist/assets and write manifest.json
import os, json, shutil, sys
dist = sys.argv[1]
SRC = '/workspace/assets'
out = os.path.join(dist, 'assets'); shutil.rmtree(out, ignore_errors=True); os.makedirs(out, exist_ok=True)
man = {'models': [], 'lazy': [], 'audio': [], 'voice': {}, 'ui': []}
MAXB = 60 * 1024 * 1024
total = 0
for root, dirs, files in os.walk(SRC):
    if '/_work' in root or '/.' in root: continue
    for f in sorted(files):
        p = os.path.join(root, f); rel = os.path.relpath(p, SRC); ext = f.lower().rsplit('.', 1)[-1]
        top = rel.split('/')[0]
        if top not in ('models', 'audio', 'ui', 'anims', 'map'): continue
        kind = 'map' if top == 'map' else 'models' if ext in ('glb', 'gltf', 'bin') else 'audio' if ext in ('mp3', 'ogg', 'wav', 'm4a') else 'ui' if (ext in ('png', 'svg', 'webp', 'jpg') and rel.startswith('ui/')) else ('map' if top == 'map' and ext == 'json' else None) if top == 'map' else ('tex' if ext in ('png','jpg','jpeg','webp','ktx2') else None)
        if kind is None: continue
        if top == 'map' and ext != 'json': continue
        if re.search(r'(npc_woman_abaya|player_saudi|sultan_thobe)', f) or re.match(r'(police_car|ambulance|pickup|bus)\.glb$', f): continue  # American setting
        mlod = re.search(r'_lod(\d)\.(glb|gltf)$', f)
        if mlod and not rel.startswith('models/characters/npc'): continue  # only NPC LODs are worth shipping (vehicles/weapons are tiny)
        if f.endswith('_preview.png'): continue
        if top == 'anims' and os.path.exists(os.path.join(SRC, 'anims', 'all_anims.glb')) and f != 'all_anims.glb': continue
        loopy = f.lower().rsplit('.',1)[0].endswith('_loop') or f.lower().startswith('menu_theme')
        if ext == 'ogg' and not loopy and os.path.exists(p[:-3] + 'mp3'): continue
        if ext == 'mp3' and loopy and os.path.exists(p[:-3] + 'ogg'): continue
        sz = os.path.getsize(p)
        if total + sz > MAXB: print('skip (size budget)', rel); continue
        total += sz
        dst = os.path.join(out, rel); os.makedirs(os.path.dirname(dst), exist_ok=True); shutil.copy2(p, dst)
        if kind == 'ui' and ext == 'png':
            try:
                from PIL import Image
                im = Image.open(dst)
                if im.width > 1200: im.resize((1200, round(im.height * 1200 / im.width)), Image.LANCZOS).save(dst, optimize=True)
            except Exception as e: print('ui resize', rel, e)
        if kind == 'models' and ext != 'bin':
            # NPCs boot with LOD1; LOD0 (close-up) and LOD2 (Low preset) are lazy-loaded after the game starts
            if mlod: (man['models'] if mlod.group(1) == '1' else man['lazy']).append(rel)
            elif rel.startswith('models/characters/npc'): man['lazy'].append(rel)
            else: man['models'].append(rel)
        elif kind == 'map': pass
        elif kind == 'audio': man['audio'].append(rel)
        elif kind == 'ui': man['ui'].append(rel)
vi = os.path.join(SRC, 'audio', 'voice', 'index.json')
if os.path.exists(vi):
    try:
        d = json.load(open(vi, encoding='utf-8'))
        items = d.items() if isinstance(d, dict) else [(x.get('file'), x.get('text')) for x in d]
        for k, v in items:
            if not k or not v: continue
            # normalise: key file, value text (accept either orientation)
            if not str(k).lower().endswith(('.mp3', '.ogg', '.wav', '.m4a')): k, v = v, k
            rel = k if k.startswith('audio/') else 'audio/voice/' + os.path.basename(k)
            if os.path.exists(os.path.join(out, rel)): man['voice'][rel] = v
    except Exception as e: print('voice index error', e)
json.dump(man, open(os.path.join(out, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print('assets:', len(man['models']), 'models,', len(man['audio']), 'audio,', len(man['voice']), 'voice lines,', round(total / 1e6, 1), 'MB')
