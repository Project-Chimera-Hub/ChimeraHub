"use strict";

/* ============================================================
   THE CATALOG
   ============================================================

   Every trainer the hub offers, and the categories the menu sorts them into.
   This file is the one place either is written down: the shell renders the
   menu from it, the meter takes its filter from it, `tools/check-trainer.mjs`
   checks a submission's manifest against it, and test/run.js holds it to the
   apps that actually exist. Adding a trainer to the hub is adding an entry
   here — which is why CODEOWNERS puts this file in front of the hub's leaders.

   ── Categories ──

   The hub's home screen is laid out like a phone's: each category is a
   folder, in this order, and opening one shows the trainers inside as icons.
   A category can be empty; its folder still shows, with a way to submit a
   trainer for it, because an empty shelf says what the hub is looking for.

   ── Folders ──

   Folders inside a category's folder, boxes within boxes, for trainers that
   are variants of one idea. `parent` is the category (or another folder) it
   sits in.

   ── Trainers ──

   `id`         the archive's source name. It is how the meter finds a
                trainer's minutes, so it never changes once a trainer has
                history, even when the name on the card does (Threshold
                N-back is `precision`).
   `categories` what it trains. The first is its home: the folder it sits in
                on the hub, like an app on a phone, in one place only. Any
                after it say what else it trains, for the submission check
                and the data, and do not put a second copy on the screen.
   `folder`     optional: a folder inside its home category to sit in
                instead (see `folders`), for trainers that belong together.
   `counted`    true when an adapter reads its storage, so its time counts
                toward the day and the quota. False shows it on the menu with
                "Not counted" and a dashed edge. A trainer that writes the
                Chimera record format (shared/harness/FORMAT.md) is read by the
                archive's general adapter and can always be counted.
   `colour`     the dot on the card and its segment in the day's bar. Chosen
                to stay apart from every other entry's on a dark ground.
*/

var CATALOG = {
  categories: [
    { id: "rrt", name: "RRT", full: "Relational reasoning training",
      about: "Holding and combining relations: premises, orders, analogies." },
    { id: "nback", name: "N-back", full: "N-back",
      about: "Match what you see or hear to what came n steps before." },
    { id: "cct", name: "CCT", full: "Cognitive control training",
      about: "Paced arithmetic under time pressure, PASAT-style." },
    { id: "att", name: "ATT", full: "Attention training technique",
      about: "Selective, switching and divided attention." },
    { id: "mot", name: "MOT", full: "Multiple object tracking",
      about: "Follow several moving targets at once." },
    { id: "posner", name: "Posner", full: "Posner cueing",
      about: "Shift attention to a cued spot, and recover from a false cue." },
    { id: "spatial", name: "Spatial", full: "Mental rotation and spatial reasoning",
      about: "Rotate and compare shapes in your mind." },
    { id: "imagery", name: "Imagery", full: "Mental imagery",
      about: "See and hold images that aren't there." },
    { id: "inhibition", name: "Inhibition", full: "Inhibition and task switching",
      about: "Stroop, flanker, stop-signal and rule switching." },
    { id: "speed", name: "Speed", full: "Processing speed and useful field of view",
      about: "Take in more of a brief display, faster." },
    { id: "other", name: "Other", full: "Other",
      about: "Anything else." },
  ],

  folders: [
    { id: "relational-nback", name: "Relational N-back", parent: "rrt",
      about: "N-back over relations: streams of them, held n steps back." },
  ],

  trainers: [
    { id: "syllogimous", name: "Syllogimous", path: "syllogimous/", colour: "#d29922",
      categories: ["rrt"], counted: true,
      what: "Relational and syllogistic reasoning" },
    { id: "rrt", name: "Running Order", path: "rrt/", colour: "#c2e07a",
      categories: ["rrt"], counted: true,
      what: "Place each symbol, then name its rank" },
    { id: "rnb", name: "Relation Streams", path: "rnb/", colour: "#f778ba",
      categories: ["rrt", "nback"], folder: "relational-nback", counted: true,
      what: "N-back over relations, with a ladder" },
    { id: "relational", name: "Relational N-back", path: "relational/", colour: "#56d364",
      categories: ["rrt", "nback"], folder: "relational-nback", counted: true,
      what: "Four streams of relations, n back" },
    { id: "ewmt", name: "eWMT", path: "ewmt/", colour: "#ff7b72",
      categories: ["nback"], counted: true,
      what: "Affective n-back: position, colour and voice" },
    { id: "precision", name: "Threshold N-back", path: "precision/", colour: "#e6edf3",
      categories: ["nback"], counted: true,
      what: "N-back at the edge of perception" },
    { id: "quadbox", name: "N-back Constant Change", path: "more/quadbox/", colour: "#ffa657",
      categories: ["nback"], counted: false,
      what: "Quad n-back that keeps changing" },
    { id: "cct", name: "CCT", path: "cct/", colour: "#a371f7",
      categories: ["cct"], counted: true,
      what: "Spoken arithmetic against the clock" },
    { id: "chimera", name: "Chimera", path: "chimera/", colour: "#58a6ff",
      categories: ["cct", "nback"], counted: true,
      what: "Add the digits you hear, judge the number you see" },
    { id: "att", name: "Attention Training", path: "more/att/", colour: "#db6d9d",
      categories: ["att"], counted: false,
      what: "Attention training over a soundscape" },
    { id: "earshot", name: "Earshot", path: "more/earshot/", colour: "#56d4dd",
      categories: ["mot"], counted: false,
      what: "Track moving sounds by ear" },
  ],

  /* Where "submit one" goes. A link the player follows, not a request the
     page makes: the hub still sends nothing anywhere on its own. */
  submit: "https://github.com/Project-Chimera-Hub/ChimeraHub/issues/new?template=submit-trainer.yml",
};

if (typeof module !== "undefined") module.exports = CATALOG;
