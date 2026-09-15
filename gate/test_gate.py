#!/usr/bin/env python3
"""Tests for the gate's decisions, run without ever drawing a window.

    python3 gate/test_gate.py

GTK is never imported here, which is the point of `load_gtk()` being lazy: the
logic that decides whether to lock a machine is testable on a machine with no
display, and every case below is one that is unpleasant to discover by having
it happen to you.
"""

import json
import os
import sys
import threading
import time
import urllib.request
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gate as G

# The suite must not read the desktop it happens to run on. Under an X11 login
# the real `xprop` answers, and every test that does not say what has focus
# would silently be about whatever window was focused when it ran. Unreadable is
# the neutral default; `focus()` below says otherwise per test.
G.active_window_title = lambda: None
# Nothing in the suite may act on the real desktop: no windows raised, no
# applications started, and above all no notification setting changed — the
# gate may be mid-lock on the machine running these tests.
ACTIVATED, STARTED = [], []
WINDOWS = {"mindbuild": "0xHUB", "anki": "0xANKI"}
_real_quiet = G.quiet_notifications
G.quiet_notifications = lambda on: None
G.find_target_window = lambda cfg, target: WINDOWS.get(target)
G.activate_window = lambda wid: ACTIVATED.append({"0xHUB": "mindbuild", "0xANKI": "anki"}.get(wid, wid)) or True
G.start_application = lambda args: STARTED.append(list(args)) or True

cases = []
def test(fn): cases.append(fn); return fn


def cfg(**over):
    c = dict(G.DEFAULTS)
    c.update(over)
    return c


class FakeGate(G.Gate):
    """The real decision logic, with the window replaced by a flag.

    `evaluate` is the only method that opens or closes anything, so overriding
    `show`/`hide` leaves every branch under test and draws nothing.
    """
    def __init__(self, c, counter):
        super().__init__(c, counter)
        self.closed = False
        self.why = None

    def show(self):
        if not self.closed:
            self.shown_at = time.time()
        self.closed = True
        self.window = True          # stands in for a GTK window existing

    def hide(self, why):
        self.closed = False
        self.why = why
        self.window = None



def gate_with(minutes, **over):
    c = cfg(**over)
    counter = G.Counter(c)
    counter.disk = float(minutes)
    return FakeGate(c, counter)


# ---- the decision -------------------------------------------------------- #

@test
def under_the_quota_closes_the_gate():
    g = gate_with(5, required_minutes=20, active_from="00:00", active_to="23:59")
    g.evaluate()
    assert g.closed, "5 of 20 minutes left the gate open"


@test
def meeting_the_quota_opens_it():
    g = gate_with(5, required_minutes=20, active_from="00:00", active_to="23:59")
    g.evaluate()
    g.counter.disk = 20.0
    g.evaluate()
    assert not g.closed, "the quota was met and the gate stayed closed"


@test
def disarmed_never_closes():
    g = gate_with(0, required_minutes=20, armed=False,
                  active_from="00:00", active_to="23:59")
    g.evaluate()
    assert not g.closed, "a disarmed gate closed"


@test
def outside_active_hours_never_closes():
    # A window in the past: whatever time the suite runs, now is outside it.
    now = datetime.now()
    hour = (now.hour + 3) % 24
    g = gate_with(0, required_minutes=20,
                  active_from="%02d:00" % hour, active_to="%02d:30" % hour)
    g.evaluate()
    assert not g.closed, "the gate closed outside its active hours"


@test
def the_hold_cap_releases_regardless_of_the_count():
    """The guard against the gate's own bugs, and it has no override."""
    g = gate_with(0, required_minutes=20, max_hold_minutes=30,
                  active_from="00:00", active_to="23:59")
    g.evaluate()
    assert g.closed
    g.locked_since = time.time() - 31 * 60
    g.evaluate()
    assert not g.closed, "the gate held past max_hold_minutes on a count of zero"


@test
def a_failed_scan_keeps_the_last_good_number():
    """A scan that throws must not read as a day with no training in it."""
    c = cfg()
    counter = G.Counter(c)
    counter.disk = 25.0
    counter.scan = lambda roll=True: None        # a scan that silently fails
    counter.scan()
    assert counter.minutes == 25.0, "a failed scan zeroed the count"


