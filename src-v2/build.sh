#!/bin/bash
# Build v2 into dist/ and (optionally) copy into the deploy repo.
set -e
cd /workspace/madinat-v2
# logic.ts is now hand-edited (mklogic.py frozen)
npx tsc -p . 
rm -rf dist && mkdir -p dist/fonts
npx esbuild src/main.ts --bundle --minify --format=esm --target=es2020 --outfile=dist/app.js --log-level=warning --legal-comments=none
cp public/fonts/*.ttf dist/fonts/
mkdir -p dist/decoders/draco dist/decoders/basis && cp node_modules/three/examples/jsm/libs/draco/gltf/draco_decoder.{js,wasm} node_modules/three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js dist/decoders/draco/ && cp node_modules/three/examples/jsm/libs/basis/basis_transcoder.{js,wasm} dist/decoders/basis/
python3 tools/assets.py dist
V=$(date +%s)
cat > dist/index.html <<HTML
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<meta name="theme-color" content="#07080b">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌆</text></svg>">
<link rel="preload" href="fonts/cairo.ttf" as="font" type="font/ttf" crossorigin>
<title>Chaos City | مدينة الفوضى</title>
</head>
<body><script type="module" src="app.js?v=$V"></script></body>
</html>
HTML
ls -la dist | head
if [ "$1" = "deploy" ]; then
  cd /workspace/site
  find . -mindepth 1 -maxdepth 1 ! -name .git ! -name README.md ! -name v1.html -exec rm -rf {} +
  cp -r /workspace/madinat-v2/dist/* .
  mkdir -p src-v2 && rsync -a --delete --exclude node_modules --exclude dist /workspace/madinat-v2/ src-v2/ 2>/dev/null || cp -r /workspace/madinat-v2/{src,tools,public,package.json,tsconfig.json,build.sh} src-v2/
  echo "copied to site"
fi
