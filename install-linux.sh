#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${HOME}/BowlingLeagueHelper"
BIN_DIR="${HOME}/.local/bin"
APPS_DIR="${HOME}/.local/share/applications"

echo "Installing Bowling League Helper to ${INSTALL_DIR}..."
mkdir -p "${INSTALL_DIR}" "${BIN_DIR}" "${APPS_DIR}"

cp "${SCRIPT_DIR}/BowlingLeagueHelper.html" "${INSTALL_DIR}/BowlingLeagueHelper.html"
cp "${SCRIPT_DIR}/version.json" "${INSTALL_DIR}/version.json"
cp "${SCRIPT_DIR}/desktop/assets/icon.png" "${INSTALL_DIR}/bowling-icon.png"
cp "${SCRIPT_DIR}/desktop/host/linux-host.mjs" "${INSTALL_DIR}/linux-host.mjs"
chmod +x "${INSTALL_DIR}/linux-host.mjs"

cat > "${BIN_DIR}/bowling-league-helper" <<EOF
#!/usr/bin/env bash
exec node "${INSTALL_DIR}/linux-host.mjs" "\$@"
EOF
chmod +x "${BIN_DIR}/bowling-league-helper"

DESKTOP_ENTRY="[Desktop Entry]
Type=Application
Version=1.0
Name=Bowling League Helper
Comment=Offline bowling league scorekeeper, bracket manager, treasurer & lane scheduler
Exec=${BIN_DIR}/bowling-league-helper
Icon=${INSTALL_DIR}/bowling-icon.png
Terminal=false
Categories=Utility;Office;Sports;
StartupWMClass=BowlingLeagueHelper
"

printf '%s' "${DESKTOP_ENTRY}" > "${APPS_DIR}/bowling-league-helper.desktop"
chmod +x "${APPS_DIR}/bowling-league-helper.desktop"

if [ -d "${HOME}/Desktop" ]; then
  printf '%s' "${DESKTOP_ENTRY}" > "${HOME}/Desktop/Bowling League Helper.desktop"
  chmod +x "${HOME}/Desktop/Bowling League Helper.desktop"
fi

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "${APPS_DIR}" >/dev/null 2>&1 || true
fi

echo "Done! Installed to ${INSTALL_DIR}."
echo "You can now delete the downloaded archive and launch Bowling League Helper from your Desktop or Application Menu."
