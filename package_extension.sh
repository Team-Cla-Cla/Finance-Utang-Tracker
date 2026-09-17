#!/usr/bin/env bash
# Packages the extension into a permanent Firefox .xpi bundle
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_XPI="${SCRIPT_DIR}/finance-utang-tracker@ryme.local.xpi"

echo "[*] Packaging extension from ${SCRIPT_DIR}/extension into ${OUTPUT_XPI}..."
cd "${SCRIPT_DIR}/extension"
zip -r -FS "${OUTPUT_XPI}" * -x "*.git*" -x "*DS_Store*"

echo "[+] Successfully created: ${OUTPUT_XPI}"
OUTPUT_ZIP="${SCRIPT_DIR}/finance-utang-tracker.zip"
cp -f "${OUTPUT_XPI}" "${OUTPUT_ZIP}"
echo "[+] Successfully created: ${OUTPUT_ZIP}"
echo "[*] Permanent Firefox ID: finance-utang-tracker@ryme.local"
