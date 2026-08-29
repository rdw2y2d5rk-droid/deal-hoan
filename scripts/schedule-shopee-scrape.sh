#!/usr/bin/env bash
# Cài hoặc gỡ lịch tự động chạy lại shopee:scrape (macOS launchd).
#
#   ./scripts/schedule-shopee-scrape.sh install    — cài, chạy mỗi 6 tiếng
#   ./scripts/schedule-shopee-scrape.sh uninstall  — gỡ bỏ hoàn toàn
#   ./scripts/schedule-shopee-scrape.sh status     — xem đang chạy hay không
#   ./scripts/schedule-shopee-scrape.sh logs       — xem log lần chạy gần nhất
set -euo pipefail

LABEL="com.dealhoan.shopee-scrape"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PLIST_DST="${HOME}/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="${HOME}/Library/Logs/dealhoan"
# Chạy lại mỗi 6 tiếng. Tăng số này nếu muốn giảm rủi ro bị Shopee phát hiện.
INTERVAL_SECONDS=21600

case "${1:-}" in
  install)
    NODE_BIN="$(command -v node || true)"
    if [[ -z "${NODE_BIN}" ]]; then
      echo "❌ Không tìm thấy 'node' trong PATH hiện tại. Chạy lệnh này trong shell nơi 'node --version' hoạt động."
      exit 1
    fi

    mkdir -p "${HOME}/Library/LaunchAgents" "${LOG_DIR}"

    cat > "${PLIST_DST}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_BIN}</string>
    <string>${PROJECT_DIR}/scripts/shopee-scrape.mjs</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${PROJECT_DIR}</string>
  <key>StartInterval</key>
  <integer>${INTERVAL_SECONDS}</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/shopee-scrape.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/shopee-scrape.err.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$(dirname "${NODE_BIN}"):/usr/local/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>
PLIST

    launchctl unload "${PLIST_DST}" 2>/dev/null || true
    launchctl load "${PLIST_DST}"
    echo "✅ Đã cài lịch tự động (mỗi $((INTERVAL_SECONDS / 3600)) tiếng), và chạy ngay 1 lần bây giờ."
    echo "   Node dùng: ${NODE_BIN}"
    echo "   Log: ${LOG_DIR}/shopee-scrape.log"
    echo "   Lưu ý: cần đã có phiên đăng nhập hợp lệ (.secrets/shopee-session.json)"
    echo "   — nếu chưa, chạy: npm run shopee:login:attach"
    ;;
  uninstall)
    launchctl unload "${PLIST_DST}" 2>/dev/null || true
    rm -f "${PLIST_DST}"
    echo "✅ Đã gỡ lịch tự động."
    ;;
  status)
    launchctl list | grep "${LABEL}" || echo "Chưa cài lịch tự động (chạy: $0 install)."
    ;;
  logs)
    tail -n 50 "${LOG_DIR}/shopee-scrape.log" 2>/dev/null || echo "Chưa có log nào."
    echo "--- lỗi (nếu có) ---"
    tail -n 50 "${LOG_DIR}/shopee-scrape.err.log" 2>/dev/null || true
    ;;
  *)
    echo "Dùng: $0 {install|uninstall|status|logs}"
    exit 1
    ;;
esac
