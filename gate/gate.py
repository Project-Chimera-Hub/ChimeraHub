#!/usr/bin/env python3
"""The gate: a training quota the desktop enforces.

    python3 gate/gate.py            # run it
    python3 gate/gate.py --status   # what it would do right now, and why
    python3 gate/gate.py --check    # count today and exit, changing nothing

WHAT IT DOES
------------
Every couple of minutes it counts how long you trained today. Under the day's
quota it puts a panel in front of you with one button on it, and that button
opens the hub in Firefox. While you are training it gets out of the way; when
you stop it comes back. Meet the quota and it is gone until tomorrow.

WHY IT DOES NOT SHOW THE TRAINERS ITSELF
----------------------------------------
It used to. The panel was a WebKitGTK window with the hub loaded into it, and
that was wrong twice over.

The first is that WebKitGTK is not the browser the trainers are used in, and it
shows: `transform-style: preserve-3d` flattens, so RNB's cube renders as its
front face alone, and `speechSynthesis` reports no voices, so CCT — which is
audio only — has nothing to say.

The second is worse and is the reason this is a rewrite rather than a patch.
The counter reads Firefox's storage off disk. A WebKit window keeps its own,
in ~/.cache, where nothing here looks. So training done inside the gate's own
window was invisible to the gate's own counter, and the quota could never be
met from the window the gate put in front of you. It would have sat there
saying `0 of 20 min` for as long as you cared to train at it.

So the gate does not host anything. It interrupts, and it hands off to the
browser whose storage it reads. Those two have to be the same browser or the
loop does not close.

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
import re
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
Gdk = GLib = Gtk = None


def load_gtk():
    global Gdk, GLib, Gtk
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
    from gi.repository import Gdk as _Gdk, GLib as _GLib, Gtk as _Gtk
    Gdk, GLib, Gtk = _Gdk, _GLib, _Gtk

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CONFIG = os.path.expanduser("~/.config/mindbuild/gate.json")

# Must not contain any string in `training_window_patterns`. See `show`.
PANEL_TITLE = "Training required"

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
    # The browser the counter can actually see. Not xdg-open's default, unless
    # that default happens to be Firefox: opening Chrome here would train you
    # into a store `firefox-storage.py` never reads, which is the exact bug
    # this rewrite exists to remove.
    "browser": "firefox",
    # After the button is pressed, how long to stay away before expecting to
    # see anything. A browser has to start and a page has to load — and until
    # one of them has focus there is nothing for the focus check to find.
    #
    # Short, because with the focus check doing the real work this is no longer
    # a licence to do something else for two minutes: it only has to outlast a
    # window appearing.
    "grace_seconds": 60,
    # No sign of training for this long and the panel comes back. "Sign" is a
    # heartbeat from the hub or a rising disk count — see `training_live`.
    "stall_seconds": 180,
    # What a training window is called. The gate stands down only while one of
    # these has focus, so this is the list that decides what "blocking other
    # applications" means in practice.
    #
    # The hub puts "mindbuild" in every title it sets, framed trainer included,
    # which is why training through the hub is the path that works best. The
    # rest are the trainers' own titles, for a tab opened directly.
    "training_window_patterns": [
        "mindbuild",
        "Relational N-Back",
        "CCT",
        "Syllogimous",
        "Precision N-Back",
        "Spatial Rotation",
        "Attentional Shield",
        "Synth",
        "Training archive",
    ],
    # The same, for a machine where the heartbeat never arrives at all.
    #
    # Firefox may refuse an https:// page's POST to http://127.0.0.1 as mixed
    # content, and if it does there is no fast signal to be had — only the disk
    # scan, which lags a session by minutes because Firefox writes localStorage
    # lazily. Judging a stall on that timescale with a three-minute fuse would
    # put the panel back over a page being actively answered, so when no
    # heartbeat has ever been seen the fuse is much longer and the scan is the
    # only thing being watched.
    "stall_seconds_no_beat": 900,
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
# What has focus                                                               #
# --------------------------------------------------------------------------- #

def active_window_title():
    """The focused window's title and class, or None if it cannot be read.

    None is not "nothing is focused" — it is "this question could not be
    answered", and the two must not be confused. A gate that treats an
    unreadable display as "you are not training" would block a machine it
    cannot see, which is the failure mode that ends with someone holding down
    the power button.
    """
    try:
        root = subprocess.run(["xprop", "-root", "_NET_ACTIVE_WINDOW"],
                              capture_output=True, text=True, timeout=3).stdout
        match = re.search(r"0x[0-9a-f]+", root)
        if not match or int(match.group(0), 16) == 0:
            return None
        info = subprocess.run(["xprop", "-id", match.group(0), "_NET_WM_NAME", "WM_CLASS"],
                              capture_output=True, text=True, timeout=3).stdout
        return info or None
    except Exception:                               # noqa: BLE001
        return None


def focused_on_training(cfg):
    """True, False, or None when the display cannot be read.

    This is the signal that makes the gate a gate. The heartbeat says a page
    exists somewhere; the disk says something was trained at some point. Only
    this says what you are doing *now*, which is the only question a thing
    claiming to block other applications is actually asking.
    """
    title = active_window_title()
    if title is None:
        return None
    patterns = cfg.get("training_window_patterns") or []
    low = title.lower()
    return any(str(p).lower() in low for p in patterns)


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
        # When the hub last said anything. Not a measure of training — a
        # measure of a page being open and posting, which is the only
        # fast-moving signal there is while the disk lags behind.
        self.last_beat = 0.0
        # When the figure on disk last went up. Slow, and the only liveness
        # signal that survives a browser which will not let the page post.
        self.last_progress = 0.0
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
            # Stamped even when the figure has not moved: a page posting the
            # same number every thirty seconds is still a page that is open,
            # and between two blocks the total genuinely does not change.
            self.last_beat = time.time()
            if minutes > self.beat:
                self.beat = float(minutes)

    def roll_day(self):
        today = utc_day()
        with self._lock:
            if today != self.day:
                self.day, self.disk, self.beat = today, 0.0, 0.0
            self.by_source, self.raw, self.capped = {}, {}, []
            # `last_beat` deliberately survives: midnight passing is not a
            # reason to conclude that the session in front of you stopped.

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
                fresh = float(data.get("minutes") or 0)
                # Strictly greater: a scan that merely confirms the same total
                # is evidence of nothing, and treating it as progress would
                # mean the panel never came back.
                if fresh > self.disk + 1e-9:
                    self.last_progress = time.time()
                self.disk = fresh
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
    """The panel, and the decision about whether it is up.

    It draws no web content and never will. See the module docstring: the
    browser it hands off to has to be the one whose storage the counter reads.
    """

    def __init__(self, cfg, counter):
        self.cfg = cfg
        self.counter = counter
        self.window = None
        self.label = None
        self.seat = None
        self.shown_at = 0.0
        self.launched_at = 0.0

    # -- lifecycle -------------------------------------------------------- #

    def show(self):
        if self.window:
            self.refresh()
            return
        self.shown_at = time.time()

        # Deliberately not "mindbuild". The panel's own title is matched against
        # `training_window_patterns` like any other window, and a gate named
        # after the thing it is gating would read its own window as a trainer,
        # hide, immediately see no trainer, and show again — forever.
        win = Gtk.Window(title=PANEL_TITLE)
        win.set_decorated(False)
        win.set_keep_above(True)
        win.set_position(Gtk.WindowPosition.CENTER_ALWAYS)
        # Closing it is not a way out; the gate decides when it goes.
        win.connect("delete-event", lambda *_: True)

        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=14)
        box.set_margin_top(28); box.set_margin_bottom(28)
        box.set_margin_start(36); box.set_margin_end(36)

        self.label = Gtk.Label()
        self.label.set_justify(Gtk.Justification.CENTER)
        box.pack_start(self.label, False, False, 0)

        button = Gtk.Button(label="Train")
        button.connect("clicked", lambda *_: self.launch())
        box.pack_start(button, False, False, 0)

        hint = Gtk.Label()
        hint.set_markup(
            '<small>Opens the hub in {}. This panel steps aside while you train.\n'
            'Ctrl-Alt-F3 \u2192 systemctl --user stop mindbuild-gate</small>'
            .format(GLib.markup_escape_text(str(self.cfg.get("browser") or "your browser"))))
        hint.set_justify(Gtk.Justification.CENTER)
        box.pack_start(hint, False, False, 0)

        win.add(box)

        # Fullscreen only in grab mode; a nagging panel that covers the screen
        # while refusing to host anything would just be in the way.
        if self.cfg.get("mode") == "grab":
            win.fullscreen()

        win.show_all()
        self.window = win
        self.refresh()

        if self.cfg.get("mode") == "grab":
            self._grab()

        print("gate: up — %.0f of %s min" %
              (self.counter.minutes, self.cfg["required_minutes"]), flush=True)

    def refresh(self):
        """Keep the figure on the panel current while it sits there."""
        if not self.label:
            return
        have, need = self.counter.minutes, float(self.cfg["required_minutes"])
        text = "<big><b>%.0f of %.0f minutes</b></big>" % (have, need)
        if self.counter.capped:
            text += "\n<small>capped: %s</small>" % GLib.markup_escape_text(
                ", ".join(self.counter.capped))
        self.label.set_markup(text)

    def hide(self, why):
        if not self.window:
            return
        self._ungrab()
        self.window.destroy()
        self.window = None
        self.label = None
        print("gate: down — %s" % why, flush=True)

    # -- the hand-off ----------------------------------------------------- #

    def launch(self):
        """Open the hub in the browser the counter reads, then step aside.

        The grab has to go first. A gate still holding the keyboard hands the
        browser a window nobody can type into, which on a page whose whole
        purpose is answering questions is the same as not opening it at all.
        """
        self._ungrab()
        browser = str(self.cfg.get("browser") or "firefox")
        url = str(self.cfg.get("hub_url") or "")
        try:
            subprocess.Popen([browser, url],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except (OSError, ValueError) as e:
            # Never leave the panel up with a dead button: say so on the panel
            # rather than in a log nobody has open.
            print("gate: could not start %s (%s)" % (browser, e), file=sys.stderr, flush=True)
            if self.label:
                self.label.set_markup(
                    "<b>Could not start %s.</b>\n<small>Set \"browser\" in %s</small>"
                    % (GLib.markup_escape_text(browser), GLib.markup_escape_text(CONFIG)))
            return
        self.launched_at = time.time()
        self.hide("handed off to %s" % browser)

    # -- the grab --------------------------------------------------------- #

    def _grab(self):
        """Keyboard and pointer, so Alt-Tab and the Super key stop working.

        X11 only, and checked rather than assumed: on Wayland the grab silently
        does nothing and the gate would claim a hold it does not have. A failed
        grab is reported and the panel stays up as a nag, which is the honest
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

    def training_live(self):
        """Is training happening right now?

        Three signals, and they are not equals.

        **Focus** is what makes this a gate. It is the only one that describes
        the present tense: a trainer window is in front of you, or something
        else is. Everything below it can only say that training happened
        recently, and "recently" is exactly the loophole — a grace period long
        enough not to interrupt a real session is long enough to read your
        email in.

        **The heartbeat** says the hub is open and posting. It exists because
        Firefox writes localStorage lazily, so the disk can be minutes behind a
        session in progress, and a panel that reappears over a page you are
        answering is one that gets uninstalled the same afternoon.

        **The disk figure rising** is the slowest and the only one that
        survives a browser which will not let the page post at all.

        The last two are the fallback for a display that cannot be read. They
        are not the normal path.
        """
        now = time.time()
        if self.launched_at and now - self.launched_at < float(self.cfg.get("grace_seconds") or 0):
            return True

        # What is on screen beats everything else, in both directions. On a
        # trainer: training, whatever the lagging disk thinks. On something
        # else: not training, however recently you were — which is the whole of
        # blocking other applications, and the part no grace period can express.
        focus = focused_on_training(self.cfg)
        if focus is True:
            return True
        if focus is False:
            return False

        # The display could not be read. Fall back to the slower evidence
        # rather than blocking a machine the gate cannot see.
        beat = self.counter.last_beat
        if beat and now - beat < float(self.cfg.get("stall_seconds") or 0):
            return True

        # No heartbeat has ever arrived, so this machine has no fast signal and
        # the disk scan is all there is. Judge it on the scan's own timescale.
        fuse = float(self.cfg.get("stall_seconds") or 0) if beat \
            else float(self.cfg.get("stall_seconds_no_beat") or 0)
        progress = self.counter.last_progress
        return bool(progress and now - progress < fuse)

    def evaluate(self):
        """Called on a timer. The only place the panel is raised or dropped."""
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
        if self.training_live():
            self.hide("training in progress")
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
        "lastBeatAgo": round(time.time() - counter.last_beat) if counter.last_beat else None,
        "lastProgressAgo": round(time.time() - counter.last_progress) if counter.last_progress else None,
        "heartbeatEverSeen": bool(counter.last_beat),
        "focusedOnTraining": focused_on_training(cfg),
        "activeWindow": (active_window_title() or "").strip()[:200] or None,
        "trainingLive": gate.training_live() if gate else None,
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
            # While the panel is down the assumption is that training is
            # happening, and that is exactly when the figure needs to be
            # current — both to notice the quota being met and, on a machine
            # with no heartbeat, to notice that it is still moving at all.
            quick = gate.window is None and counter.minutes < float(cfg["required_minutes"])
            time.sleep(60 if quick else max(30, int(cfg["scan_every_seconds"])))

    threading.Thread(target=scan_loop, daemon=True).start()
    server = make_server(cfg, counter, gate)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    print("gate: listening on 127.0.0.1:%s, mode=%s, quota=%s min"
          % (cfg["port"], cfg["mode"], cfg["required_minutes"]), flush=True)

    GLib.timeout_add_seconds(5, gate.evaluate)
    # The panel shows a number that the scan thread keeps changing underneath
    # it; without this it would show whatever was true when it opened.
    GLib.timeout_add_seconds(5, lambda: (gate.refresh(), True)[1])
    try:
        Gtk.main()
    finally:
        # Whatever brought the loop down — Ctrl-C, a systemd stop, an exception
        # — the input devices go back.
        gate._ungrab()


if __name__ == "__main__":
    main()
