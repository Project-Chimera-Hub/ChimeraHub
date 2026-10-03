# Earshot

A listening game based on 3D multiple object tracking (3D-MOT). Identical sounds
move around your head. A few of them start out as targets. Follow the targets by ear,
then pick them out when everything stops. The game adapts the speed to find your
**speed threshold**, like the visual task does.

## Open it

1. Unzip the folder anywhere.
2. Double-click `index.html`. It opens in your default browser.
3. Put on headphones and press **Start session**.

Nothing to install and no internet needed. Every sound is synthesised in the browser,
and the fonts are embedded. It works in current versions of Chrome, Edge, Firefox and
Safari on a desktop or laptop. Phones work too, but opening a local file is awkward there.

If double-clicking opens something other than a browser, right-click `index.html` and
choose **Open with**, then pick your browser. Or drag the file into an open browser window.

**First time?** Open **Headphone check** in the top menu. It takes about a minute and
tells you whether left and right are correct and whether front and back get mixed up.

## How a trial works

1. **Listen.** Every sound clicks from where it starts.
2. **Targets.** A bell rings from each target while the other sounds stay quiet.
3. **Remember.** All sounds click again for a second, now identical.
4. **Track.** The sounds move for 8 seconds (adjustable), bouncing off each other and off the arena's edges.
5. **Choose.** Everything stops. Hear each sound where it ended up, pick the targets and confirm.
   Bells then ring from where the targets really were.

A correct trial makes the next one faster. A mistake makes it slower.

## Controls

| Key | What it does |
| --- | --- |
| ← → | While choosing, move between sounds and hear each one where it stopped |
| Space | Pick or remove the current sound |
| 1 to 8 | Pick or remove a sound by its number |
| R | Hear every sound in order, clockwise from the front |
| Enter | Confirm, then go to the next trial |
| Esc | Pause (a trial interrupted while sounds are playing restarts) |

With the mouse, hover a dot to hear it and click to pick it. On a touch screen, tap a
dot or a numbered button.

**Playing without the screen:** turn on *Spoken prompts* in Adjust settings. Earshot
announces trial numbers, sound numbers and results with your device's voice, and every
action has a keyboard shortcut. Screen readers also get live announcements.

## Setups

| Setup | Arena | Sounds | Targets | Notes |
| --- | --- | --- | --- | --- |
| First steps | Ring | 4 | 1 | Start here |
| Two at once | Ring | 5 | 2 | |
| Near and far | Floor | 6 | 2 | Distance changes loudness |
| Overhead | Dome | 6 | 2 | Height is hard to hear on headphones |
| Eight and four | Dome | 8 | 4 | The counts used in visual 3D-MOT. Very hard |

- **Ring:** sounds glide around a circle at ear level; only direction changes.
- **Floor:** sounds roam a flat ring-shaped area 1.2 to 3.2 m around you.
- **Dome:** sounds travel over a dome from 20° below ear level to 50° above.
- **Front only** keeps every sound within about ±80° of straight ahead. Use it if the
  headphone check shows front–back mix-ups.

**Adjust settings** also covers tracking time, session length, the sound itself
(noise ticks, wood knocks or plucked string), room echo and volume.

## The score

The speed is measured in degrees per second around your head. It follows a
1-up/1-down staircase: ×1.26 steps until the second reversal, then ×1.12 steps.
The **speed threshold** is the geometric mean of the reversal speeds after the first
two, which is roughly the speed you get right half the time. With too few reversals,
it falls back to the geometric mean of the second half of the session.

Thresholds only compare fairly between sessions with the same arena, number of sounds,
number of targets, direction limit and tracking time. **Progress** groups sessions by
setup. Each new session starts at 80% of your last threshold for that setup.

## Your data

Results are saved in the browser's local storage on this device. Nothing leaves your
computer. **Progress → Download CSV / JSON** exports every trial: speed, correctness,
target and picked numbers, and response time. Some browsers restrict storage for pages
opened from disk; if the summary says a result couldn't be saved, download it before
closing the page. Sessions shorter than 6 trials aren't saved, and practice is never saved.

## Why it's built this way

Visual 3D-MOT works because every ball looks the same after the targets are marked,
so the only way to follow a target is to track where it is. Earshot keeps that rule
for hearing and works around the ear's limits:

- **No identity cues.** All sources use one sound recipe. Every click is a fresh random
  noise token with ±1.5 dB of random level, so no source has its own timbre or loudness.
- **No rhythm cues.** Sources take turns in a newly shuffled order each round (about
  8 clicks per source per second, never closer than 26 ms overall). Clicks don't
  overlap, which keeps them separable, and no source owns a beat.
- **Easy-to-locate sounds.** Short broadband clicks carry the high-frequency cues
  that head-related transfer functions rely on.
- **Fewer objects than vision.** Listeners can pick out only about 3 to 4 simultaneous
  sources, versus about 4 to 8 objects for vision, so the defaults start at 4 sounds
  and 1 target.
- **Moderate speeds.** Auditory motion acuity is best below about 20°/s, so sessions
  start at 15 to 20°/s. The cap is 240°/s, far below the roughly 900°/s limit
  measured for sounds circling the head.
- **Azimuth first.** Generic HRTFs locate left and right well, front and back less well,
  and height poorly, so the ring is the default and the floor and dome are experimental.

Movement is simulated in advance at 400 steps per second, with elastic bounces.
It is applied to each sound's HRTF panner as an automation curve, so motion stays
smooth even if the screen stutters.

## Files

```
index.html          the app (open this)
css/styles.css      design tokens and layout (light and dark themes)
css/fonts.css       Barlow and Barlow Semi Condensed, embedded
fonts/OFL.txt       font licence
js/utils.js         maths, coordinates, storage helpers
js/motion.js        trajectory simulation for the three arenas
js/staircase.js     adaptive speed staircase and threshold
js/audio.js         sound synthesis, HRTF panning, scheduling
js/settings.js      presets, validation, persistence
js/field.js         the polar listening field (canvas)
js/charts.js        speed and threshold charts
js/history.js       saved sessions, export, Progress screen
js/home.js          setup screen and demo
js/game.js          trial timeline, choosing, feedback, pause
js/summary.js       end-of-session summary
js/check.js         headphone check
js/main.js          start-up and navigation
```

The scripts are plain (non-module) JavaScript loaded in order, which is what lets
`index.html` run from a `file://` address. To experiment, the main constants live at
the top of `js/game.js` (trial timing), `js/motion.js` (arena sizes, bounce distances)
and `js/staircase.js` (step sizes). Adding `?fast` to the address shortens every
trial, which is useful for testing changes.

## Limits

- Earshot uses the browser's built-in generic HRTF, not one measured for your ears.
  Accuracy varies between people and headphones.
- Turn off device features such as spatial audio or head tracking. They would move
  the sounds a second time.
- Bluetooth headphones add delay, which only affects how well the practice visuals
  line up with the sound.

Earshot is an independent prototype for exploring spatial listening and attention. It
isn't a medical or diagnostic tool and makes no claim to improve thinking, sport
performance or anything else. It is not affiliated with NeuroTracker or CogniSens.
