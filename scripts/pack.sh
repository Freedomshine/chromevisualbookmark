#!/usr/bin/env bash
# 打包上传到 Chrome 网上应用店的 zip：只放扩展运行需要的文件；-X 去掉 UID/GID 等系统附加信息
set -euo pipefail
cd "$(dirname "$0")/.."
version=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
mkdir -p dist
out="dist/visual-bookmark-$version.zip"
rm -f "$out"
zip -rqX "$out" manifest.json bookmarks.html popup.html css js images -x '*.DS_Store'
echo "$out"