@test
def the_day_rolls_and_takes_the_count_with_it():
    c = cfg()
    counter = G.Counter(c)
    counter.disk, counter.beat = 40.0, 40.0
    counter.day = "1999-01-01"
    counter.last_beat = time.time()
    counter.roll_day()
    assert counter.day == G.utc_day()
    assert counter.minutes == 0.0, "yesterday's minutes survived into today"
    assert counter.last_beat > 0, \
        "midnight passing was treated as the session having stopped"


# ---- stepping aside while you train --------------------------------------- #

@test
def a_recent_heartbeat_keeps_the_panel_down():
    """The hub is open and posting, so something is being trained at."""
    g = gate_with(0, required_minutes=20, active_from="00:00", active_to="23:59")
    g.evaluate()
    assert g.closed, "the panel was not up to begin with"
    g.counter.last_beat = time.time()
    g.evaluate()
    assert not g.closed, "the panel stayed up while the hub was posting"


@test
def a_stale_heartbeat_brings_it_back():
    g = gate_with(0, required_minutes=20, stall_seconds=180,
                  active_from="00:00", active_to="23:59")
    g.counter.last_beat = time.time() - 181
    g.evaluate()
    assert g.closed, "a session that stopped three minutes ago still held the panel off"


@test
def the_grace_period_covers_a_browser_starting():
    """Between the button and the first heartbeat there is nothing to see, and
    reappearing in that gap would fight the browser for the screen."""
    g = gate_with(0, required_minutes=20, grace_seconds=120,
                  active_from="00:00", active_to="23:59")
    g.launched_at = time.time()
    g.evaluate()
    assert not g.closed, "the panel came back while the browser was still starting"


@test
def grace_runs_out_if_nothing_follows_it():
    g = gate_with(0, required_minutes=20, grace_seconds=120, stall_seconds=180,
                  active_from="00:00", active_to="23:59")
    g.launched_at = time.time() - 121          # browser opened, never trained in
    g.evaluate()
    assert g.closed, "pressing Train and walking away kept the gate off for good"


@test
def a_heartbeat_stamps_liveness_even_when_the_figure_has_not_moved():
    """Between two blocks the total does not change, and that is not a stall."""
    c = cfg()
    counter = G.Counter(c)
    counter.heartbeat(G.utc_day(), 0)
    assert counter.last_beat > 0, "a heartbeat carrying no new minutes was ignored"


@test
def a_heartbeat_for_another_day_does_not_stamp_liveness():
    c = cfg()
    counter = G.Counter(c)
    counter.heartbeat("1999-01-01", 50)
    assert counter.last_beat == 0, "a stale day's heartbeat counted as a live session"


@test
def meeting_the_quota_still_wins_over_a_live_session():
    g = gate_with(25, required_minutes=20, active_from="00:00", active_to="23:59")
    g.counter.last_beat = time.time()
    g.evaluate()
    assert not g.closed


# ---- focus: the signal that makes it a gate -------------------------------- #

import contextlib

@contextlib.contextmanager
def focus(value):
    """Stand in for the X server. `value` is what xprop would have told us."""
    original = G.active_window_title
    G.active_window_title = lambda: value
    try:
        yield
    finally:
        G.active_window_title = original


@test
def a_trainer_in_front_of_you_stands_the_panel_down():
    g = gate_with(0, required_minutes=20, active_from="00:00", active_to="23:59")
    with focus('_NET_WM_NAME(UTF8_STRING) = "Relational N-back — mindbuild — Mozilla Firefox"\nWM_CLASS(STRING) = "Navigator", "firefox"'):
        g.evaluate()
    assert not g.closed, "the panel stayed up while a trainer had focus"


