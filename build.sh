#!/bin/sh
# Rebuilds vendor/three-app.js (tree-shaken three r170 + src/combo3d.js). Needs node + esbuild + three@0.170.0.
B=${B:-/workspace/br-work/bundle}
NODE_PATH=$B/node_modules $B/node_modules/.bin/esbuild src/three-entry.js --bundle --format=esm --minify --target=es2020 --legal-comments=none --outfile=vendor/three-app.js
