# The gate

A training quota your desktop enforces. Under the quota a panel sits in front of
you with one button on it; the button opens the hub in Firefox and the panel
steps aside while you train. Meet the quota and it is gone until tomorrow.

## It hands off, it does not host

The panel used to be a WebKitGTK window with the hub loaded into it. That was
wrong twice.

WebKitGTK is not the browser the trainers are used in, and it shows: RNB's cube
renders as its front face alone because `preserve-3d` flattens, and CCT has
nothing to say because `speechSynthesis` reports no voices.

Worse, the counter reads **Firefox's** storage off disk, and a WebKit window
keeps its own under `~/.cache`, where nothing here looks. So training inside the
gate's own window was invisible to the gate's own counter: the quota could never
be met from the window the gate put in front of you, and it would sit there
reporting `0 of 20 min` for as long as you cared to train at it.

So the gate interrupts and then gets out of the way. The browser it opens and
the storage it reads have to be the same browser or the loop does not close —
which is why `browser` defaults to `firefox`, and why pointing it at something
`firefox-storage.py` cannot read breaks the quota rather than just the look.

## It cannot block a Wayland session

Check which you are on:

```bash
echo $XDG_SESSION_TYPE
```

If that says `wayland`, this program can put a window on your screen and nothing
else. Not a limitation of the code — a normal application on GNOME/Wayland
cannot take a global input grab and cannot ask which window has focus. Both are
things a keylogger would want, and the compositor does not distinguish a
keylogger from a training gate. `_NET_ACTIVE_WINDOW` reads `0x0` because GTK
talks to Wayland directly and XWayland's root has no window manager behind it,
and GNOME Shell's own `Introspect.GetWindows` answers `not allowed`.

So on Wayland the gate is a reminder, `mode: "grab"` silently behaves as
`"nag"`, and it cannot tell training from anything else you do. It says all of
this at startup and on the panel rather than presenting itself as a gate.

**For a gate that actually blocks, log out and pick "Ubuntu on Xorg"** — the
gear icon on the GDM password screen. Everything works there: the grab holds,
focus is readable, and the panel returns the moment another application takes
the screen.

The other route is a GNOME Shell extension, which runs inside the compositor and
is the only thing on Wayland allowed to do this. That is a different program to
the one in this directory.

## Get out of it

Before anything else, because this is the part that matters:

```
Ctrl-Alt-F3          →  log in  →  systemctl --user stop mindbuild-gate
```

Virtual terminal switching is handled below X and no grab can take it. That
route always works. In the default `nag` mode you do not even need it — Alt-Tab
past the window and carry on.

## Install

```bash
bash gate/install.sh
```

It writes a config and a systemd user unit and then stops, printing the command
that arms it. Run `python3 gate/gate.py --check` first: it counts today and
exits without ever drawing a window.

```
sudo apt install python3-gi gir1.2-gtk-3.0   # if missing
```

## Where the number comes from

Not from the page. A rule enforced by the thing it is a rule about is not a
rule, and the hub's localStorage can be edited from a console by exactly the
person the gate is for, at exactly the moment they want it gone.

So the count comes off disk:

```
apps/archive/tools/firefox-storage.py    →  every trainer's storage, out of
                                            Firefox's own SQLite
gate/count.js                            →  the archive's adapters over that
```

Same adapters as the archive, same UTC day boundary, same numbers. There is one
answer in this project to "what did I do today", and the gate does not get to
invent a second one.

The hub also posts a heartbeat to `127.0.0.1:8787`, and it can only ever *raise*
the count. Disk writes lag a minute or two behind a live session, and a gate
that says "you have not trained" at someone who just trained for twenty minutes
is a gate that gets uninstalled by lunchtime. The next scan overwrites whatever
the heartbeat claimed, so inflating it buys two minutes and nothing else.

**The archive is never counted.** Sorting your record is not training, and a
quota that could be met by tidying is a quota that will be.

## Settings

`~/.config/mindbuild/gate.json`:

