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
from urllib.parse import urlparse

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
    "grace_seconds": 15,
    # The first moments of grace, when focus is still falling back to whatever
    # had it before the panel and has not reached the browser yet. Anything is
    # excused here; after it, only a browser window that is still loading is.
    "settle_seconds": 3,
    # No sign of training for this long and the panel comes back. "Sign" is a
    # heartbeat from the hub or a rising disk count — see `training_live`.
    "stall_seconds": 180,
    # What a training window is. Both must hold: the title contains one of the
    # patterns, and the window belongs to `training_window_class`.
    #
    # Only "mindbuild", because the hub puts it in every title it sets — framed
    # trainer and archive included. The trainers' own titles used to be here
    # too, and "CCT" or "Synth" are substrings of half the internet: a YouTube
    # tab called "Synthwave mix" was a training window. The class check is the
    # other half of the same fix — a page titled "mindbuild" in some other
    # browser trains into storage the counter never reads.
    "training_window_patterns": ["mindbuild"],
    "training_window_class": "firefox",
    # How often the gate looks at what is in front of you. Leaving the trainer
    # is visible for at most this long before the panel is back.
    "check_every_ms": 500,
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

def session_kind():
    """"x11", "wayland", or "unknown"."""
    kind = (os.environ.get("XDG_SESSION_TYPE") or "").lower()
    if kind in ("x11", "wayland"):
        return kind
    if os.environ.get("WAYLAND_DISPLAY"):
        return "wayland"
    if os.environ.get("DISPLAY"):
        return "x11"
    return "unknown"


def capabilities():
    """What this session actually permits, as opposed to what is configured.

    On GNOME under Wayland the answer is: not much, and not by accident. A
    normal application cannot take a global input grab and cannot ask what has
    focus — both are things a keylogger would want, and the compositor does not
    distinguish a keylogger from a training gate. `_NET_ACTIVE_WINDOW` reads
    0x0 because GTK is talking to Wayland directly and XWayland's root window
    has no window manager behind it, and GNOME Shell's own Introspect API
    answers `GetWindows is not allowed`.

    So on Wayland this program can put a window on the screen and nothing more.
    It says so at startup rather than presenting itself as a gate and quietly
    being a suggestion.
    """
    kind = session_kind()
    can_grab = kind == "x11"
    can_read_focus = active_window_title() is not None
    return {"session": kind, "canGrab": can_grab, "canReadFocus": can_read_focus}


def report_capabilities(cfg):
    caps = capabilities()
    if caps["canGrab"] and caps["canReadFocus"]:
        return caps
    print("gate: this is a %s session." % caps["session"], file=sys.stderr, flush=True)
    if not caps["canReadFocus"]:
        print("gate:   cannot see which window has focus, so it cannot tell "
              "training from anything else you do.", file=sys.stderr, flush=True)
    if not caps["canGrab"] and cfg.get("mode") == "grab":
        print("gate:   cannot grab input, so mode=grab behaves as mode=nag.",
              file=sys.stderr, flush=True)
    print("gate:   log in via 'Ubuntu on Xorg' at the login screen for a gate "
          "that actually blocks.", file=sys.stderr, flush=True)
    return caps


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


def window_info():
    """(title, class) of the focused window, or None if it cannot be read."""
    raw = active_window_title()
    if raw is None:
        return None
    name = cls = ""
    for line in raw.splitlines():
        if line.startswith("_NET_WM_NAME"):
            name = line.split("=", 1)[-1].strip()
            if len(name) >= 2 and name[0] == name[-1] == '"':
                name = name[1:-1]
        elif line.startswith("WM_CLASS"):
            cls = line.split("=", 1)[-1].strip()
    return name, cls


def hub_host(cfg):
    return (urlparse(str(cfg.get("hub_url") or "")).hostname or "").lower()


def classify_focus(cfg, info):
    """True, False, or None when the display cannot be read."""
    if info is None:
        return None
    name, cls = info
    want = str(cfg.get("training_window_class") or "").lower()
    if want and want not in cls.lower():
        return False
    low = name.lower()
    return any(str(p).lower() in low for p in (cfg.get("training_window_patterns") or []))


def focused_on_training(cfg):
    """True, False, or None when the display cannot be read.

    This is the signal that makes the gate a gate. The heartbeat says a page
    exists somewhere; the disk says something was trained at some point. Only
    this says what you are doing *now*, which is the only question a thing
    claiming to block other applications is actually asking.
    """
    return classify_focus(cfg, window_info())


