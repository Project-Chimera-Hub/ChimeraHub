"use strict";

/* ============================================================
   PAUSING THE TRAINER THE HUB HAS COVERED
   ============================================================

   Returning to the hub used to leave the trainer running. The frame is hidden
   and its `src` is deliberately not reassigned — re-assigning it restarts the
   page and a restart mid-block loses the block — so the trainer went on
   presenting trials, counting down and playing sound behind a menu nobody was
   training in front of.

   The shell already asserts the opposite. Its own session clock stops when the
   stage is hidden, and `home()` recounts the day on the stated grounds that
   returning to the hub is "a moment when nothing is being timed". That was true
   of the shell and false of the thing it was framing, which is the worst kind of
   wrong: the meter is the whole promise of this project, and it was crediting
   minutes spent reading a menu to whichever trainer happened to be open.

   ── Why a standard signal and not an injected one ──

   The rule at the top of `shell.js` is that the shell never injects script into
   a frame and never asks a trainer to report anything, because "a trainer that
   knows nothing about this page works here exactly as well as one that does".
   Reaching in to call somebody's `pause()` would break that outright — it is a
   per-app contract, nine of them, each one a line the shell can get wrong.

   So nothing is injected and nothing is called. What is delivered is the
   *browser's own* signal for this exact situation: the frame's document is made
   to report itself hidden, and `visibilitychange` is fired on it. A backgrounded
   tab has its timers clamped to roughly 1 Hz, so any trainer that keeps an
   honest clock already has to handle this — rnb pauses the block and says so on
   screen, synth stops its timer — and those two now pause behind the hub
   without one line added to either. The promise is kept rather than broken: a
   trainer that honours the standard API and knows nothing whatever about this
   page does the right thing here.

   A trainer that ignores visibility is no worse off than before. It keeps
   running, exactly as it did, until it opts in — and opting in is worth having
   on its own, since the same signal fires when its tab is backgrounded
   standalone.

   ── Why the shadowing is removed again ──

   The obvious version sets `hidden` to false on the way back, and that masks
   the real thing. `document.hidden` is a getter on the prototype; an own
   property shadows it, and an own property that answers "false" goes on
   answering false when the *browser* hides the tab for real — so a trainer
   would stop pausing on a genuine tab switch, which is the case the API exists
   for and the one rnb's clock depends on. Resuming therefore deletes the own
   properties rather than setting them, which uncovers the native getter and
   hands the frame back to the browser.
*/

var Pause = (function () {

  /** The two properties the Page Visibility API answers through. */
  var SHADOWED = ["hidden", "visibilityState"];

  /**
   * Tell the frame's document whether it is showing, as the browser would.
   *
   * Returns whether the signal was delivered, which is false whenever there is
   * no document to deliver it to — an empty frame, or one mid-navigation. That
   * is not an error and is not worth logging: `show()` sets the state again on
   * every open, and a freshly loaded document is visible already.
   */
  function setFrameHidden(frame, hidden) {
    var win, doc;
    /* Same-origin by construction, so this cannot throw in the shipped page.
       It is wrapped because a frame between documents is a real state and
       throwing out of a navigation handler would take the hub with it. */
    try {
      win = frame && frame.contentWindow;
      doc = frame && frame.contentDocument;
    } catch (e) { return false; }
    if (!win || !doc) return false;

    try {
      if (hidden) {
        Object.defineProperty(doc, "hidden", {
          configurable: true, get: function () { return true; },
        });
        Object.defineProperty(doc, "visibilityState", {
          configurable: true, get: function () { return "hidden"; },
        });
      } else {
        /* Uncovering the native getters, not overwriting them — see above. */
        for (var i = 0; i < SHADOWED.length; i++) {
          if (Object.prototype.hasOwnProperty.call(doc, SHADOWED[i])) {
            delete doc[SHADOWED[i]];
          }
        }
      }

      /* Built in the frame's own realm, so the event a listener there receives
         is the kind its own code expects. */
      doc.dispatchEvent(new win.Event("visibilitychange"));
      /*
       * And the focus pair, because not every trainer reaches for the
       * visibility API — some pause on losing focus, which is the same event
       * as far as the player is concerned. Cheap to send and nothing reacts
       * to it twice: a trainer that pauses on both is already idempotent
       * about it, since a real tab switch fires both too.
       */
      win.dispatchEvent(new win.Event(hidden ? "blur" : "focus"));
      return true;
    } catch (e) {
      /* Mid-navigation. The next open states it again. */
      return false;
    }
  }

  return { setFrameHidden: setFrameHidden };
})();

if (typeof module !== "undefined") module.exports = Pause;
