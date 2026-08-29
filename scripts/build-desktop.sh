#!/usr/bin/env bash
set -e

echo "=================================================="
echo "🚀 CodeMind-Hub Unix/macOS Desktop Packaging Pipeline"
echo "=================================================="

# 1. Build Frontend
echo "[1/3] Building Webview Frontend..."
cd prototype
npm run build
cd ..

# 2. Test Gate
echo "[2/3] Running Contract Tests..."
cd prototype
npm test
cd ..

echo "[3/3] Build Verification Succeeded!"
echo "✨ Packaging ready."