def is_handoff_placeholder(cfg, info):
    """Is this the browser still arriving, rather than somewhere else?

    Grace used to excuse whatever had focus, which made Train the way out:
    press it, switch to anything, and the panel stayed away for the whole
    grace period, as often as you liked. Now it excuses only what a hand-off
    actually looks like — the panel's own window, or a browser window that has
    not finished loading the hub.
    """
    if info is None:
        return True
    name, cls = info
    if not name or name == PANEL_TITLE:
        return True
    want = str(cfg.get("training_window_class") or "").lower()
    if want and want not in cls.lower():
        return False
    low = name.lower()
    host = hub_host(cfg)
    return low in ("mozilla firefox", "new tab — mozilla firefox", "new tab - mozilla firefox") \
        or bool(host and host in low)


def activate_hub_window(cfg):
    """Put the hub's window in front, if one exists.

    GNOME's focus-stealing prevention will often not hand focus to a window
    that another process opened, and leaves it behind a notification instead.
    Without this the hub would open behind the panel, never be focused, and the
    gate would sit over the only application it is willing to let you use.
    """
    try:
        out = subprocess.run(["wmctrl", "-lx"], capture_output=True, text=True, timeout=2).stdout
    except Exception:                               # noqa: BLE001
        return False
    want = str(cfg.get("training_window_class") or "").lower()
    patterns = [str(p).lower() for p in (cfg.get("training_window_patterns") or [])]
    host = hub_host(cfg)
    best = None
    for line in out.splitlines():
        parts = line.split(None, 4)
        if len(parts) < 4:
            continue
        wid, cls = parts[0], parts[2].lower()
        title = (parts[4] if len(parts) > 4 else "").lower()
        if want and want not in cls:
            continue
        if any(p in title for p in patterns) or (host and host in title) or title == "mozilla firefox":
            best = wid                              # wmctrl lists oldest first
    if not best:
        return False
    try:
        subprocess.run(["wmctrl", "-i", "-a", best], capture_output=True, timeout=2)
    except Exception:                               # noqa: BLE001
        return False
    return True


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
        # The lock, as distinct from the panel. The panel comes and goes as you
        # move between the trainer and everything else; the lock lasts from the
        # first moment you owe minutes until you no longer do. The hold cap is
        # measured against this, not against the panel — measured against the
        # panel it restarted every time you went back to training and so never
        # once fired.
        self.lock_day = None
        self.locked_since = 0.0
        self.released = False
        # Set at startup from `capabilities()`. Shown on the panel, because a
        # gate that cannot block should not look like one that can.
        self.degraded = False

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

        self.window = win
        if self.cfg.get("mode") == "grab":
            # Not straight after show_all(). A window that has been asked to
            # appear is not yet a window on screen, and X refuses a grab on it
            # with GrabNotViewable — which is what every grab so far did, so
            # mode=grab has never once held. Wait for the map, then keep trying
            # briefly, since the compositor can hold a grab of its own for a
            # moment while it animates the window in.
            win.connect("map-event", lambda *_: self._grab_soon())
        win.show_all()
        self.refresh()

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
        if session_kind() != "x11" or active_window_title() is None:
            text += ("\n<small>This session cannot be blocked — log in via "
                     "Ubuntu on Xorg for that.</small>")
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
        # A new window rather than a tab in whatever window happens to be open.
        # A tab joins a window full of other tabs, and the moment the gate
        # activates that window it activates all of them.
        args = [browser, "--new-window", url] if "firefox" in os.path.basename(browser) else [browser, url]
        try:
            subprocess.Popen(args,
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

    def _grab_soon(self, attempts=20):
        """Retry the grab every 250ms until it holds or the window is gone."""
        state = {"left": attempts}

        def attempt():
            if not self.window or self.seat:
                return False
            status = self._grab(quiet=state["left"] > 1)
            if status == "ok" or status == "unsupported":
                return False
            state["left"] -= 1
            return state["left"] > 0

        GLib.timeout_add(250, attempt)
        return False

    def _grab(self, quiet=False):
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
                return "unsupported"
            gdk_window = self.window.get_window() if self.window else None
            if gdk_window is None:
                return "retry"
            seat = display.get_default_seat()
            status = seat.grab(gdk_window, Gdk.SeatCapabilities.ALL, True,
                               None, None, None, None)
            if status == Gdk.GrabStatus.SUCCESS:
                self.seat = seat
                self.window.present()
                print("gate: grab held", flush=True)
                return "ok"
            if not quiet:
                print("gate: grab refused (%s) — holding as a nag" % status,
                      file=sys.stderr, flush=True)
            return "retry"
        except Exception as e:                      # noqa: BLE001
            print("gate: grab failed (%s) — holding as a nag" % e,
                  file=sys.stderr, flush=True)
            return "unsupported"

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
        return bool(cap > 0 and self.locked_since and
                    (time.time() - self.locked_since) / 60 >= cap)

    def training_live(self):
        """Is training happening right now?

        **Focus** is what makes this a gate: a trainer window is in front of
        you, or something else is, and nothing else describes the present
        tense. **The heartbeat** and **the disk figure rising** are the fallback
        for a display that cannot be read, and only that.

        Grace covers the hand-off after Train and nothing more. It ends the
        moment the hub has focus, and after the first few seconds it excuses
        only a browser window still loading — so switching elsewhere during it
        brings the panel back like switching elsewhere at any other time.
        """
        now = time.time()
        since_launch = now - self.launched_at if self.launched_at else None
        in_grace = since_launch is not None and \
            since_launch < float(self.cfg.get("grace_seconds") or 0)

        info = window_info()
        focus = classify_focus(self.cfg, info)
        if focus is True:
            self.launched_at = 0.0
            return True
        if focus is False:
            if not in_grace:
                return False
            activate_hub_window(self.cfg)
            if since_launch < float(self.cfg.get("settle_seconds") or 0):
                return True
            return is_handoff_placeholder(self.cfg, info)
        if in_grace:
            return True

        # The display could not be read. Fall back to the slower evidence
        # rather than blocking a machine the gate cannot see.
        beat = self.counter.last_beat
        if beat and now - beat < float(self.cfg.get("stall_seconds") or 0):
            return True
        fuse = float(self.cfg.get("stall_seconds") or 0) if beat \
            else float(self.cfg.get("stall_seconds_no_beat") or 0)
        progress = self.counter.last_progress
        return bool(progress and now - progress < fuse)

    def unlock(self, why):
        self.locked_since = 0.0
        self.hide(why)
        return True

    def evaluate(self):
        """Called on a timer. The only place the panel is raised or dropped."""
        self.counter.roll_day()
        today = self.counter.day
        if self.lock_day != today:
            self.lock_day, self.locked_since, self.released = today, 0.0, False

        need = float(self.cfg["required_minutes"])
        have = self.counter.minutes

        if self.released:
            self.hide("released for today")
            return True
        if not self.cfg.get("armed"):
            return self.unlock("disarmed")
        if have >= need:
            return self.unlock("%.0f of %.0f min done" % (have, need))
        if not within_active_hours(self.cfg):
            return self.unlock("outside active hours")

        # Locked from here until one of the above is true.
        if not self.locked_since:
            self.locked_since = time.time()
        if self.held_too_long():
            # For the rest of the day, not for five seconds. Released and then
            # re-locked on the next tick is a cap that does nothing.
            self.released = True
            self.hide("locked %s min, the cap — released for today" % self.cfg["max_hold_minutes"])
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
        "session": session_kind(),
        "canGrab": session_kind() == "x11",
        "focusedOnTraining": focused_on_training(cfg),
        "activeWindow": (active_window_title() or "").strip()[:200] or None,
        "trainingLive": gate.training_live() if gate else None,
        "lockedMinutes": round((time.time() - gate.locked_since) / 60, 1) if gate and gate.locked_since else 0,
        "releasedForToday": bool(gate and gate.released),
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
    # At login the window manager may not have published _NET_ACTIVE_WINDOW
    # yet, and a probe that early reports "cannot see focus" on a session where
    # it plainly can — which is what this printed on the first Xorg login. So
    # an X11 session gets a few seconds to settle before the verdict.
    def settle_and_report(tries=[0]):
        tries[0] += 1
        if session_kind() == "x11" and active_window_title() is None and tries[0] < 6:
            return True                     # ask again in 5s
        report_capabilities(cfg)
        return False
    GLib.timeout_add_seconds(5, settle_and_report)

    GLib.timeout_add(max(200, int(cfg.get("check_every_ms") or 500)), gate.evaluate)
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
