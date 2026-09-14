#!/usr/bin/env python3
"""The gate: a training quota the desktop enforces.

    python3 gate/gate.py            # run it
    python3 gate/gate.py --status   # what it would do right now, and why
    python3 gate/gate.py --check    # count today and exit, changing nothing

WHAT IT DOES
------------
Every couple of minutes it counts how long you trained today, and if that is
under the day's quota it puts a window over the screen with the trainers in it.
Meet the quota and the window goes away and stays away until tomorrow.

WHERE THE NUMBER COMES FROM
---------------------------
Not from the page. A rule enforced by the thing it is a rule about is not a
rule, and the page is a page — its localStorage can be edited by anyone who can
open a console, which is you, at the exact moment you least want the gate to
hold. So the count comes off disk, out of Firefox's own SQLite, through the
archive's adapters, by way of `firefox-storage.py` and `gate/count.js`. The
browser is not asked and does not have to cooperate.

The page's heartbeat is still accepted, and only ever to raise the number. Disk
writes lag by a minute or two, and a gate that says "you have not trained" at
someone who just trained for twenty minutes is a gate that gets uninstalled.

The archive is never counted. Sorting the record is not training and must not
be a way to buy a session back.

WHAT IT DELIBERATELY IS NOT
---------------------------
It is not a lock on your account. Nothing here touches PAM, the greeter, or any
part of logging in, because the failure mode of getting that wrong is a machine
you cannot get into and a live USB to fix it. This is a window, over a session
you are already logged into.

So it is bypassable, on purpose, and by more than one route:

  * Ctrl-Alt-F3, then `systemctl --user stop mindbuild-gate`. Virtual terminal
    switching is handled below X and no grab can take it. This always works.
  * `--mode nag` — the default — does not grab input at all. Alt-Tab past it.
  * `max_hold_minutes` releases the gate regardless of the count, so a bug in
    the counting cannot cost you a day.

It works by making the lazy path slightly more effort than the training. That is
all a commitment device has ever done, and a version of this that really could
not be escaped would be a worse thing to own.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# GTK is imported only when a window is actually going to be drawn. `--check`
# and `--status` are the two things you want to run over SSH, from a cron job,
# or on a machine with no display at all, and importing GTK would make all three
# fail for no reason.
Gdk = GLib = Gtk = WebKit2 = None


def load_gtk():
    global Gdk, GLib, Gtk, WebKit2
    if Gtk is not None:
        return
    import gi
    # Every namespace pinned before the first import. Ubuntu 22.04 has GTK 3
    # and GTK 4 side by side, and leaving Gdk unpinned gets whichever one
    # something else loaded first — which is GTK 4, and then the GTK 3 pin on
    # Gtk itself fails at import with a message about a version nobody asked
    # for.
    gi.require_version("Gdk", "3.0")
    gi.require_version("Gtk", "3.0")
    gi.require_version("WebKit2", "4.0")
    from gi.repository import Gdk as _Gdk, GLib as _GLib, Gtk as _Gtk, WebKit2 as _WK
    Gdk, GLib, Gtk, WebKit2 = _Gdk, _GLib, _Gtk, _WK

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CONFIG = os.path.expanduser("~/.config/mindbuild/gate.json")

DEFAULTS = {
    # Minutes of training the day needs. Keep it to something you would have
    # done anyway; a quota you resent is a quota you disable.
    "required_minutes": 20,
    "hub_url": "https://gagafutzi.github.io/mindbuild/",
    "armed": True,
    # "nag"  — fullscreen and always on top, but Alt-Tab still works.
    # "grab" — takes keyboard and pointer. Only Ctrl-Alt-F3 gets past it.
    #          Run in nag for a week before trying this.
    "mode": "nag",
    # Outside these hours the gate never appears, whatever the count. The point
    # is to shape a day, not to ambush you at 03:00 chasing a deadline.
    "active_from": "09:00",
    "active_to": "23:00",
    # The gate lets go after this long no matter what the count says. This is
    # the guard against the gate's own bugs and it has no override.
    "max_hold_minutes": 180,
    "scan_every_seconds": 120,
    "port": 8787,
    # Per-source ceilings, as a share of the counted day. Synth is too easy to
    # be training and CCT was never meant to be the bulk of it, so neither can
    # satisfy a quota alone however long you spend — see shared/quota.js for
    # what that means arithmetically. `{}` removes every cap.
    "caps": {"synth": 0.05, "cct": 0.20},
}


def load_config():
    cfg = dict(DEFAULTS)
    try:
        with open(CONFIG) as fh:
            cfg.update(json.load(fh))
    except FileNotFoundError:
        pass
    except (OSError, ValueError) as e:
        # A broken config must not arm a lock with values nobody chose.
        print("gate: %s is unreadable (%s) — using defaults, disarmed" % (CONFIG, e),
              file=sys.stderr)
        cfg["armed"] = False
    return cfg


def utc_day():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def within_active_hours(cfg, now=None):
    """Local time, unlike the count.

    The day the quota is measured over is UTC because the record is UTC, but
    the hours you are willing to be interrupted are the hours on your own
    clock. These two are different questions and answering them with one
    timezone would get one of them wrong.
    """
    now = now or datetime.now()
    try:
        start = datetime.strptime(cfg["active_from"], "%H:%M").time()
        end = datetime.strptime(cfg["active_to"], "%H:%M").time()
    except ValueError:
        return True
    t = now.time()
    if start <= end:
        return start <= t <= end
    return t >= start or t <= end          # a window that crosses midnight


# --------------------------------------------------------------------------- #
# Counting                                                                     #
# --------------------------------------------------------------------------- #

class Counter:
    """Today's minutes, from disk, with the page's heartbeat as a floor."""

    def __init__(self, cfg):
        self.cfg = cfg
        self.day = utc_day()
        self.disk = 0.0
        self.beat = 0.0
        self.by_source = {}
        self.raw = {}
        self.capped = []
        self.last_scan = 0.0
        self.error = None
        self._lock = threading.Lock()

    @property
    def minutes(self):
        with self._lock:
            return max(self.disk, self.beat)

    def heartbeat(self, day, minutes):
        """Raise the count, never lower it.

        The page is not trusted to say a number is smaller — that direction is
        what an attacker (you, at 23:50) would want — and it does not need to
        be: the next disk scan is the authority and will correct any inflation
        within a couple of minutes, because the scan replaces `disk` outright.
        The heartbeat only ever buys those two minutes.
        """
        with self._lock:
            if day != self.day:
                return
            if minutes > self.beat:
                self.beat = float(minutes)

    def roll_day(self):
        today = utc_day()
        with self._lock:
            if today != self.day:
                self.day, self.disk, self.beat = today, 0.0, 0.0
            self.by_source, self.raw, self.capped = {}, {}, []

    def scan(self, roll=True):
        """firefox-storage.py into a temp dir, count.js over the result."""
        if roll:
            self.roll_day()
        tmp = tempfile.mkdtemp(prefix="mindbuild-gate-")
        try:
            subprocess.run(
                [sys.executable,
                 os.path.join(ROOT, "apps", "archive", "tools", "firefox-storage.py"),
                 "--outdir", tmp],
                check=True, capture_output=True, timeout=120)
            out = subprocess.run(
                ["node", os.path.join(HERE, "count.js"), tmp, self.day,
                 json.dumps(self.cfg.get("caps") or {})],
                check=True, capture_output=True, timeout=60, text=True)
            data = json.loads(out.stdout)
        except Exception as e:                      # noqa: BLE001
            # A scan that fails must not lock the machine on a count of zero.
            # The last good number stands and the failure is reported.
            with self._lock:
                self.error = str(e)[:200]
            return
        else:
            with self._lock:
                self.disk = float(data.get("minutes") or 0)
                self.by_source = data.get("bySource") or {}
                self.raw = data.get("raw") or {}
                self.capped = data.get("capped") or []
                self.beat = 0.0     # the scan is now the authority
                self.error = None
        finally:
            self.last_scan = time.time()
            shutil.rmtree(tmp, ignore_errors=True)


# --------------------------------------------------------------------------- #
# The window                                                                   #
# --------------------------------------------------------------------------- #

class Gate:
    def __init__(self, cfg, counter):
        self.cfg = cfg
        self.counter = counter
        self.window = None
        self.seat = None
        self.shown_at = 0.0

    # -- lifecycle -------------------------------------------------------- #

    def show(self):
        if self.window:
            return
        self.shown_at = time.time()

        win = Gtk.Window(title="mindbuild")
        win.set_decorated(False)
        win.set_keep_above(True)
        win.fullscreen()
        # Closing it is not a way out; the gate decides when it goes.
        win.connect("delete-event", lambda *_: True)

        view = WebKit2.WebView()
        view.load_uri(self.cfg["hub_url"])
        win.add(view)

        win.show_all()
        self.window = win

        if self.cfg.get("mode") == "grab":
            self._grab()

        print("gate: closed — %.0f of %s min" %
              (self.counter.minutes, self.cfg["required_minutes"]), flush=True)

    def hide(self, why):
        if not self.window:
            return
        self._ungrab()
        self.window.destroy()
        self.window = None
        print("gate: open — %s" % why, flush=True)

    # -- the grab --------------------------------------------------------- #

    def _grab(self):
        """Keyboard and pointer, so Alt-Tab and the Super key stop working.

        X11 only, and checked rather than assumed: on Wayland the grab silently
        does nothing and the gate would claim a hold it does not have. A failed
        grab is reported and the window stays up as a nag, which is the honest
        degradation.
        """
        try:
            display = Gdk.Display.get_default()
            if "x11" not in type(display).__name__.lower() and \
               os.environ.get("XDG_SESSION_TYPE") != "x11":
                print("gate: not X11 — grab unavailable, holding as a nag",
                      file=sys.stderr, flush=True)
                return
            seat = display.get_default_seat()
            status = seat.grab(self.window.get_window(),
                               Gdk.SeatCapabilities.ALL, True, None, None, None, None)
            if status == Gdk.GrabStatus.SUCCESS:
                self.seat = seat
            else:
                print("gate: grab refused (%s) — holding as a nag" % status,
                      file=sys.stderr, flush=True)
        except Exception as e:                      # noqa: BLE001
            print("gate: grab failed (%s) — holding as a nag" % e,
                  file=sys.stderr, flush=True)

    def _ungrab(self):
        # Unconditionally, and before anything else that might raise: a grab
        # that outlives its window is a desktop that takes no input at all.
        if self.seat:
            try:
                self.seat.ungrab()
            except Exception:                       # noqa: BLE001
                pass
            self.seat = None

    # -- the decision ----------------------------------------------------- #

    def held_too_long(self):
        cap = float(self.cfg.get("max_hold_minutes") or 0)
        return bool(self.window and cap > 0 and
                    (time.time() - self.shown_at) / 60 >= cap)

    def evaluate(self):
        """Called on a timer. The only place the window is opened or closed."""
        self.counter.roll_day()
        need = float(self.cfg["required_minutes"])
        have = self.counter.minutes

        if self.held_too_long():
            self.hide("held %s min, the cap" % self.cfg["max_hold_minutes"])
            return True
        if not self.cfg.get("armed"):
            self.hide("disarmed")
            return True
        if have >= need:
            self.hide("%.0f of %.0f min done" % (have, need))
            return True
        if not within_active_hours(self.cfg):
            self.hide("outside active hours")
            return True

        self.show()
        return True


# --------------------------------------------------------------------------- #
# The heartbeat endpoint                                                       #
# --------------------------------------------------------------------------- #

def make_server(cfg, counter, gate):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass                                    # not a web server; stay quiet

        def _cors(self):
            # The hub is served from GitHub Pages and this is localhost, so every
            # request from it is cross-origin. Nothing here is secret and nothing
            # here is destructive — the worst a hostile page could do is briefly
            # inflate a number the next scan overwrites.
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")

        def _json(self, payload, code=200):
            body = json.dumps(payload).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self._cors()
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self):                       # noqa: N802
            self.send_response(204)
            self._cors()
            self.end_headers()

        def do_GET(self):                           # noqa: N802
            self._json(state(cfg, counter, gate))

        def do_POST(self):                          # noqa: N802
            try:
                n = int(self.headers.get("Content-Length") or 0)
                data = json.loads(self.rfile.read(n) or b"{}")
                counter.heartbeat(str(data.get("day") or ""),
                                  float(data.get("minutes") or 0))
            except Exception:                       # noqa: BLE001
                pass
            self._json(state(cfg, counter, gate))

    # 127.0.0.1, never 0.0.0.0: this listens on a laptop that joins other
    # people's networks.
    return ThreadingHTTPServer(("127.0.0.1", int(cfg["port"])), Handler)


def state(cfg, counter, gate):
    return {
        "armed": bool(cfg.get("armed")),
        "mode": cfg.get("mode"),
        "day": counter.day,
        "required": cfg["required_minutes"],
        "minutes": round(counter.minutes, 1),
        "bySource": counter.by_source,
        "raw": counter.raw,
        "capped": counter.capped,
        "caps": cfg.get("caps") or {},
        "closed": bool(gate.window) if gate else False,
        "activeHours": "%s–%s" % (cfg["active_from"], cfg["active_to"]),
        "withinActiveHours": within_active_hours(cfg),
        "lastScanAgo": round(time.time() - counter.last_scan) if counter.last_scan else None,
        "error": counter.error,
    }


# --------------------------------------------------------------------------- #

def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--status", action="store_true",
                    help="print what the gate would do right now and exit")
    ap.add_argument("--check", action="store_true",
                    help="count today and exit, without ever showing a window")
    ap.add_argument("--day", metavar="YYYY-MM-DD",
                    help="count this day instead of today (with --check/--status)")
    args = ap.parse_args()

    if os.geteuid() == 0:
        sys.exit("gate: refusing to run as root — this is a user session's window")

    cfg = load_config()
    counter = Counter(cfg)

    if args.status or args.check:
        if args.day:
            counter.day = args.day
        counter.scan(roll=not args.day)
        print(json.dumps(state(cfg, counter, None), indent=2))
        return

    load_gtk()
    gate = Gate(cfg, counter)

    # The scan shells out to two processes and takes seconds; on the GTK thread
    # that would freeze the very window it is deciding about.
    def scan_loop():
        while True:
            counter.scan()
            time.sleep(max(30, int(cfg["scan_every_seconds"])))

    threading.Thread(target=scan_loop, daemon=True).start()

    server = make_server(cfg, counter, gate)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    print("gate: listening on 127.0.0.1:%s, mode=%s, quota=%s min"
          % (cfg["port"], cfg["mode"], cfg["required_minutes"]), flush=True)

    GLib.timeout_add_seconds(5, gate.evaluate)
    try:
        Gtk.main()
    finally:
        # Whatever brought the loop down — Ctrl-C, a systemd stop, an exception
        # — the input devices go back.
        gate._ungrab()


if __name__ == "__main__":
    main()