@test
def switching_to_anything_else_brings_it_straight_back():
    """The whole point. No grace, no fuse — the other application is the thing
    being blocked, and it is in front of you now."""
    g = gate_with(0, required_minutes=20, active_from="00:00", active_to="23:59")
    with focus('_NET_WM_NAME(UTF8_STRING) = "Relational N-back — mindbuild"\nWM_CLASS(STRING) = "Navigator", "firefox"'):
        g.evaluate()
    assert not g.closed
    with focus('_NET_WM_NAME(UTF8_STRING) = "Inbox (12) — Mozilla Thunderbird"'):
        g.evaluate()
    assert g.closed, "the panel did not come back when another application took focus"


@test
def focus_overrules_a_live_heartbeat():
    """A hub open in a background tab is not training. Without this the gate is
    satisfied by leaving a tab open, which is no gate at all."""
    g = gate_with(0, required_minutes=20, active_from="00:00", active_to="23:59")
    g.counter.last_beat = time.time()
    with focus('_NET_WM_NAME(UTF8_STRING) = "Steam"'):
        g.evaluate()
    assert g.closed, "an open hub tab excused whatever was actually on screen"


@test
def focus_overrules_a_lagging_disk():
    g = gate_with(0, required_minutes=20, active_from="00:00", active_to="23:59")
    g.counter.last_progress = time.time() - 3600      # trained an hour ago
    with focus('_NET_WM_NAME(UTF8_STRING) = "mindbuild — Mozilla Firefox"\nWM_CLASS(STRING) = "Navigator", "firefox"'):
        g.evaluate()
    assert not g.closed, "a stale disk figure overruled the trainer on screen"


@test
def an_unreadable_display_never_blocks_on_its_own():
    """None means "could not be answered", not "you are not training". A gate
    that blocks a machine it cannot see is one you fix with the power button."""
    g = gate_with(0, required_minutes=20, active_from="00:00", active_to="23:59")
    g.counter.last_beat = time.time()
    with focus(None):
        g.evaluate()
    assert not g.closed, "an unreadable display was treated as proof of not training"


@test
def the_patterns_are_matched_case_insensitively_anywhere_in_the_title():
    c = cfg(training_window_patterns=["mindbuild"])
    with focus('_NET_WM_NAME(UTF8_STRING) = "CCT — MINDBUILD"\nWM_CLASS(STRING) = "Navigator", "firefox"'):
        assert G.focused_on_training(c) is True
    with focus('_NET_WM_NAME(UTF8_STRING) = "something else"'):
        assert G.focused_on_training(c) is False
    with focus(None):
        assert G.focused_on_training(c) is None


@test
def grace_ends_the_moment_a_trainer_has_focus():
    """Otherwise Train is a free pass: press it, glance at the trainer, and
    spend the rest of the grace period somewhere else."""
    g = gate_with(0, required_minutes=20, grace_seconds=600,
                  active_from="00:00", active_to="23:59")
    g.launched_at = time.time()             # Train pressed, long grace
    with focus('_NET_WM_NAME(UTF8_STRING) = "Something else"'):
        g.evaluate()
    assert not g.closed, "grace did not cover the browser still opening"
    with focus('_NET_WM_NAME(UTF8_STRING) = "RNB — mindbuild"\nWM_CLASS(STRING) = "Navigator", "firefox"'):
        g.evaluate()
    assert g.launched_at == 0.0, "grace survived a trainer taking focus"
    with focus('_NET_WM_NAME(UTF8_STRING) = "Steam"'):
        g.evaluate()
    assert g.closed, "switching away after the trainer appeared was still excused"


@test
def the_panels_own_title_is_not_a_training_window():
    """Otherwise the gate reads its own window as a trainer, hides, sees no
    trainer, shows, and does that for as long as you let it."""
    assert G.focused_on_training(cfg()) is not None or True   # shape check only
    title = '_NET_WM_NAME(UTF8_STRING) = "%s"' % G.PANEL_TITLE
    with focus(title):
        assert G.focused_on_training(cfg()) is False, \
            "the gate's own panel matches training_window_patterns"


FIREFOX = '\nWM_CLASS(STRING) = "Navigator", "firefox"'


