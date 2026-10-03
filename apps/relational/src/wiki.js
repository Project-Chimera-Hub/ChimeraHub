import { SHAPES, RELATION_FAMILY_LABELS, RELATIONS } from './constants.js';
import { relationGuideData } from './symbols.js';
import { shapeSvg } from './geometry.js';

const MASTER_RULE = `
  <div class="key-rule">
    <h4>THE ONE RULE THAT DECODES EVERY ICON</h4>
    <p>An icon always shows <b>two different shapes</b>. Count their sides. The shape with
    <b>FEWER sides is the first term</b>; the shape with <b>MORE sides is the second term</b>.
    Then read the picture as a sentence: <b>first term → relation → second term</b>.</p>
    <p>Left versus right is randomised on every single draw and never means anything.
    Size, nesting and height are what carry the relation, and which shape gets the big role,
    the outer role or the higher role is decided <b>only</b> by side count.</p>
  </div>`;

export function renderWiki(container) {
  const guides = relationGuideData();
  container.innerHTML = `
    <section class="wiki-section">
      <h3>THE COMPARISON DIRECTION</h3>
      <div class="wiki-grid">
        <article class="wiki-card"><h4>One rule everywhere</h4><p><b>Remembered N-back = prompt(Current).</b> If the current sound is 7 and the prompt is -3, press Sound only when the digit N trials ago was 4.</p></article>
        <article class="wiki-card"><h4>Variable N</h4><p>With Variable N enabled, each scored trial can compare against a different distance between the chosen floor and your max N. The distance for the current trial is always printed directly above the grid.</p></article>
      </div>
    </section>

    <section class="wiki-section">
      <h3>RELATION ICONS · HOW TO READ THEM</h3>
      ${MASTER_RULE}
      <ol class="decision-list">
        <li><b>Count sides on both shapes.</b> Circle = 1, Triangle = 3, Square = 4, Pentagon = 5, Hexagon = 6. The two shapes are never the same, so one always has fewer sides than the other.</li>
        <li><b>Name the terms.</b> Fewer sides = first term. More sides = second term.</li>
        <li><b>Read the arrangement</b>, which tells you the family: same size stacked or side by side = equivalence, one drawn inside the other = containment, one clearly big and one clearly small = magnitude, diagonal overlap with one higher = sequence.</li>
        <li><b>Ask what the first term is doing.</b> Is it the outer or the inner shape? The big or the small one? The higher or the lower one? That answer picks the relation from its family.</li>
      </ol>
      <div class="wiki-grid" style="margin-top:14px">
        <article class="wiki-card"><h4>Why the first term is the fewer-sided shape</h4><p>It gives every icon one fixed subject without needing a marker, arrow or colour. It matches the bundled reference sheet at the bottom of this page, where the circle is the subject in all eight drawings.</p></article>
        <article class="wiki-card"><h4>The white outline is not part of the relation</h4><p>When the Shape stream is on, a <b>white outline</b> is drawn around the icon. That outline is the Shape stimulus and it has its own response button. Only the <b>yellow</b> shapes inside form the relation. An outline never counts as the container in Contains or Inside.</p></article>
      </div>
    </section>

    <section class="wiki-section">
      <h3>ALL EIGHT RELATIONS</h3>
      <div class="relation-grid">
        ${guides.map(relationEntry).join('')}
      </div>
    </section>

    <section class="wiki-section">
      <h3>FAMILIES AND INVERSES</h3>
      <table class="wiki-table"><thead><tr><th>FAMILY</th><th>MEMBERS</th><th>WHAT THE ICON LOOKS LIKE</th></tr></thead><tbody>
        <tr><td>Equivalence</td><td>Same, Opposite</td><td>Two shapes at the <b>same size</b>. Stacked on one centre = Same; held apart = Opposite.</td></tr>
        <tr><td>Containment</td><td>Contains, Inside</td><td>One shape drawn <b>inside</b> the other.</td></tr>
        <tr><td>Sequence</td><td>Leads to, Follows</td><td>Two equal shapes <b>overlapping diagonally</b>, one higher than the other.</td></tr>
        <tr><td>Magnitude</td><td>Greater, Less</td><td>Two shapes side by side, one <b>clearly big</b> and one <b>clearly small</b>.</td></tr>
      </tbody></table>
      <div class="wiki-grid" style="margin-top:10px">
        <article class="wiki-card"><h4>Relation prompts</h4><p><b>Same relation</b> asks for the exact same relation. <b>Inverse</b> asks for its inverse partner: Contains ↔ Inside, Leads to ↔ Follows, Greater ↔ Less. <b>Same family</b> asks only that both relations come from the same row of the table above.</p></article>
        <article class="wiki-card"><h4>Same and Opposite are their own inverses</h4><p>Same is the inverse of Same, and Opposite is the inverse of Opposite. Under an <b>Inverse</b> prompt they behave exactly like a <b>Same relation</b> prompt, and both always satisfy <b>Same family</b> against each other.</p></article>
      </div>
    </section>

    <section class="wiki-section">
      <h3>POSITION</h3>
      <table class="wiki-table"><thead><tr><th>PROMPT</th><th>TARGET CONDITION</th><th>MODES</th></tr></thead><tbody>
        <tr><td>North</td><td>N-back cell is one logical cell north of current.</td><td>2D + 3D</td></tr>
        <tr><td>South / East / West</td><td>Same rule in that logical direction.</td><td>2D + 3D</td></tr>
        <tr><td>Row</td><td>Same local Y row, different X.</td><td>2D + 3D</td></tr>
        <tr><td>Column</td><td>Same local X column, different Y.</td><td>2D + 3D</td></tr>
        <tr><td>Above / Below</td><td>N-back cell is ±1 on the cube-local Z axis.</td><td>3D only</td></tr>
      </tbody></table>
      <p class="helper-copy">Cube-local means camera rotation never changes the correct answer in 3D Rotating mode.</p>
    </section>

    <section class="wiki-section">
      <h3>SOUND · DIGITS 1–8</h3>
      <div class="wiki-grid">
        <article class="wiki-card"><h4>Pre-recorded clips</h4><p>Put your digit audio files in <code>assets/audio</code> named 1–8. The app looks for mp3, wav, ogg, then m4a, and warns on the setup screen if any are missing.</p></article>
        <article class="wiki-card"><h4>Before / After / ±x</h4><p>Before means the N-back digit is current − 1. After means current + 1. Signed offsets are only generated when the result stays inside 1–8.</p></article>
      </div>
    </section>

    <section class="wiki-section">
      <h3>SHAPE · SIDE VALUES</h3>
      <div class="symbol-row">
        ${SHAPES.map((shape) => `<div class="symbol-tile"><svg viewBox="0 0 120 120" role="img" aria-label="${shape.label}">${shapeSvg(shape.id, 60, 60, 44, 'stimulus-outline')}</svg><span>${shape.label} = ${shape.sides}</span></div>`).join('')}
      </div>
      <div class="wiki-grid" style="margin-top:10px">
        <article class="wiki-card"><h4>Fewer / More</h4><p>The remembered outer shape must have fewer or more sides than the current outer shape. The same side values drive the relation icons, so learning the table once covers both streams.</p></article>
        <article class="wiki-card"><h4>Shape pool</h4><p>You can disable shapes you do not want in the relation icons, but at least two must stay enabled. Fewer shapes makes side counting easier; five shapes makes it hardest.</p></article>
      </div>
    </section>

    <section class="wiki-section">
      <h3>REFERENCE SHEET</h3>
      <div class="wiki-card"><h4>The original guide, decoded</h4><p>This sheet uses only circle and square. Circle has 1 side and square has 4, so the <b>circle is always the first term</b>. Read every drawing as "circle &lt;relation&gt; square": circle contains square, circle is inside square, circle is greater than square, circle leads to square, and so on. The app follows exactly this convention with all five shapes.</p><img src="./assets/relations/relation-guide.png" alt="Relation icon guide" style="width:100%;border-radius:6px;border:1px solid #28282c;margin-top:10px"></div>
    </section>`;
}

