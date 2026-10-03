# A prompt for adding share-kit with an AI assistant

Paste everything in the box below into your coding assistant (Claude Code,
Cursor, Copilot, …) while it has your project open. Fill in the two lines
marked **FILL IN** first.

````text
Add an opt-in "Share your data" feature to this training tool using share-kit.

FILL IN — upload link: <your MEGA or Dropbox file-request URL>
FILL IN — app name (lowercase, digits, hyphens; e.g. "my-nback"): <name>

share-kit is one dependency-free, MIT-licensed JavaScript file:
  https://raw.githubusercontent.com/Project-Chimear-Hub/ChimeraHub/main/shared/share-kit/share-kit.js
Its README documents the file format and API:
  https://github.com/Project-Chimear-Hub/ChimeraHub/blob/main/shared/share-kit/README.md
A complete working example page:
  https://raw.githubusercontent.com/Project-Chimear-Hub/ChimeraHub/main/shared/share-kit/example.html

Do this:

1. Download share-kit.js into the project unchanged (keep its licence
   header) and load it the way this project loads other scripts. It exposes
   `window.ShareKit` in a browser and works with `require` in Node. Do not
   edit it; if the build needs a module wrapper, wrap it, don't rewrite it.

2. Find where this tool stores each answered item (localStorage, IndexedDB,
   a save file, …). Tell me what you found before writing the mapping.

3. Write one function, `collectShareAnswers()`, that reads that history and
   returns a list of objects in share-kit's shape:
     { app, mode, at, correct, seconds, level, premises, rungs, clock,
       presentation, timer, answerMode }
   - `app` is the name above; `mode` is the name a player sees for the mode.
   - `at` is when the item was answered, in milliseconds since the epoch.
     It is only used for ordering and the day; it is never written out.
   - `correct` is true/false, or 0..1 for partial credit, or null.
   - Use null for anything this tool does not record. Never invent or
     estimate a value to fill a field.
   - `presentation`, `timer` and `answerMode` are short codes of your choice
     (a-z, 0-9, hyphens, up to 20 characters); `rungs` is a list of short tags
     for modifiers an item carried. Leave them null/[] if there is no
     equivalent.
   - Do not add any other fields. share-kit drops unknown fields, and the
     collector rejects files that contain them.

4. Add a small "Share your data" section to the settings or menu, following
   the example page:
   - a sentence saying what the file contains (per answer: mode, difficulty,
     right/wrong, time taken, the day, a random participant id) and what it
     does not (no text the player typed or read, no settings, no time of
     day), and that deletion is done by quoting the participant id;
   - a consent checkbox, unticked by default, that enables the button;
   - a "Create my data file" button that calls
       const { file, skipped } = ShareKit.makeFile(collectShareAnswers(), { tool: "<app name>" });
     shows ShareKit.summary(file), and calls ShareKit.download(file) if
     file.answers > 0;
   - an "Upload" link to the upload URL above, opening in a new tab.

5. Rules that must hold:
   - The tool must make no network request for this feature. No fetch, no
     beacon, no embedded upload iframe that loads on page load. The only
     upload is the player following the link.
   - Nothing personal goes into the file: no names, emails, free text, or
     exact timestamps.
   - If storage is unavailable or the history is empty, show a message
     instead of failing.

6. Verify:
   - Run ShareKit.validate(file) on a file made from real or realistic
     history and show me the result; it must be { ok: true, errors: [] }.
   - Report how many answers were skipped and why, if any.
   - Show me the first three rows of the file so I can check the mapping.
````

## What to check afterwards

- Open a file the button made. Every row should have only the fields in the
  README's table, and nothing you wouldn't want public.
- `skipped` should be zero or explainable (usually mode names with unusual
  characters; rename them or map them to plain names).
- Turn your network off and use the tool. The share button should still work;
  only the Upload link needs a connection.