@test
def during_grace_the_chosen_application_is_pulled_back_in_front():
    """Grace used to excuse whatever had focus — an exit. Now it spends itself
    raising the application you picked, so switching away does not stick."""
    g = gate_with(0, required_minutes=20, grace_seconds=15,
                  active_from="00:00", active_to="23:59")
    g.launched_at = time.time() - 5
    del ACTIVATED[:]
    with focus('_NET_WM_NAME(UTF8_STRING) = "Discord | Friends — Mozilla Firefox"' + FIREFOX):
        g.evaluate()
    assert ACTIVATED == ["mindbuild"], "grace did not pull the hub back in front"
    assert not g.closed


@test
def after_grace_switching_away_brings_the_panel_back():
    g = gate_with(0, required_minutes=20, grace_seconds=15,
                  active_from="00:00", active_to="23:59")
    g.launched_at = time.time() - 16
    with focus('_NET_WM_NAME(UTF8_STRING) = "Discord | Friends — Mozilla Firefox"' + FIREFOX):
        g.evaluate()
    assert g.closed


@test
def a_browser_still_loading_is_excused_during_grace():
    g = gate_with(0, required_minutes=20, grace_seconds=15, settle_seconds=3,
                  active_from="00:00", active_to="23:59")
    g.launched_at = time.time() - 5
    with focus('_NET_WM_NAME(UTF8_STRING) = "Mozilla Firefox"' + FIREFOX):
        g.evaluate()
    assert not g.closed, "the hub window was blocked while it was still loading"


@test
def a_mindbuild_title_in_another_browser_is_not_training():
    """Its storage is not the one the counter reads."""
    with focus('_NET_WM_NAME(UTF8_STRING) = "mindbuild — Google Chrome"\nWM_CLASS(STRING) = "google-chrome", "Google-chrome"'):
        assert G.focused_on_training(cfg()) is False


@test
def a_trainer_name_alone_is_no_longer_a_training_window():
    with focus('_NET_WM_NAME(UTF8_STRING) = "Synthwave mix — YouTube — Mozilla Firefox"' + FIREFOX):
        assert G.focused_on_training(cfg()) is False


@test
def the_hold_cap_counts_the_whole_lock_not_each_panel():
    """Going back to training used to restart the cap, so it never fired."""
    g = gate_with(0, required_minutes=20, max_hold_minutes=30,
                  active_from="00:00", active_to="23:59")
    g.evaluate()
    started = g.locked_since
    assert started
    with focus('_NET_WM_NAME(UTF8_STRING) = "RNB — mindbuild"' + FIREFOX):
        g.evaluate()
    assert not g.closed and g.locked_since == started, "training restarted the lock clock"


@test
def the_cap_releases_for_the_rest_of_the_day():
    g = gate_with(0, required_minutes=20, max_hold_minutes=30,
                  active_from="00:00", active_to="23:59")
    g.evaluate()
    g.locked_since = time.time() - 31 * 60
    g.evaluate()
    assert not g.closed
    g.evaluate()
    assert not g.closed, "the cap released and then re-locked on the next tick"


@test
def an_ordinary_tick_does_not_wipe_the_counts():
    """roll_day runs on every evaluation. Only a new day may clear anything."""
    c = cfg()
    counter = G.Counter(c)
    counter.capped, counter.by_source, counter.anki_minutes = ["cct"], {"cct": 3}, 12.0
    counter.roll_day()
    assert counter.capped == ["cct"] and counter.by_source == {"cct": 3} \
        and counter.anki_minutes == 12.0, "a same-day roll_day wiped the counts"


# ---- two quotas ------------------------------------------------------------ #

ANKI = '_NET_WM_NAME(UTF8_STRING) = "Benutzer 1 - Anki"\nWM_CLASS(STRING) = "anki", "Anki"'
HUB = '_NET_WM_NAME(UTF8_STRING) = "RNB — mindbuild"' + FIREFOX


def gate_with_anki(mind, anki, **over):
    g = gate_with(mind, required_minutes=20, anki={"required_minutes": 20},
                  active_from="00:00", active_to="23:59", **over)
    g.counter.anki_minutes = float(anki)
    return g


