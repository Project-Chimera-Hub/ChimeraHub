#!/usr/bin/env bash
#
# Installs the gate. Deliberately does not start it.
#
# The last line of this script prints the two commands that arm it, rather than
# running them, because everything above this point is reversible and those two
# are the ones that put a window over your screen. Read gate/README.md first —
# in particular the part about Ctrl-Alt-F3, which is how you get out.

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
config_dir="${XDG_CONFIG_HOME:-$HOME/.config}/mindbuild"
units_dir="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

if [ "$(id -u)" = 0 ]; then
  echo "Do not install the gate as root. It is a user session's window." >&2
  exit 1
fi

for cmd in python3 node; do
  command -v "$cmd" >/dev/null || { echo "missing: $cmd" >&2; exit 1; }
done

python3 - <<'PY' || { echo "missing: python3-gi with GTK 3" >&2
import gi
gi.require_version("Gdk", "3.0"); gi.require_version("Gtk", "3.0")
from gi.repository import Gtk  # noqa
PY
  echo "  sudo apt install python3-gi gir1.2-gtk-3.0" >&2
  exit 1
}

# The gate hands off to a browser and counts what that browser wrote. If those
# are not the same browser the quota can never be met, so it is checked here
# rather than discovered after twenty minutes of uncounted training.
if ! command -v firefox >/dev/null; then
  echo "warning: firefox not found. The counter reads Firefox's storage and" >&2
  echo "         nothing else; point \"browser\" only at something" >&2
  echo "         firefox-storage.py can also read." >&2
fi

mkdir -p "$config_dir" "$units_dir"

# Never overwritten. The quota is the one setting here anybody tunes, and a
# reinstall that silently resets it to the default would be its own small
# betrayal.
if [ ! -f "$config_dir/gate.json" ]; then
  cat > "$config_dir/gate.json" <<'JSON'
{
  "required_minutes": 20,
  "hub_url": "https://gagafutzi.github.io/mindbuild/",
  "armed": true,
  "mode": "nag",
  "active_from": "09:00",
  "active_to": "23:00",
  "max_hold_minutes": 180,
  "scan_every_seconds": 120,
  "port": 8787,
  "browser": "firefox",
  "grace_seconds": 120,
  "stall_seconds": 180,
  "caps": { "synth": 0.05, "cct": 0.20 }
}
JSON
  echo "wrote $config_dir/gate.json"
else
  echo "kept   $config_dir/gate.json (already there)"
fi

sed "s|%h|$HOME|g" "$here/mindbuild-gate.service" > "$units_dir/mindbuild-gate.service"
echo "wrote  $units_dir/mindbuild-gate.service"
systemctl --user daemon-reload

cat <<MSG

Installed, not running. Check the count first — this touches nothing:

    python3 $here/gate.py --check

When the number looks right, arm it:

    systemctl --user enable --now mindbuild-gate

And to stop it, from a terminal or from Ctrl-Alt-F3 if the window is up:

    systemctl --user stop mindbuild-gate
MSG