| key | default | |
|---|---|---|
| `required_minutes` | `20` | The day's quota. Keep it to something you would have done anyway. |
| `armed` | `true` | `false` disables the gate without uninstalling it. |
| `mode` | `"nag"` | `nag` is a panel kept on top; Alt-Tab still works. `grab` is fullscreen and takes keyboard and pointer. |
| `active_from` / `active_to` | `09:00`–`23:00` | **Local** time. Outside these hours the gate never appears, whatever the count. |
| `max_hold_minutes` | `180` | The gate lets go after this long regardless of the count. No override. |
| `hub_url` | Pages URL | What the button opens. |
| `browser` | `firefox` | Must be one `firefox-storage.py` can read, or nothing you do will count. |
| `grace_seconds` | `120` | After the button, how long before the panel expects to see anything. |
| `stall_seconds` | `180` | No sign of training for this long and the panel returns. |
| `stall_seconds_no_beat` | `900` | The same, on a machine where the heartbeat never arrives. |
| `training_window_patterns` | hub + trainer titles | A focused window matching any of these is training. Case-insensitive substrings. |
| `caps` | `synth 5%`, `cct 20%` | Per-source ceilings as a share of the counted day. `{}` removes them. |
| `port` | `8787` | Heartbeat listener, bound to `127.0.0.1` only. |

Two of those are load-bearing and worth saying plainly:

**`active_from`/`active_to` are local, the quota's day is UTC.** Different
questions. The day the record is measured over is UTC because the record is
UTC; the hours you are willing to be interrupted are hours on your own clock.
Answering both with one timezone gets one of them wrong.

**`max_hold_minutes` is the guard against this program's own bugs.** If the
count is ever wrong in the direction that locks you out, the gate still lets go
after three hours. Do not raise it to something you cannot wait out.

## How it knows you are training

Three signals, and they are not equals.

**Focus is what makes it a gate.** The panel stands down only while a window
whose title matches `training_window_patterns` has focus, and comes back the
moment anything else does — no grace, no fuse. That is what "blocking other
applications" means here, and it is the only signal in the present tense. The
other two can say training happened *recently*, and "recently" is the loophole:
a grace period long enough not to interrupt a real session is long enough to
read your email in.

If the display cannot be read — `activeWindow` comes back `null` — the gate
falls back to the two below rather than blocking a machine it cannot see.

The hub puts `mindbuild` in every title it sets, framed trainer included, which
is why training through the hub is the path that works best.

The remaining two are that fallback.

The **disk scan** is the authority on how much you did. It is also slow: Firefox
writes localStorage lazily, so a scan can be minutes behind a session in
progress.

The **heartbeat** is the authority on whether anything is happening at all. The
hub posts to `127.0.0.1:8787` every thirty seconds while it is open, and the
panel stays down as long as those keep arriving. It can only ever *raise* the
count and the next scan overwrites whatever it claimed, so the most inflating it
buys is the couple of minutes until that scan lands.

Without it the panel would reappear over a page you were actively answering,
which is the kind of thing that gets a gate uninstalled the same afternoon.

**The heartbeat may not reach it at all.** Firefox can refuse an `https://`
page's POST to `http://127.0.0.1` as mixed content. If that is happening here,
`heartbeatEverSeen` in `curl 127.0.0.1:8787/` stays `false` and there is no fast
signal to be had. The gate notices and falls back: it watches the disk figure
rising instead, scans every 60s while the panel is down, and judges a stall on
`stall_seconds_no_beat` (15 minutes) rather than `stall_seconds` (3), because
three minutes is far too short a fuse for a signal that lags by minutes.

Scan-only works. It is just coarser — a finished session takes a minute or two
to register, so the panel can appear briefly after you stop.

One consequence worth knowing: the heartbeat comes from the **hub**. Train
through `mindbuild/#/rnb` and the panel knows. Open `mindbuild/rnb/` directly in
its own tab and it does not — only the lagging scan sees that, and the panel may
come back mid-session.

## Run it in `nag` for a week first

`grab` takes your keyboard and pointer, and releases them the moment you press
Train — a gate still holding the keyboard hands the browser a window you cannot
type into. Before trusting it with a working day, run the default and watch
`journalctl --user -u mindbuild-gate -f`: you want to see the count track your
real sessions and the panel come and go when it should, while the cost of being
wrong is an Alt-Tab.

## What it is not

It does not touch PAM, the greeter, or anything to do with logging in. That was
a deliberate limit: the failure mode of getting PAM wrong is a machine you
cannot get into and a live USB to fix it, and no quota is worth that risk.

Which means it is bypassable, and by more than one route. That is fine. It works
by making the lazy path slightly more effort than the training, which is all a
commitment device has ever done. A version that genuinely could not be escaped
would be a worse thing to own.
