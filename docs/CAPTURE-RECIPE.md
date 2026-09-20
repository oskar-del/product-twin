# Screenshot capture recipe (works while Oskar's Chrome is open) — 2026-09-20

Headless Chrome DOES write the PNG; it then hangs on exit. Wait for the file, then kill it.

RULES: (1) `pgrep -fl headless=new` FIRST — strays fight over the profile singleton and write about:blank;
kill them (`pkill -f headless=new`) before capturing. (2) A FRESH --user-data-dir per run (mktemp -d).
(3) Kill the PID you started, always, even on success.

    CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    "$CH" --headless=new --disable-gpu --hide-scrollbars --no-first-run \
      --user-data-dir=/tmp/chrome-profile-$$ --window-size=1600,4400 --virtual-time-budget=10000 \
      --screenshot="$OUT" "$URL" >/dev/null 2>&1 &
    PID=$!; for i in $(seq 1 40); do [ -s "$OUT" ] && break; sleep 1; done; sleep 2; kill $PID

Serve the repo first: `cd "product twin" && python3 -m http.server 8765`. WebGL canvases render via
SwiftShader (prove the page, not GPU parity). The in-app preview pane collapses to 0×0 when hidden —
its screenshots go black mid-page; that is the pane, not the page.