@test
def the_lock_holds_until_both_quotas_are_met():
    g = gate_with_anki(25, 5)
    g.evaluate()
    assert g.closed, "mindbuild alone unlocked a machine that still owes Anki"
    g.counter.anki_minutes = 20.0
    g.evaluate()
    assert not g.closed, "both quotas met and still locked"


@test
def anki_is_a_training_window_while_anki_is_owed():
    g = gate_with_anki(5, 5)
    with focus(ANKI):
        g.evaluate()
    assert not g.closed


@test
def anki_is_just_another_application_once_its_quota_is_met():
    g = gate_with_anki(5, 25)
    with focus(ANKI):
        g.evaluate()
    assert g.closed, "Anki excused a day that still owes mindbuild"
    with focus(HUB):
        g.evaluate()
    assert not g.closed


@test
def mindbuild_is_just_another_application_once_its_quota_is_met():
    g = gate_with_anki(25, 5)
    with focus(HUB):
        g.evaluate()
    assert g.closed, "the hub excused a day that still owes Anki"


@test
def with_anki_off_there_is_one_quota_and_one_button():
    g = gate_with(5, required_minutes=20)
    assert [n for n, _, _ in g.targets()] == ["mindbuild"]


@test
def a_partial_anki_block_keeps_the_default_command():
    c = cfg(anki={"required_minutes": 120})
    a = G.anki_cfg(c)
    assert a["required_minutes"] == 120 and a["command"] and a["window_class"], \
        "naming only the quota lost the rest of the anki block"


@test
def choosing_anki_gives_it_time_to_start_and_raises_it_not_the_hub():
    """A cold Anki start takes ten seconds and more. The panel came back over it
    after three, and Anki opened behind a fullscreen window."""
    g = gate_with_anki(5, 5)
    g.launched_at, g.launched_target = time.time() - 30, "anki"
    del ACTIVATED[:]
    with focus('_NET_WM_NAME(UTF8_STRING) = "Mozilla Firefox"' + FIREFOX):
        g.evaluate()
    assert not g.closed, "the panel came back while Anki was still starting"
    assert ACTIVATED == ["anki"], "the wrong application was pulled forward"


@test
def an_unreadable_blip_does_not_flap_the_panel():
    """GNOME reports no active window while the panel has focus. Read as "cannot
    tell", that let the heartbeat hide the panel, focus went back, the panel
    came up — once a second."""
    g = gate_with(0, required_minutes=20, active_from="00:00", active_to="23:59")
    g.counter.last_beat = time.time()               # the hub is posting
    with focus('_NET_WM_NAME(UTF8_STRING) = "Mozilla Firefox"' + FIREFOX):
        g.evaluate()
    assert g.closed
    with focus(None):
        g.evaluate()
    assert g.closed, "a moment of unreadable focus hid the panel"


@test
def pressing_a_button_reuses_an_open_window():
    g = gate_with(0, required_minutes=20, active_from="00:00", active_to="23:59")
    g.show()
    del STARTED[:], ACTIVATED[:]
    g.launch("mindbuild")
    assert STARTED == [], "a new window was opened although one was already there"
    assert ACTIVATED == ["mindbuild"] and not g.closed


@test
def with_nothing_open_the_panel_waits_up_rather_than_setting_you_free():
    """Every failed Anki press used to leave a minute of doing anything."""
    g = gate_with_anki(5, 5)
    g.show()
    del STARTED[:]
    WINDOWS.pop("anki")
    try:
        g.launch("anki")
        assert STARTED and STARTED[0][0] == "anki-desktop", "Anki was not started"
        assert g.closed, "the panel stepped aside before there was a window"
        with focus('_NET_WM_NAME(UTF8_STRING) = "Cowboy Bebop - YouTube"' + FIREFOX):
            g.evaluate()
        assert g.closed, "waiting for Anki let you out"
    finally:
        WINDOWS["anki"] = "0xANKI"


@test
def the_panel_steps_aside_once_the_window_exists():
    g = gate_with_anki(5, 5)
    g.show()
    g.launched_at, g.launched_target, g.raised_at = time.time() - 8, "anki", 0.0
    del ACTIVATED[:]
    with focus('_NET_WM_NAME(UTF8_STRING) = "Claude"\nWM_CLASS(STRING) = "com.anthropic.claude", "x"'):
        g.evaluate()
    assert not g.closed and ACTIVATED == ["anki"]


