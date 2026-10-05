"use strict";

/* __NAME__ — started from Chimera Hub's trainer template.
 *
 * The template is a complete trainer: Posner cueing. Two boxes either side of
 * a fixation cross; one is cued, then a target appears in one of them and you
 * say which side. Most cues are valid, so attention learns to go where the cue
 * points — and the cost of an invalid cue (slower, less accurate) is the
 * measure. Difficulty is how briefly the target is shown.
 *
 * Replace the inside of `session` with your own trials. Everything else —
 * screens, pausing, timing, settings, the level and the record the hub reads
 * — is the harness's (harness/harness.js), and FORMAT.md beside it says what
 * the record holds.
 */

Harness.start({
  id: "__ID__",
  name: "__NAME__",
  version: "0.1.0",
  what: "__WHAT__",

  /* What `level` is measured in. Here it is the target's exposure in
     milliseconds, so a smaller level is harder; `adapt` below moves it. */
  unit: "target-ms",
  level: { start: 300, min: 30, max: 600 },

  instructions:
    "<p>Keep your eyes on the cross. One of the two boxes will light up, and "
    + "then a <b>★</b> appears in one of them, briefly.</p>"
    + "<p>Answer which side it was on: <b>F</b> or the left button for left, "
    + "<b>J</b> or the right button for right. Be quick, and be right.</p>"
    + "<p>The cue is usually, but not always, on the right side. As you get "
    + "better, the star is shown for less time.</p>",

  settings: [
    { key: "trials", label: "Trials per session", type: "number", min: 16, max: 200, step: 8, default: 48 },
    { key: "validity", label: "Cue validity", type: "select", default: 0.8,
      options: [{ value: 0.5, label: "50% (uninformative)" }, { value: 0.7, label: "70%" },
                { value: 0.8, label: "80%" }, { value: 0.9, label: "90%" }] },
    { key: "cue", label: "Cue", type: "select", default: "exogenous",
      options: [{ value: "exogenous", label: "Box lights up (exogenous)" },
                { value: "endogenous", label: "Arrow at the centre (endogenous)" }] },
    { key: "soa", label: "Cue to target, ms", type: "select", default: 300,
      options: [{ value: 100 }, { value: 300 }, { value: 600 }] },
    { key: "sound", label: "Click on each target", type: "boolean", default: false },
  ],

  buttons: [
    { id: "left", label: "Left", key: "f" },
    { id: "right", label: "Right", key: "j" },
  ],

  /* The harness's default rule moves the level up a step when accuracy is
     high. Here a *smaller* exposure is harder, so the rule is written out:
     15% shorter after a good session, 15% longer after a poor one. */
  adapt(stats, level) {
    if (typeof stats.accuracy !== "number") return level;
    if (stats.accuracy >= 0.85) return Math.round(level * 0.85);
    if (stats.accuracy < 0.7) return Math.round(level * 1.15);
    return level;
  },

  async session(s) {
    const { trials, validity, cue, soa, sound } = s.settings;
    const exposure = s.level;

    const field = document.createElement("div");
    field.className = "pc-field";
    field.innerHTML = '<div class="pc-box left"></div><div class="pc-fix">+</div><div class="pc-box right"></div>';
    const box = { left: field.querySelector(".left"), right: field.querySelector(".right") };
    const fix = field.querySelector(".pc-fix");
    s.show(field);

    const rts = { valid: [], invalid: [] };

    for (let i = 0; i < trials; i++) {
      const cued = Math.random() < 0.5 ? "left" : "right";
      const valid = Math.random() < validity;
      const side = valid ? cued : (cued === "left" ? "right" : "left");

      /* Fixation, jittered so the target cannot be timed rather than seen. */
      fix.textContent = "+";
      await s.wait(500 + Math.random() * 400);

      /* The cue. */
      if (cue === "exogenous") box[cued].classList.add("cued");
      else fix.textContent = cued === "left" ? "←" : "→";
      await s.wait(cue === "exogenous" ? 100 : soa);
      box[cued].classList.remove("cued");
      if (cue === "exogenous") await s.wait(Math.max(0, soa - 100));
      fix.textContent = "+";

      /* The target, for `exposure` ms; the response window runs on after it. */
      box[side].textContent = "★";
      if (sound) s.audio.tone(880, 40, 0.1);
      const answer = s.respond({ timeoutMs: 1500 });
      await Promise.race([s.wait(exposure), answer]);
      box[side].textContent = "";
      const r = await answer;

      const correct = !!r && r.id === side;
      s.feedback(correct);
      s.log({
        level: exposure,
        stimulus: { cue: cued, target: side },
        target: true,
        response: r ? r.id : null,
        correct,
        rtMs: r ? r.rtMs : null,
        extra: { valid },
      });
      if (correct) rts[valid ? "valid" : "invalid"].push(r.rtMs);
      await s.wait(300);
    }

    /* The cueing effect: how much an invalid cue cost, in median ms. */
    const median = (a) => {
      if (!a.length) return null;
      const b = a.slice().sort((x, y) => x - y), m = b.length >> 1;
      return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
    };
    const v = median(rts.valid), iv = median(rts.invalid);
    return {
      mode: cue,
      extra: { validityEffectMs: v != null && iv != null ? Math.round(iv - v) : null, soa, validity },
    };
  },
});