export function renderRelationSheet(container) {
  const guides = relationGuideData();
  container.innerHTML = `
    <p class="hero-copy" style="font-size:13px;margin:0 0 12px">Count the sides. Fewer sides = first term, more sides = second term. Read the icon as first term → relation → second term. Left and right never matter.</p>
    <div class="sheet-grid">
      ${guides.map((guide) => `
        <div class="sheet-tile">
          ${guide.svg}
          <b>${guide.label}</b>
          <span>${escapeHtml(guide.rule)}</span>
        </div>`).join('')}
    </div>
    <p class="helper-copy">Inverse pairs: Contains ↔ Inside · Leads to ↔ Follows · Greater ↔ Less · Same ↔ Same · Opposite ↔ Opposite.</p>`;
}

function relationEntry(guide) {
  return `
    <article class="relation-entry">
      <div class="relation-art">${guide.svg}</div>
      <div>
        <h4>${guide.label}</h4>
        <span class="family-tag">${RELATION_FAMILY_LABELS[guide.family].toUpperCase()} · INVERSE: ${guide.inverse.toUpperCase()}</span>
        <p><b>Layout:</b> ${escapeHtml(guide.layout)}</p>
        <p><b>Rule:</b> ${escapeHtml(guide.rule)}</p>
        <div class="worked"><b>This icon:</b> ${escapeHtml(guide.reading.first)} versus ${escapeHtml(guide.reading.second)}, so the ${guide.firstLabel.toLowerCase()} is the first term and ${escapeHtml(guide.reading.role)} — which reads <b>${escapeHtml(guide.reading.sentence)}</b></div>
      </div>
    </article>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export { RELATIONS };