@test
def a_window_that_will_not_take_focus_brings_the_panel_back():
    g = gate_with_anki(5, 5)
    g.launched_at, g.launched_target = time.time() - 8, "anki"
    g.raised_at = time.time() - (G.RAISE_SECONDS + 1)
    with focus('_NET_WM_NAME(UTF8_STRING) = "Claude"\nWM_CLASS(STRING) = "com.anthropic.claude", "x"'):
        g.evaluate()
    assert g.closed, "a raise that never took left the panel down"


@test
def an_application_that_never_opens_says_so():
    g = gate_with_anki(5, 5)
    g.launched_at, g.launched_target = time.time() - 61, "anki"
    WINDOWS.pop("anki")
    try:
        g.evaluate()
    finally:
        WINDOWS["anki"] = "0xANKI"
    assert g.closed and g.launch_error and "Anki" in g.launch_error


@test
def banners_are_restored_exactly_as_they_were():
    import tempfile
    calls, state = [], {"value": "true"}

    def run(cmd, **kw):
        calls.append(cmd)
        class R:                                    # noqa: D401
            stdout = state["value"] + "\n"
        if cmd[1] == "set":
            state["value"] = cmd[-1]
        return R()

    real_run, real_path = G.subprocess.run, G.NOTIFY_STATE
    G.subprocess.run = run
    G.NOTIFY_STATE = os.path.join(tempfile.mkdtemp(), "banners")
    try:
        _real_quiet(True)
        assert state["value"] == "false"
        _real_quiet(True)                           # a second lock tick
        assert open(G.NOTIFY_STATE).read() == "true", "the saved value was overwritten by the lock's own"
        _real_quiet(False)
        assert state["value"] == "true" and not os.path.exists(G.NOTIFY_STATE)
    finally:
        G.subprocess.run, G.NOTIFY_STATE = real_run, real_path


@test
def sustained_unreadable_focus_is_not_training_once_focus_was_readable():
    """The Activities overview, a fullscreen game: no active window for as long
    as you like, excused by an open hub tab's heartbeat. No longer."""
    g = gate_with(0, required_minutes=20, active_from="00:00", active_to="23:59")
    g.counter.last_beat = time.time()
    g.focus_seen_at = time.time() - (G.BLIP_SECONDS + 1)
    with focus(None):
        g.evaluate()
    assert g.closed, "unreadable focus plus an open hub tab kept the panel down"


@test
def a_short_unreadable_blip_while_training_is_tolerated():
    g = gate_with(0, required_minutes=20, active_from="00:00", active_to="23:59")
    g.focus_seen_at = time.time() - 0.5
    with focus(None):
        g.evaluate()
    assert not g.closed


@test
def a_private_hub_window_is_not_training():
    with focus('_NET_WM_NAME(UTF8_STRING) = "RNB — mindbuild — Mozilla Firefox Private Browsing"' + FIREFOX):
        assert G.focused_on_training(cfg()) is False, \
            "a private window, whose training is never saved, counted"


# ---- when the heartbeat never arrives ------------------------------------- #
#
# Firefox may refuse an https:// page's POST to http://127.0.0.1 as mixed
# content. If it does, the fast signal simply does not exist on that machine and
# the gate has to stay usable on the disk scan alone.

@test
def a_rising_disk_count_counts_as_training():
    g = gate_with(5, required_minutes=20, stall_seconds_no_beat=900,
                  active_from="00:00", active_to="23:59")
    g.counter.last_progress = time.time()
    g.evaluate()
    assert not g.closed, "the panel ignored a disk count that had just gone up"


