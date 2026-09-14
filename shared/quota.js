"use strict";

/* ============================================================
   WHAT THE QUOTA COUNTS
   ============================================================

   The archive records what happened. This decides what it was worth. They are
   different questions and this file is the line between them — nothing here
   ever changes a record, and the archive never applies any of it.

   Two trainers are capped as a share of the day:

     synth   5%   grapheme–colour recall is too easy to be training
     cct    20%   useful, but never meant to be the bulk of it

   A cap is a share of the counted total, not of the raw one, which is the only
   formulation that does what it says. Capping against the raw total would let
   an hour of synth carry three minutes of credit and then let the next hour
   carry three more; capping against the counted total means a day made only of
   synth counts for nothing at all, because there is no uncapped training for
   its five percent to be five percent *of*.

   That is the intended behaviour, stated plainly: you cannot reach the quota on
   synth and CCT alone, however long you spend. With both at their ceiling they
   can supply a quarter of the day between them, and the other three quarters
   have to come from somewhere else.
*/

var QuotaPolicy = (function () {

  /* Fractions of the counted day. Anything absent is uncapped. */
  var DEFAULT_CAPS = { synth: 0.05, cct: 0.20 };

  /**
   * Apply the caps to one day's minutes.
   *
   * Returns `{ total, counted, raw, capped }` — `counted` is per source after
   * capping, `capped` names the sources a cap actually bit into, so the reason
   * a day is short can be shown rather than left to be worked out.
   *
   * The fixed point is found by iteration rather than algebra. With every cap
   * binding the closed form is T = uncapped / (1 - Σcaps), but caps only bind
   * sometimes — a source under its ceiling contributes all of itself and drops
   * out of the sum — and enumerating which subset binds is more code than
   * converging on it. Each pass can only lower a capped source, so this
   * descends monotonically to the answer.
   */
  function apply(bySource, caps) {
    caps = caps || DEFAULT_CAPS;

    var raw = {}, counted = {}, uncapped = 0, hasCap = false;
    for (var s in bySource) {
      if (!Object.prototype.hasOwnProperty.call(bySource, s)) continue;
      var m = Number(bySource[s]) || 0;
      if (m <= 0) continue;
      raw[s] = m;
      if (caps[s] > 0) { counted[s] = m; hasCap = true; }
      else uncapped += m;
    }

    if (!hasCap) {
      return { total: uncapped, counted: copy(raw), raw: raw, capped: [] };
    }

    for (var pass = 0; pass < 100; pass++) {
      var total = uncapped, moved = false;
      for (var c in counted) total += counted[c];
      for (var k in counted) {
        var ceiling = caps[k] * total;
        if (counted[k] > ceiling + 1e-9) { counted[k] = ceiling; moved = true; }
      }
      if (!moved) break;
    }

    var out = copy(counted), sum = uncapped, bit = [];
    for (var u in raw) if (!(u in counted)) out[u] = raw[u];
    for (var v in counted) {
      sum += counted[v];
      if (counted[v] < raw[v] - 1e-6) bit.push(v);
    }

    return { total: sum, counted: out, raw: raw, capped: bit };
  }

  function copy(o) {
    var n = {};
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) n[k] = o[k];
    return n;
  }

  /** A sentence for why a day counted less than it looks like it should. */
  function explain(result, caps) {
    caps = caps || DEFAULT_CAPS;
    if (!result.capped.length) return "";
    var parts = result.capped.map(function (s) {
      return s + " " + Math.round(caps[s] * 100) + "% (" +
        Math.round(result.raw[s]) + " min → " + Math.round(result.counted[s]) + ")";
    });
    return "Capped: " + parts.join(", ");
  }

  return { DEFAULT_CAPS: DEFAULT_CAPS, apply: apply, explain: explain };
})();

if (typeof module !== "undefined") module.exports = QuotaPolicy;
