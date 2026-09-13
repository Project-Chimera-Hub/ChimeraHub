# The gate

A training quota your desktop enforces. Under the quota, a window sits over the
screen with the trainers in it; meet the quota and it goes away until tomorrow.

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
sudo apt install python3-gi gir1.2-gtk-3.0 gir1.2-webkit2-4.0   # if missing
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
| `mode` | `"nag"` | `nag` is fullscreen and on top; Alt-Tab still works. `grab` takes keyboard and pointer. |
| `active_from` / `active_to` | `09:00`–`23:00` | **Local** time. Outside these hours the gate never appears, whatever the count. |
| `max_hold_minutes` | `180` | The gate lets go after this long regardless of the count. No override. |
| `hub_url` | Pages URL | What the window shows. |
| `port` | `8787` | Heartbeat listener, bound to `127.0.0.1` only. |

Two of those are load-bearing and worth saying plainly:

**`active_from`/`active_to` are local, the quota's day is UTC.** Different
questions. The day the record is measured over is UTC because the record is
UTC; the hours you are willing to be interrupted are hours on your own clock.
Answering both with one timezone gets one of them wrong.

**`max_hold_minutes` is the guard against this program's own bugs.** If the
count is ever wrong in the direction that locks you out, the gate still lets go
after three hours. Do not raise it to something you cannot wait out.

## Run it in `nag` for a week first

`grab` takes your keyboard and pointer. Before trusting it with a working day,
run the default and watch `journalctl --user -u mindbuild-gate -f` — you want to
see the count track your real sessions, and the window open and close when it
should, while the cost of being wrong is an Alt-Tab.

## What it is not

It does not touch PAM, the greeter, or anything to do with logging in. That was
a deliberate limit: the failure mode of getting PAM wrong is a machine you
cannot get into and a live USB to fix it, and no quota is worth that risk.

Which means it is bypassable, and by more than one route. That is fine. It works
by making the lazy path slightly more effort than the training, which is all a
commitment device has ever done. A version that genuinely could not be escaped
would be a worse thing to own.