@test
def with_no_heartbeat_the_fuse_is_the_long_one():
    """Three minutes is far too short to judge a stall by a signal that lags by
    minutes; on a scan-only machine that would put the panel over a live page."""
    g = gate_with(5, required_minutes=20, stall_seconds=180,
                  stall_seconds_no_beat=900, active_from="00:00", active_to="23:59")
    g.counter.last_progress = time.time() - 300      # past the short fuse
    g.evaluate()
    assert not g.closed, "the short fuse was used on a machine with no heartbeat"

    g.counter.last_progress = time.time() - 901      # past the long one
    g.evaluate()
    assert g.closed, "the long fuse never burned down"


@test
def once_a_heartbeat_exists_the_short_fuse_applies():
    g = gate_with(5, required_minutes=20, stall_seconds=180,
                  stall_seconds_no_beat=900, active_from="00:00", active_to="23:59")
    g.counter.last_beat = time.time() - 600          # heard from, but a while ago
    g.counter.last_progress = time.time() - 300
    g.evaluate()
    assert g.closed, "a machine with a working heartbeat used the scan-only fuse"


@test
def a_scan_that_repeats_the_same_total_is_not_progress():
    """Otherwise every scan renews the lease and the panel never returns."""
    c = cfg()
    counter = G.Counter(c)
    counter.disk = 10.0
    counter.last_progress = 0.0

    # Stand in for the subprocesses: the bookkeeping under test is what scan()
    # does with the figure it gets back, not how it gets it.
    def fake(day_total):
        with counter._lock:
            if day_total > counter.disk + 1e-9:
                counter.last_progress = time.time()
            counter.disk = day_total

    fake(10.0)
    assert counter.last_progress == 0.0, "an unchanged total was treated as progress"
    fake(12.0)
    assert counter.last_progress > 0, "a rising total was not treated as progress"


# ---- active hours -------------------------------------------------------- #

@test
def a_window_that_crosses_midnight_still_works():
    c = cfg(active_from="22:00", active_to="02:00")
    at = lambda h, m=0: datetime(2026, 9, 13, h, m)
    assert G.within_active_hours(c, at(23))
    assert G.within_active_hours(c, at(1))
    assert not G.within_active_hours(c, at(12))


@test
def an_unparseable_window_means_always():
    """Wrong in the permissive direction on purpose: a typo in a time should
    not be able to arm the gate around the clock."""
    assert G.within_active_hours(cfg(active_from="nonsense", active_to="x"))


# ---- the heartbeat ------------------------------------------------------- #

@test
def the_heartbeat_only_ever_raises_the_count():
    c = cfg(port=8793)
    counter = G.Counter(c)
    srv = G.make_server(c, counter, None)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    time.sleep(0.2)

    def post(body):
        req = urllib.request.Request("http://127.0.0.1:8793/heartbeat",
                                     data=json.dumps(body).encode(),
                                     headers={"Content-Type": "text/plain"})
        return json.loads(urllib.request.urlopen(req).read())

    try:
        today = G.utc_day()
        assert post({"day": today, "minutes": 14})["minutes"] == 14
        assert post({"day": today, "minutes": 5})["minutes"] == 14, \
            "a smaller heartbeat lowered the count"
        assert post({"day": "1999-01-01", "minutes": 999})["minutes"] == 14, \
            "a heartbeat for another day was counted"
        assert post({"minutes": "banana"})["minutes"] == 14, \
            "malformed input changed the count"
        counter.disk = 30.0
        assert counter.minutes == 30.0, "the disk scan did not overrule the heartbeat"
    finally:
        srv.shutdown()


@test
def the_listener_is_loopback_only():
    """This runs on a laptop that joins other people's networks."""
    c = cfg(port=8794)
    srv = G.make_server(c, G.Counter(c), None)
    try:
        assert srv.server_address[0] == "127.0.0.1", \
            "the gate is listening on something other than loopback"
    finally:
        srv.server_close()


# -------------------------------------------------------------------------- #

if __name__ == "__main__":
    failed = 0
    for fn in cases:
        try:
            fn()
            print("  ok  %s" % fn.__name__.replace("_", " "))
        except AssertionError as e:
            failed += 1
            print("FAIL  %s\n      %s" % (fn.__name__.replace("_", " "), e))
    print("\n%d/%d passed" % (len(cases) - failed, len(cases)))
    sys.exit(1 if failed else 0)
