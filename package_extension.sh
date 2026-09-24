#!/usr/bin/env bash
# Packages the extension into a permanent Firefox .xpi bundle
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST_FILE="${SCRIPT_DIR}/extension/manifest.json"
OUTPUT_XPI="${SCRIPT_DIR}/finance-utang-tracker.xpi"
OUTPUT_LEGACY_XPI="${SCRIPT_DIR}/finance-utang-tracker@ryme.local.xpi"
OUTPUT_ZIP="${SCRIPT_DIR}/finance-utang-tracker.zip"

VERSION=$(grep '"version"' "${MANIFEST_FILE}" | head -n 1 | sed -E 's/.*"version": "([^"]+)".*/\1/')
echo "=================================================="
echo "[*] Packaging Extension Version: v${VERSION}"
echo "=================================================="

echo "[*] Packaging extension from ${SCRIPT_DIR}/extension into ${OUTPUT_XPI}..."
cd "${SCRIPT_DIR}/extension"
zip -r -FS "${OUTPUT_XPI}" * -x "*.git*" -x "*DS_Store*"

cp -f "${OUTPUT_XPI}" "${OUTPUT_LEGACY_XPI}"
cp -f "${OUTPUT_XPI}" "${OUTPUT_ZIP}"
echo "[+] Successfully created: ${OUTPUT_XPI} (v${VERSION})"
echo "[+] Successfully created: ${OUTPUT_LEGACY_XPI} (v${VERSION})"
echo "[+] Successfully created: ${OUTPUT_ZIP} (v${VERSION})"
