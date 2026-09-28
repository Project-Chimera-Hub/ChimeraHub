export const SHAPES = [
  'square', 'circle', 'triangle', 'hexagon',
  'pentagon', 'star', 'diamond', 'cross',
  'arrow', 'heart', 'crescent', 'parallelogram',
];

export const COLORS = [
  '#EF4444', '#3B82F6', '#22C55E', '#EAB308',
  '#A855F7', '#F97316', '#EC4899', '#14B8A6',
  '#F43F5E', '#6366F1', '#84CC16', '#FB923C',
];

// ─── Relationship Categories ───────────────────────────────────────────────────
export const RELATIONSHIP_CATEGORIES = {
  SPATIAL: [
    'INSIDE', 'OVERLAPPING', 'TOUCHING',
    'ABOVE_BELOW', 'DIAGONAL', 'BETWEEN',
    'SURROUNDED', 'LEFT_RIGHT', 'STACKED',
    'NESTED_3', 'MIRRORED', 'SCATTERED',
  ],
  SPATIAL_3D: [
    'DEPTH_LAYERED', 'ORBITING', 'ROTATING_PAIR',
    'NESTED_VOLUME', 'ASCENDING_SPIRAL', 'COLLIDING',
    'REPELLING', 'BOUND_BY_GRAVITY', 'INTERSECTING_PLANES',
    'IN_FRONT_OF', 'BEHIND', 'STACKED_3D',
    'LEANING_AGAINST', 'FLOATING_ABOVE', 'CASTING_SHADOW',
  ],
  TRAIT: [
    'HOLLOW_VS_SOLID', 'ONE_SHARED_TRAIT', 'ROTATED',
    'CONNECTED', 'SAME_COLOR', 'SAME_SHAPE',
    'OPPOSITE_COLORS', 'SIZE_GRADIENT', 'BORDER_ONLY',
    'SHADOW_COPY', 'STRIPED', 'DASHED_OUTLINE',
  ],
  QUANT: [
    'SIZE_MISMATCH', 'ONE_TO_MANY', 'EQUAL_COUNT',
    'TWO_TO_ONE', 'PYRAMID', 'THREE_TO_ONE',
    'ONE_TO_FIVE', 'DECREASING_ROW', 'INCREASING_ROW',
    'BALANCED_SCALE',
  ],
  VERBAL: [
    // Semantic
    'SAME_AS', 'OPPOSITE_OF', 'PART_OF',
    'CAUSES', 'CONTAINS', 'BELONGS_TO',
    'DEFINES', 'REPLACES', 'NEGATES',
    'MATCHES', 'TRANSFORMS_INTO', 'DEPENDS_ON',
    // Comparison
    'BIGGER_THAN', 'SMALLER_THAN', 'MORE_THAN', 'LESS_THAN',
    'FASTER_THAN', 'SLOWER_THAN', 'HEAVIER_THAN', 'LIGHTER_THAN',
    'HOTTER_THAN', 'COLDER_THAN', 'LOUDER_THAN', 'SOFTER_THAN',
    'STRONGER_THAN', 'WEAKER_THAN', 'OLDER_THAN', 'NEWER_THAN',
    'HIGHER_THAN', 'LOWER_THAN', 'CLOSER_THAN', 'FURTHER_THAN',
    // Temporal
    'BEFORE', 'AFTER', 'FOLLOWS', 'PRECEDES',
    'EXCEEDS', 'MIRRORS',
    // Directional / spatial verbal
    'LEFT_OF', 'RIGHT_OF', 'ABOVE', 'BELOW',
    'NORTH_OF', 'SOUTH_OF', 'EAST_OF', 'WEST_OF',
    'NORTH_EAST_OF', 'NORTH_WEST_OF', 'SOUTH_EAST_OF', 'SOUTH_WEST_OF',
    'INSIDE_OF', 'OUTSIDE_OF', 'NEXT_TO', 'FAR_FROM',
  ],
  SOUND: [
    'PITCH_HIGHER', 'PITCH_LOWER', 'RHYTHM_FASTER', 'RHYTHM_SLOWER',
    'VOLUME_LOUDER', 'VOLUME_QUIETER',
    'DURATION_LONGER', 'DURATION_SHORTER',
    'TIMBRE_BRIGHT', 'TIMBRE_WARM',
  ],
  // Higher-complexity composite relations — players must scan multiple groups
  // and find the odd one out, rather than just compare two shapes.
  COMPLEX: [
    'THREE_PAIRS_ONE_DIFFERENT', 'FOUR_PAIRS_GRID',
    'TWO_OF_THREE_HOLLOW', 'ODD_COLOR_OUT', 'ODD_SHAPE_OUT',
  ],
};

export const RELATIONSHIPS = [
  ...RELATIONSHIP_CATEGORIES.SPATIAL,
  ...RELATIONSHIP_CATEGORIES.SPATIAL_3D,
  ...RELATIONSHIP_CATEGORIES.TRAIT,
  ...RELATIONSHIP_CATEGORIES.QUANT,
  ...RELATIONSHIP_CATEGORIES.VERBAL,
  ...RELATIONSHIP_CATEGORIES.SOUND,
];

export const TRANSITIVE_RELATIONSHIPS = [
  'BIGGER_THAN', 'SMALLER_THAN', 'MORE_THAN', 'LESS_THAN',
  'FASTER_THAN', 'SLOWER_THAN', 'HEAVIER_THAN', 'LIGHTER_THAN',
  'HOTTER_THAN', 'COLDER_THAN', 'LOUDER_THAN', 'SOFTER_THAN',
  'STRONGER_THAN', 'WEAKER_THAN', 'OLDER_THAN', 'NEWER_THAN',
  'HIGHER_THAN', 'LOWER_THAN', 'CLOSER_THAN', 'FURTHER_THAN',
  'BEFORE', 'AFTER', 'FOLLOWS', 'PRECEDES',
  'LEFT_OF', 'RIGHT_OF', 'ABOVE', 'BELOW',
  'NORTH_OF', 'SOUTH_OF', 'EAST_OF', 'WEST_OF',
  'PART_OF', 'CAUSES', 'CONTAINS', 'DEPENDS_ON', 'TRANSFORMS_INTO',
  // Complex composite relations chain symmetrically: if (A complexRel B) and
  // (B complexRel C), then (A complexRel C). Lets RINT generate visual targets
  // from complex stims alongside verbal ones, per Grapist's request.
  'THREE_PAIRS_ONE_DIFFERENT', 'FOUR_PAIRS_GRID',
  'TWO_OF_THREE_HOLLOW', 'ODD_COLOR_OUT', 'ODD_SHAPE_OUT',
];

export function filterTransitiveRelationships(rels, isRINTMode, isTypeMode) {
  if (!isRINTMode && !isTypeMode) return rels;
  const allowed = new Set(TRANSITIVE_RELATIONSHIPS);
  return rels.filter(r => allowed.has(r));
}

// ─── Form-class taxonomy (for analogy_nback) ──────────────────────────────────
// Groups relations by STRUCTURAL FORM, not by category. Two relations in the
// same form class are considered analogous: e.g. ABOVE_BELOW and STACKED both
// express a "directional asymmetric vertical" structure even though the
// surface visuals differ. Analogy n-back matches on form class, NOT on
// relation token — same-token across trials is treated as a non-target so
// the player is forced to discover the abstract form rather than identity-
// match. This is the Halford 4-place rung in visual form.
export const RELATION_FORM_CLASS = {
  // Asymmetric directional — one element dominates the other on some axis
  ABOVE_BELOW: 'asymmetric_directional',
  STACKED: 'asymmetric_directional',
  STACKED_3D: 'asymmetric_directional',
  FLOATING_ABOVE: 'asymmetric_directional',
  IN_FRONT_OF: 'asymmetric_directional',
  BEHIND: 'asymmetric_directional',
  LEFT_RIGHT: 'asymmetric_directional',
  DIAGONAL: 'asymmetric_directional',
  DEPTH_LAYERED: 'asymmetric_directional',
  CASTING_SHADOW: 'asymmetric_directional',
  LEANING_AGAINST: 'asymmetric_directional',
  BIGGER_THAN: 'asymmetric_directional',
  SMALLER_THAN: 'asymmetric_directional',
  MORE_THAN: 'asymmetric_directional',
  LESS_THAN: 'asymmetric_directional',
  FASTER_THAN: 'asymmetric_directional',
  SLOWER_THAN: 'asymmetric_directional',
  HEAVIER_THAN: 'asymmetric_directional',
  LIGHTER_THAN: 'asymmetric_directional',
  HOTTER_THAN: 'asymmetric_directional',
  COLDER_THAN: 'asymmetric_directional',
  LOUDER_THAN: 'asymmetric_directional',
  SOFTER_THAN: 'asymmetric_directional',
  STRONGER_THAN: 'asymmetric_directional',
  WEAKER_THAN: 'asymmetric_directional',
  OLDER_THAN: 'asymmetric_directional',
  NEWER_THAN: 'asymmetric_directional',
  HIGHER_THAN: 'asymmetric_directional',
  LOWER_THAN: 'asymmetric_directional',
  CLOSER_THAN: 'asymmetric_directional',
  FURTHER_THAN: 'asymmetric_directional',
  LEFT_OF: 'asymmetric_directional',
  RIGHT_OF: 'asymmetric_directional',
  ABOVE: 'asymmetric_directional',
  BELOW: 'asymmetric_directional',
  NORTH_OF: 'asymmetric_directional',
  SOUTH_OF: 'asymmetric_directional',
  EAST_OF: 'asymmetric_directional',
  WEST_OF: 'asymmetric_directional',
  NORTH_EAST_OF: 'asymmetric_directional',
  NORTH_WEST_OF: 'asymmetric_directional',
  SOUTH_EAST_OF: 'asymmetric_directional',
  SOUTH_WEST_OF: 'asymmetric_directional',
  BALANCED_SCALE: 'asymmetric_directional',
  PITCH_HIGHER: 'asymmetric_directional',
  PITCH_LOWER: 'asymmetric_directional',
  RHYTHM_FASTER: 'asymmetric_directional',
  RHYTHM_SLOWER: 'asymmetric_directional',
  VOLUME_LOUDER: 'asymmetric_directional',
  VOLUME_QUIETER: 'asymmetric_directional',
  DURATION_LONGER: 'asymmetric_directional',
  DURATION_SHORTER: 'asymmetric_directional',
  TIMBRE_BRIGHT: 'opposition',
  TIMBRE_WARM: 'opposition',

  // Containment — one element wholly inside another
  INSIDE: 'containment',
  SURROUNDED: 'containment',
  NESTED_3: 'containment',
  NESTED_VOLUME: 'containment',
  INSIDE_OF: 'containment',
  CONTAINS: 'containment',
  OUTSIDE_OF: 'containment',
  PART_OF: 'containment',
  BELONGS_TO: 'containment',

  // Symmetric proximity / contact — elements are close, touching, joined
  TOUCHING: 'symmetric_contact',
  OVERLAPPING: 'symmetric_contact',
  CONNECTED: 'symmetric_contact',
  COLLIDING: 'symmetric_contact',
  INTERSECTING_PLANES: 'symmetric_contact',
  NEXT_TO: 'symmetric_contact',
  BOUND_BY_GRAVITY: 'symmetric_contact',

  // Symmetric separation / repulsion
  REPELLING: 'symmetric_separation',
  SCATTERED: 'symmetric_separation',
  FAR_FROM: 'symmetric_separation',

  // Symmetric identity — elements share a trait / are duplicates
  SAME_COLOR: 'identity',
  SAME_SHAPE: 'identity',
  ONE_SHARED_TRAIT: 'identity',
  SAME_AS: 'identity',
  MIRRORED: 'identity',
  SHADOW_COPY: 'identity',
  EQUAL_COUNT: 'identity',
  MATCHES: 'identity',

  // Opposition / contrast
  HOLLOW_VS_SOLID: 'opposition',
  OPPOSITE_COLORS: 'opposition',
  OPPOSITE_OF: 'opposition',
  NEGATES: 'opposition',

  // Multiplicity asymmetric — counts differ across sides
  ONE_TO_MANY: 'multiplicity_asymmetric',
  TWO_TO_ONE: 'multiplicity_asymmetric',
  THREE_TO_ONE: 'multiplicity_asymmetric',
  ONE_TO_FIVE: 'multiplicity_asymmetric',
  SIZE_MISMATCH: 'multiplicity_asymmetric',
  PYRAMID: 'multiplicity_asymmetric',

  // Ordered sequence — a monotonic chain of elements
  INCREASING_ROW: 'ordered_sequence',
  DECREASING_ROW: 'ordered_sequence',
  SIZE_GRADIENT: 'ordered_sequence',
  ASCENDING_SPIRAL: 'ordered_sequence',
  ORBITING: 'ordered_sequence',
  ROTATING_PAIR: 'ordered_sequence',

  // Temporal ordered
  BEFORE: 'temporal_ordered',
  AFTER: 'temporal_ordered',
  FOLLOWS: 'temporal_ordered',
  PRECEDES: 'temporal_ordered',
  EXCEEDS: 'temporal_ordered',

  // Surface / trait modifiers (loose: shapes with surface modification)
  BORDER_ONLY: 'surface_modified',
  STRIPED: 'surface_modified',
  DASHED_OUTLINE: 'surface_modified',
  ROTATED: 'surface_modified',

  // Complex composite (scan-for-difference) — odd-one-out patterns
  THREE_PAIRS_ONE_DIFFERENT: 'complex_pattern',
  FOUR_PAIRS_GRID: 'complex_pattern',
  TWO_OF_THREE_HOLLOW: 'complex_pattern',
  ODD_COLOR_OUT: 'complex_pattern',
  ODD_SHAPE_OUT: 'complex_pattern',

  // Verbal transforms / dependencies — abstract logical relations
  CAUSES: 'transform_dependency',
  DEFINES: 'transform_dependency',
  REPLACES: 'transform_dependency',
  TRANSFORMS_INTO: 'transform_dependency',
  DEPENDS_ON: 'transform_dependency',
};

// Return the form class for a relation, or null if unknown.
export function getRelationFormClass(rel) {
  return RELATION_FORM_CLASS[rel] || null;
}

// Two relations are "analogous" iff they share a form class AND are not
// the same exact relation token. The same-token exclusion forces the player
// to abstract structural form rather than identity-match.
export function relationsAreAnalogous(relA, relB) {
  if (!relA || !relB) return false;
  if (relA === relB) return false;
  const a = RELATION_FORM_CLASS[relA];
  const b = RELATION_FORM_CLASS[relB];
  return !!a && a === b;
}

// For the HUD category label
export const CATEGORY_LABELS = {
  SPATIAL: 'Spatial',
  SPATIAL_3D: 'Spatial 3D',
  TRAIT: 'Trait',
  QUANT: 'Quantitative',
  VERBAL: 'Verbal',
  SOUND: 'Sound',
};

export function getCategory(relationship) {
  for (const [cat, members] of Object.entries(RELATIONSHIP_CATEGORIES)) {
    if (members.includes(relationship)) return cat;
  }
  return null;
}

// ─── Token Type System ─────────────────────────────────────────────────────────
// Token types for words in verbal stimuli
export const TOKEN_TYPES = ['meaningful', 'nonsense', 'garbage', 'emoji', 'voronoi_emoji', 'random_string', 'voronoi', 'scrap'];

// Meaningful words grouped by semantic field
const MEANINGFUL_POOLS = {
  objects:    ['sun','moon','fire','ice','wind','rain','stone','leaf','wave','root','dust','spark'],
  animals:    ['cat','dog','wolf','bear','fish','bird','ant','bee','fox','owl','elk','crab'],
  concepts:   ['light','dark','truth','void','mind','soul','time','code','law','myth','pain','joy'],
  spatial:    ['north','south','east','west','top','base','edge','core','peak','depth','front','side'],
  scale:      ['giant','dwarf','ocean','atom','city','grain','star','drop','blaze','trace','surge','wisp'],
};

function pickMeaningful() {
  const pools = Object.values(MEANINGFUL_POOLS);
  const pool = pools[Math.floor(Math.random() * pools.length)];
  return pool[Math.floor(Math.random() * pool.length)];
}

// Nonsense words (pronounceable but meaningless)
const NONSENSE_WORDS = [
  'fhy','iiy','tpy','zov','blim','quor','neth','vask','plox','driv',
  'keln','wurp','glax','sniv','trob','yeff','munk','daze','crul','spiv',
  'thon','wrix','flem','zupp','kraz','briv','nolp','skuv','drix','glab',
  'vorp','twex','slun','moph','crev','zink','blap','drox','guth','plev',
  'snork','wuft','krib','flox','zunt','meld','brix','criv','thub','yonk',
];

// Garbage words (random short letter strings, harder)
function makeGarbage(len = 3) {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// Emojis pool
const EMOJI_POOL = [
  '🔥','💧','🌊','⚡','🌀','❄️','🌙','☀️','⭐','🌈',
  '🍎','🍋','🍇','🌿','🌸','🌻','🍄','🦋','🐉','🦅',
  '🏔️','🌋','🏝️','🌙','🪐','💎','🔮','⚗️','🧲','🪄',
  '🐺','🦊','🐻','🦁','🐬','🦉','🐜','🦂','🐙','🦎',
  '🎯','🎲','🎭','🎪','🎨','🧩','🔑','🗝️','⚔️','🛡️',
  '👁️','🧠','💀','👾','🤖','👻','🌀','🔵','🔴','🟡',
];

// Voronoi-style emoji: abstract/geometric unicode symbols
const VORONOI_EMOJI_POOL = [
  '◈','◉','◊','◌','◍','◎','●','○','◐','◑','◒','◓',
  '▲','△','▴','▵','▶','▷','▸','▹','►','▻','▼','▽',
  '◆','◇','◈','❋','✦','✧','✩','✪','✫','✬','✭','✮',
  '⬡','⬢','⬣','⬟','⬠','⬡','⌬','⎔','⏣','⟁','⟐','⟡',
  '⬤','⭕','🔷','🔶','🔹','🔸','🔺','🔻','💠','🔘','🔳','🔲',
];


export const VORONOI_TOKEN_PREFIX = '\x00V:';
export function encodeVoronoiToken() {
  // encode a random seed into a sentinel string the renderer detects
  return VORONOI_TOKEN_PREFIX + Math.floor(Math.random() * 99991);
}

export const SCRAP_TOKEN_PREFIX = '\x00S:';
export function encodeScrapToken() {
  return SCRAP_TOKEN_PREFIX + Math.floor(Math.random() * 99991);
}

export function pickTokenWord(type, garbageLen = 3) {
  switch (type) {
    case 'meaningful':    return pickMeaningful();
    case 'nonsense':      return NONSENSE_WORDS[Math.floor(Math.random() * NONSENSE_WORDS.length)];
    case 'garbage':       return makeGarbage(garbageLen);
    case 'emoji':         return EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)];
    case 'voronoi_emoji': return VORONOI_EMOJI_POOL[Math.floor(Math.random() * VORONOI_EMOJI_POOL.length)];
    case 'random_string': return makeRandomString();
    case 'voronoi':       return encodeVoronoiToken();
    case 'scrap':         return encodeScrapToken();
    default:              return pickMeaningful();
  }
}

// Token type weights — can be overridden from the UI
let _tokenWeights = {
  meaningful:    20,
  emoji:         15,
  voronoi_emoji: 10,
  nonsense:      15,
  garbage:       15,
  random_string: 10,
  voronoi:       10,
  scrap:         15,
};

export function setTokenWeights(weights) {
  _tokenWeights = { ..._tokenWeights, ...weights };
}

export function getTokenWeights() {
  return { ..._tokenWeights };
}

// Pick a random token type using current weights
export function pickTokenType() {
  const entries = Object.entries(_tokenWeights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  if (total === 0) return 'meaningful';
  let r = Math.random() * total;
  for (const [type, w] of entries) {
    r -= w;
    if (r <= 0) return type;
  }
  return entries[entries.length - 1][0];
}

// Random uppercase/lowercase mixed string 4-6 chars — looks like a code token
export function makeRandomString(len) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const l = len || (4 + Math.floor(Math.random() * 3));
  let s = '';
  for (let i = 0; i < l; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// ─── Verbal word pools ─────────────────────────────────────────────────────────
const VERBAL_WORD_POOLS = {
  // Semantic
  SAME_AS:         [['sun','moon'],['hot','cold'],['fast','slow'],['cat','dog'],['fire','ice'],['up','down'],['open','close']],
  OPPOSITE_OF:     [['light','dark'],['loud','quiet'],['full','empty'],['sharp','dull'],['thick','thin'],['wet','dry'],['new','old']],
  PART_OF:         [['wheel','car'],['leaf','tree'],['key','keyboard'],['lens','eye'],['blade','sword'],['petal','flower'],['page','book']],
  CAUSES:          [['rain','flood'],['fire','smoke'],['wind','wave'],['heat','melt'],['impact','crater'],['spark','flame']],
  CONTAINS:        [['bag','stone'],['mind','thought'],['ocean','fish'],['sky','cloud'],['box','gift'],['forest','tree']],
  BELONGS_TO:      [['scale','fish'],['wing','bird'],['fin','shark'],['claw','bear'],['thorn','rose'],['root','plant']],
  DEFINES:         [['map','territory'],['word','meaning'],['law','rule'],['sign','signal'],['code','message']],
  REPLACES:        [['digital','analog'],['LED','bulb'],['email','letter'],['stream','disc'],['AI','manual']],
  NEGATES:         [['shadow','light'],['silence','noise'],['still','motion'],['void','mass'],['anti','pro']],
  MATCHES:         [['lock','key'],['plug','socket'],['question','answer'],['puzzle','piece'],['bow','arrow']],
  TRANSFORMS_INTO: [['caterpillar','butterfly'],['ice','water'],['coal','diamond'],['clay','pottery'],['dough','bread']],
  DEPENDS_ON:      [['flame','oxygen'],['life','water'],['plant','sunlight'],['sight','light'],['thought','mind']],
  // Comparison
  BIGGER_THAN:     [['ocean','lake'],['elephant','mouse'],['sun','star'],['mountain','hill'],['city','town'],['galaxy','planet']],
  SMALLER_THAN:    [['atom','cell'],['seed','fruit'],['pixel','screen'],['ant','bee'],['word','sentence'],['drop','wave']],
  MORE_THAN:       [['flood','drizzle'],['crowd','pair'],['forest','bush'],['army','squad'],['feast','snack']],
  LESS_THAN:       [['drop','ocean'],['spark','blaze'],['whisper','shout'],['seed','tree'],['penny','fortune']],
  FASTER_THAN:     [['light','sound'],['cheetah','turtle'],['jet','car'],['thought','speech'],['hawk','dove']],
  SLOWER_THAN:     [['snail','rabbit'],['glacier','river'],['sloth','cat'],['growth','change'],['walk','run']],
  HEAVIER_THAN:    [['iron','feather'],['boulder','pebble'],['whale','seal'],['lead','air'],['tank','boat']],
  LIGHTER_THAN:    [['feather','stone'],['foam','metal'],['air','water'],['leaf','brick'],['cloud','rock']],
  HOTTER_THAN:     [['sun','star'],['lava','steam'],['fire','smoke'],['desert','tundra'],['summer','winter']],
  COLDER_THAN:     [['ice','snow'],['space','earth'],['winter','autumn'],['arctic','tropics'],['freeze','chill']],
  LOUDER_THAN:     [['thunder','rain'],['explosion','pop'],['roar','whisper'],['storm','breeze'],['concert','hum']],
  SOFTER_THAN:     [['silk','wool'],['foam','wood'],['moss','bark'],['cloud','stone'],['down','cotton']],
  STRONGER_THAN:   [['steel','wood'],['titan','human'],['gravity','wind'],['flood','stream'],['storm','gust']],
  WEAKER_THAN:     [['reed','oak'],['mist','rain'],['echo','sound'],['ripple','wave'],['gust','gale']],
  OLDER_THAN:      [['stone','sand'],['star','planet'],['myth','story'],['fossil','bone'],['oak','sapling']],
  NEWER_THAN:      [['phone','book'],['LED','candle'],['stream','disc'],['drone','plane'],['app','program']],
  HIGHER_THAN:     [['cloud','hill'],['peak','base'],['sky','ground'],['orbit','flight'],['eagle','sparrow']],
  LOWER_THAN:      [['valley','peak'],['root','branch'],['sea','sky'],['mine','hill'],['depth','surface']],
  CLOSER_THAN:     [['moon','star'],['friend','stranger'],['wall','door'],['echo','source'],['shadow','self']],
  FURTHER_THAN:    [['star','moon'],['dream','goal'],['past','now'],['void','edge'],['distant','near']],
  // Temporal
  BEFORE:          [['dawn','dusk'],['seed','bloom'],['question','answer'],['cause','effect'],['birth','growth'],['winter','spring']],
  AFTER:           [['thunder','lightning'],['answer','question'],['effect','cause'],['harvest','planting'],['echo','sound']],
  FOLLOWS:         [['night','day'],['spring','winter'],['effect','cause'],['reply','message'],['landing','flight']],
  PRECEDES:        [['intro','chapter'],['root','branch'],['seed','sapling'],['sketch','painting'],['draft','final']],
  EXCEEDS:         [['storm','breeze'],['flood','drizzle'],['roar','whisper'],['blaze','spark'],['surge','trickle']],
  MIRRORS:         [['left','right'],['past','future'],['rise','fall'],['inhale','exhale'],['give','take']],
  // Directional
  LEFT_OF:         [['west','east'],['shadow','sun'],['moon','star'],['tail','head'],['back','front']],
  RIGHT_OF:        [['east','west'],['sun','shadow'],['star','moon'],['head','tail'],['front','back']],
  ABOVE:           [['cloud','ground'],['sky','sea'],['eagle','fish'],['star','peak'],['ceiling','floor']],
  BELOW:           [['root','trunk'],['ocean','sky'],['valley','peak'],['worm','bird'],['floor','ceiling']],
  NORTH_OF:        [['arctic','tropics'],['pole','equator'],['tundra','desert'],['glacier','jungle'],['snow','sand']],
  SOUTH_OF:        [['tropics','arctic'],['equator','pole'],['desert','tundra'],['jungle','glacier'],['sand','snow']],
  EAST_OF:         [['sunrise','sunset'],['dawn','dusk'],['orient','occident'],['morning','evening']],
  WEST_OF:         [['sunset','sunrise'],['dusk','dawn'],['occident','orient'],['evening','morning']],
  NORTH_EAST_OF:   [['peak','valley'],['star','root'],['sky','ground'],['ice','fire'],['summit','base']],
  NORTH_WEST_OF:   [['tundra','jungle'],['snow','heat'],['cold','warm'],['night','day'],['frost','bloom']],
  SOUTH_EAST_OF:   [['shore','cliff'],['sand','rock'],['warm','cold'],['day','night'],['bloom','frost']],
  SOUTH_WEST_OF:   [['desert','forest'],['heat','cold'],['dry','wet'],['dust','rain'],['fire','ice']],
  INSIDE_OF:       [['core','shell'],['seed','fruit'],['yolk','egg'],['thought','mind'],['fire','torch']],
  OUTSIDE_OF:      [['skin','bone'],['bark','wood'],['shell','core'],['wind','wall'],['echo','cave']],
  NEXT_TO:         [['shadow','self'],['tide','shore'],['moon','earth'],['echo','source'],['twin','twin']],
  FAR_FROM:        [['void','center'],['star','home'],['exile','origin'],['echo','source'],['dream','now']],
};

export function getVerbalPair(relationship) {
  const pool = VERBAL_WORD_POOLS[relationship];
  if (!pool) return ['A', 'B'];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Inverse relationship map ──────────────────────────────────────────────────
// Maps a relationship to its semantic inverse. If A rel B matches, then B inv(rel) A
// is an equivalent stimulus. Both should count as the same N-back target.
export const INVERSE_RELATIONSHIP = {
  // Comparison pairs
  BIGGER_THAN:    'SMALLER_THAN',
  SMALLER_THAN:   'BIGGER_THAN',
  MORE_THAN:      'LESS_THAN',
  LESS_THAN:      'MORE_THAN',
  FASTER_THAN:    'SLOWER_THAN',
  SLOWER_THAN:    'FASTER_THAN',
  HEAVIER_THAN:   'LIGHTER_THAN',
  LIGHTER_THAN:   'HEAVIER_THAN',
  HOTTER_THAN:    'COLDER_THAN',
  COLDER_THAN:    'HOTTER_THAN',
  LOUDER_THAN:    'SOFTER_THAN',
  SOFTER_THAN:    'LOUDER_THAN',
  STRONGER_THAN:  'WEAKER_THAN',
  WEAKER_THAN:    'STRONGER_THAN',
  OLDER_THAN:     'NEWER_THAN',
  NEWER_THAN:     'OLDER_THAN',
  HIGHER_THAN:    'LOWER_THAN',
  LOWER_THAN:     'HIGHER_THAN',
  CLOSER_THAN:    'FURTHER_THAN',
  FURTHER_THAN:   'CLOSER_THAN',
  // Temporal
  BEFORE:         'AFTER',
  AFTER:          'BEFORE',
  FOLLOWS:        'PRECEDES',
  PRECEDES:       'FOLLOWS',
  // Directional
  LEFT_OF:        'RIGHT_OF',
  RIGHT_OF:       'LEFT_OF',
  ABOVE:          'BELOW',
  BELOW:          'ABOVE',
  NORTH_OF:       'SOUTH_OF',
  SOUTH_OF:       'NORTH_OF',
  EAST_OF:        'WEST_OF',
  WEST_OF:        'EAST_OF',
  NORTH_EAST_OF:  'SOUTH_WEST_OF',
  SOUTH_WEST_OF:  'NORTH_EAST_OF',
  NORTH_WEST_OF:  'SOUTH_EAST_OF',
  SOUTH_EAST_OF:  'NORTH_WEST_OF',
  INSIDE_OF:      'OUTSIDE_OF',
  OUTSIDE_OF:     'INSIDE_OF',
  // Semantic inverses (commutative / reversible)
  SAME_AS:        'SAME_AS',      // symmetric
  OPPOSITE_OF:    'OPPOSITE_OF',  // symmetric
  MATCHES:        'MATCHES',      // symmetric
  MIRRORS:        'MIRRORS',      // symmetric
  NEXT_TO:        'NEXT_TO',      // symmetric
  CAUSES:         'DEPENDS_ON',
  DEPENDS_ON:     'CAUSES',
  CONTAINS:       'PART_OF',
  PART_OF:        'CONTAINS',
  BELONGS_TO:     'CONTAINS',
  // Sound pairs — all asymmetric/inverse-able
  PITCH_HIGHER:     'PITCH_LOWER',
  PITCH_LOWER:      'PITCH_HIGHER',
  RHYTHM_FASTER:    'RHYTHM_SLOWER',
  RHYTHM_SLOWER:    'RHYTHM_FASTER',
  VOLUME_LOUDER:    'VOLUME_QUIETER',
  VOLUME_QUIETER:   'VOLUME_LOUDER',
  DURATION_LONGER:  'DURATION_SHORTER',
  DURATION_SHORTER: 'DURATION_LONGER',
  TIMBRE_BRIGHT:    'TIMBRE_WARM',
  TIMBRE_WARM:      'TIMBRE_BRIGHT',
};

// Given a relationship and its [wordA, wordB], produce the inverted form:
// inverted rel = INVERSE_RELATIONSHIP[rel], and swap the words.
// Returns { rel, wordA, wordB } or null if no inverse defined.
export function makeInverseStimulus(stimulus) {
  const inv = INVERSE_RELATIONSHIP[stimulus.rel];
  if (!inv) return null;
  return {
    ...stimulus,
    rel: inv,
    wordA: stimulus.wordB,
    wordB: stimulus.wordA,
    // renderMode stays the same so layout is identical but words/rel flip
  };
}

// ─── Template phrases for verbal display ──────────────────────────────────────
export const VERBAL_TEMPLATES_NORMAL = {
  // Semantic
  SAME_AS:          ([a, b]) => [a, `is same as`, b],
  OPPOSITE_OF:      ([a, b]) => [a, `is opposite to`, b],
  PART_OF:          ([a, b]) => [a, `is part of`, b],
  CAUSES:           ([a, b]) => [a, `causes`, b],
  CONTAINS:         ([a, b]) => [a, `contains`, b],
  BELONGS_TO:       ([a, b]) => [a, `belongs to`, b],
  DEFINES:          ([a, b]) => [a, `defines`, b],
  REPLACES:         ([a, b]) => [a, `replaces`, b],
  NEGATES:          ([a, b]) => [a, `negates`, b],
  MATCHES:          ([a, b]) => [a, `matches`, b],
  TRANSFORMS_INTO:  ([a, b]) => [a, `transforms into`, b],
  DEPENDS_ON:       ([a, b]) => [a, `depends on`, b],
  // Comparison
  BIGGER_THAN:      ([a, b]) => [a, `is bigger than`, b],
  SMALLER_THAN:     ([a, b]) => [a, `is smaller than`, b],
  MORE_THAN:        ([a, b]) => [a, `has more than`, b],
  LESS_THAN:        ([a, b]) => [a, `has less than`, b],
  FASTER_THAN:      ([a, b]) => [a, `is faster than`, b],
  SLOWER_THAN:      ([a, b]) => [a, `is slower than`, b],
  HEAVIER_THAN:     ([a, b]) => [a, `is heavier than`, b],
  LIGHTER_THAN:     ([a, b]) => [a, `is lighter than`, b],
  HOTTER_THAN:      ([a, b]) => [a, `is hotter than`, b],
  COLDER_THAN:      ([a, b]) => [a, `is colder than`, b],
  LOUDER_THAN:      ([a, b]) => [a, `is louder than`, b],
  SOFTER_THAN:      ([a, b]) => [a, `is softer than`, b],
  STRONGER_THAN:    ([a, b]) => [a, `is stronger than`, b],
  WEAKER_THAN:      ([a, b]) => [a, `is weaker than`, b],
  OLDER_THAN:       ([a, b]) => [a, `is older than`, b],
  NEWER_THAN:       ([a, b]) => [a, `is newer than`, b],
  HIGHER_THAN:      ([a, b]) => [a, `is higher than`, b],
  LOWER_THAN:       ([a, b]) => [a, `is lower than`, b],
  CLOSER_THAN:      ([a, b]) => [a, `is closer than`, b],
  FURTHER_THAN:     ([a, b]) => [a, `is further than`, b],
  // Temporal
  BEFORE:           ([a, b]) => [a, `occurs before`, b],
  AFTER:            ([a, b]) => [a, `occurs after`, b],
  FOLLOWS:          ([a, b]) => [a, `follows`, b],
  PRECEDES:         ([a, b]) => [a, `precedes`, b],
  EXCEEDS:          ([a, b]) => [a, `exceeds`, b],
  MIRRORS:          ([a, b]) => [a, `mirrors`, b],
  // Directional
  LEFT_OF:          ([a, b]) => [a, `is left of`, b],
  RIGHT_OF:         ([a, b]) => [a, `is right of`, b],
  ABOVE:            ([a, b]) => [a, `is above`, b],
  BELOW:            ([a, b]) => [a, `is below`, b],
  NORTH_OF:         ([a, b]) => [a, `is north of`, b],
  SOUTH_OF:         ([a, b]) => [a, `is south of`, b],
  EAST_OF:          ([a, b]) => [a, `is east of`, b],
  WEST_OF:          ([a, b]) => [a, `is west of`, b],
  NORTH_EAST_OF:    ([a, b]) => [a, `is northeast of`, b],
  NORTH_WEST_OF:    ([a, b]) => [a, `is northwest of`, b],
  SOUTH_EAST_OF:    ([a, b]) => [a, `is southeast of`, b],
  SOUTH_WEST_OF:    ([a, b]) => [a, `is southwest of`, b],
  INSIDE_OF:        ([a, b]) => [a, `is inside`, b],
  OUTSIDE_OF:       ([a, b]) => [a, `is outside`, b],
  NEXT_TO:          ([a, b]) => [a, `is next to`, b],
  FAR_FROM:         ([a, b]) => [a, `is far from`, b],
};

export const VERBAL_TEMPLATES_MINIMAL = {
  // Semantic
  SAME_AS:          ([a, b]) => [a, `=`, b],
  OPPOSITE_OF:      ([a, b]) => [a, `≠`, b],
  PART_OF:          ([a, b]) => [a, `⊂`, b],
  CAUSES:           ([a, b]) => [a, `⇒`, b],
  CONTAINS:         ([a, b]) => [a, `⊃`, b],
  BELONGS_TO:       ([a, b]) => [a, `∈`, b],
  DEFINES:          ([a, b]) => [a, `≡`, b],
  REPLACES:         ([a, b]) => [a, `⇌`, b],
  NEGATES:          ([a, b]) => [a, `¬`, b],
  MATCHES:          ([a, b]) => [a, `≈`, b],
  TRANSFORMS_INTO:  ([a, b]) => [a, `→`, b],
  DEPENDS_ON:       ([a, b]) => [a, `∝`, b],
  // Comparison
  BIGGER_THAN:      ([a, b]) => [a, `>`, b],
  SMALLER_THAN:     ([a, b]) => [a, `<`, b],
  MORE_THAN:        ([a, b]) => [a, `+`, b],
  LESS_THAN:        ([a, b]) => [a, `-`, b],
  FASTER_THAN:      ([a, b]) => [a, `»`, b],
  SLOWER_THAN:      ([a, b]) => [a, `«`, b],
  HEAVIER_THAN:     ([a, b]) => [a, `▲`, b],
  LIGHTER_THAN:     ([a, b]) => [a, `▼`, b],
  HOTTER_THAN:      ([a, b]) => [a, `🔥`, b],
  COLDER_THAN:      ([a, b]) => [a, `❄`, b],
  LOUDER_THAN:      ([a, b]) => [a, `🔊`, b],
  SOFTER_THAN:      ([a, b]) => [a, `🔈`, b],
  STRONGER_THAN:    ([a, b]) => [a, `💪`, b],
  WEAKER_THAN:      ([a, b]) => [a, `🩹`, b],
  OLDER_THAN:       ([a, b]) => [a, `⏳`, b],
  NEWER_THAN:       ([a, b]) => [a, `✨`, b],
  HIGHER_THAN:      ([a, b]) => [a, `↑`, b],
  LOWER_THAN:       ([a, b]) => [a, `↓`, b],
  CLOSER_THAN:      ([a, b]) => [a, `•·•`, b],
  FURTHER_THAN:     ([a, b]) => [a, `•   •`, b],
  // Temporal
  BEFORE:           ([a, b]) => [a, `t <`, b],
  AFTER:            ([a, b]) => [a, `t >`, b],
  FOLLOWS:          ([a, b]) => [a, `⊏`, b],
  PRECEDES:         ([a, b]) => [a, `⊐`, b],
  EXCEEDS:          ([a, b]) => [a, `>`, b],
  MIRRORS:          ([a, b]) => [a, `⧓`, b],
  // Directional
  LEFT_OF:          ([a, b]) => [a, `←`, b],
  RIGHT_OF:         ([a, b]) => [a, `→`, b],
  ABOVE:            ([a, b]) => [a, `↑`, b],
  BELOW:            ([a, b]) => [a, `↓`, b],
  NORTH_OF:         ([a, b]) => [a, `↑`, b],
  SOUTH_OF:         ([a, b]) => [a, `↓`, b],
  EAST_OF:          ([a, b]) => [a, `→`, b],
  WEST_OF:          ([a, b]) => [a, `←`, b],
  NORTH_EAST_OF:    ([a, b]) => [a, `↗`, b],
  NORTH_WEST_OF:    ([a, b]) => [a, `↖`, b],
  SOUTH_EAST_OF:    ([a, b]) => [a, `↘`, b],
  SOUTH_WEST_OF:    ([a, b]) => [a, `↙`, b],
  INSIDE_OF:        ([a, b]) => [a, `⊚`, b],
  OUTSIDE_OF:       ([a, b]) => [a, `⊙`, b],
  NEXT_TO:          ([a, b]) => [a, `‖`, b],
  FAR_FROM:         ([a, b]) => [a, `↔`, b],
};

export function buildVerbalDisplay(relationship, pair, relationSymbolMode = 'normal') {
  const templates = relationSymbolMode === 'minimal' ? VERBAL_TEMPLATES_MINIMAL : VERBAL_TEMPLATES_NORMAL;
  const fn = templates[relationship];
  if (!fn) return [pair[0], relationship.replace(/_/g,' '), pair[1]];
  return fn(pair);
}

export const isVerbal = (rel) => RELATIONSHIP_CATEGORIES.VERBAL.includes(rel);
export const isSound = (rel) => RELATIONSHIP_CATEGORIES.SOUND.includes(rel);

const SOUND_WORDS = ['alpha', 'bravo', 'delta', 'echo', 'nova', 'pulse', 'signal', 'vector'];
const SOUND_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'K', 'M', 'R', 'T'];
const SOUND_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function getSoundPair(relationship) {
  if (relationship.includes('WORD')) {
    const a = pickRandom(SOUND_WORDS);
    const b = relationship.includes('SAME') ? a : pickRandomExcluding(SOUND_WORDS, a);
    return [a, b];
  }
  if (relationship.includes('LETTER')) {
    const a = pickRandom(SOUND_LETTERS);
    const b = relationship.includes('SAME') ? a : pickRandomExcluding(SOUND_LETTERS, a);
    return [a, b];
  }
  if (relationship.includes('NUMBER')) {
    const a = pickRandom(SOUND_NUMBERS);
    const candidates = relationship === 'SOUND_HIGHER_NUMBER'
      ? SOUND_NUMBERS.filter(n => n < a)
      : SOUND_NUMBERS.filter(n => n > a);
    const b = pickRandom(candidates.length ? candidates : SOUND_NUMBERS.filter(n => n !== a));
    return [String(a), String(b)];
  }
  return ['tone A', 'tone B'];
}

export function buildSoundDisplay(relationship, pair) {
  const [a, b] = pair;
  const labels = {
    PITCH_HIGHER: [a, 'higher pitch than', b],
    PITCH_LOWER: [a, 'lower pitch than', b],
    RHYTHM_FASTER: ['fast', 'rhythm', 'beat'],
    RHYTHM_SLOWER: ['slow', 'rhythm', 'beat'],
    VOLUME_LOUDER: [a, 'louder than', b],
    VOLUME_QUIETER: [a, 'quieter than', b],
    DURATION_LONGER: [a, 'longer than', b],
    DURATION_SHORTER: [a, 'shorter than', b],
    TIMBRE_BRIGHT: ['bright', 'timbre', 'pure'],
    TIMBRE_WARM: ['warm', 'timbre', 'pure'],
    SOUND_SAME_WORD: [a, 'same spoken word as', b],
    SOUND_DIFFERENT_WORD: [a, 'different word from', b],
    SOUND_SAME_LETTER: [a, 'same letter as', b],
    SOUND_DIFFERENT_LETTER: [a, 'different letter from', b],
    SOUND_HIGHER_NUMBER: [a, 'higher number than', b],
    SOUND_LOWER_NUMBER: [a, 'lower number than', b],
  };
  return labels[relationship] || [a, relationship.replace(/_/g, ' ').toLowerCase(), b];
}

// ─── Timing & probability constants ───────────────────────────────────────────
export const MATCH_CHANCE = 0.3;
export const DUAL_MATCH_CHANCE = 0.25;
export const HIER_MATCH_CHANCE = 0.25;
export const DISTRACTOR_CHANCE = 0.15;
// Fraction of non-target trials that become a "near-miss" lure — a stim
// matching the N±1 position. The careful player counts properly and rejects;
// the loose counter false-alarms. Tracked separately in stats.
export const LURE_RATE = 0.22;
// Per-trial probability of negating the displayed relation when the
// 'negation' mode is on. The renderer overlays a ¬ badge; the engine
// compares (rel, negated) as a tuple for n-back matches.
export const NEGATION_RATE = 0.30;
// RST overlay schedule — fraction of trials that carry a Syllogimous
// premise/conclusion side-task (only when 'rst_overlay' mode is on).
export const RST_OVERLAY_RATE = 0.25;
export const TOTAL_ROUNDS = 20;
export const STIMULUS_DURATION = 2800;
export const WIPE_DURATION = 500;
export const FEEDBACK_DURATION = 400;

export const ADAPT_UP_THRESHOLD = 80;
export const ADAPT_DOWN_THRESHOLD = 50;
export const N_MIN = 1;
export const N_MAX = 20;

// ─── Helpers ───────────────────────────────────────────────────────────────────
export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function pickRandomExcluding(arr, ...excludes) {
  const filtered = arr.filter(item => !excludes.includes(item));
  if (filtered.length === 0) return arr[Math.floor(Math.random() * arr.length)];
  return filtered[Math.floor(Math.random() * filtered.length)];
}

export function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

// ─── Trajectory N-Back (Successor Representation training) ──────────────────
// TJN is a graph-based n-back: each trial = a node visited during a random
// walk over a session-generated graph. The target rule depends on tier, and
// some tiers force the player to internalize the graph topology (map fading).
//
// Map fading: for the first TJN_LEARN_TRIALS, the graph edges are rendered
// so the player learns the topology. After that, edges fade out — the
// player must recall the structure from memory to evaluate targets. Without
// fading, the task becomes visual edge-checking, not successor learning.
export const TJN_NODE_REL = 'TJN_NODE';
export const TJN_LEARN_TRIALS = 6;
export const TJN_DEFAULT_NODES = 6;
export const TJN_DEFAULT_TOPOLOGY = 'small_world';
export const TJN_DEFAULT_TIER = 'easy';
export const TJN_HARD_K = 2; // K-step successor horizon for the Hard tier

export const TJN_TIERS = ['easy', 'medium', 'hard', 'extreme'];
export const TJN_TIER_META = {
  easy:    { label: 'Easy',    desc: 'Same node as N-back (pure WM on positions)' },
  medium: { label: 'Medium',  desc: 'Current is a neighbour of N-back (needs edge memory)' },
  hard:    { label: 'Hard',    desc: 'Current is a valid K-step successor of N-back (predictive map)' },
  extreme: { label: 'Extreme', desc: 'Current lies on the shortest path from N-back to the goal (revaluation)' },
};

export const TJN_TOPOLOGY_LABELS = {
  ring:        'Ring (cycle)',
  small_world: 'Ring + Shortcuts (small-world)',
  tree:        'Tree (hierarchical)',
  lattice:     'Lattice (grid)',
  random:      'Random (Erdős–Rényi)',
};

export const COACH_PHASES = [
  {
    title: "Classic N-1 Warm-up",
    difficulty: 0.5,
    nLevel: 1,
    speedMs: 3600,
    rounds: 18,
    modes: ['feedback_per_trial'],
    desc: "Practice basic single-item focus at N=1. Matches visual and acoustic targets one turn back with direct training feedback.",
    streamsCount: 1
  },
  {
    title: "Classic Switch Gym",
    difficulty: 0.8,
    nLevel: 1,
    speedMs: 3300,
    rounds: 20,
    modes: ['feedback_per_trial', 'distractors'],
    desc: "Introduces switching selective attention focus between location cues and sound prompts at a warm-up pace.",
    streamsCount: 1
  },
  {
    title: "Classic Bind Foundation",
    difficulty: 1.0,
    nLevel: 1,
    speedMs: 3000,
    rounds: 20,
    modes: ['feedback_per_trial', 'distractors', 'cct'],
    desc: "Introduces simple cognitive control and basic binding tasks to establish strong executive focus at N=1.",
    streamsCount: 1
  },
  {
    title: "Classic Resist Training",
    difficulty: 1.5,
    nLevel: 2,
    speedMs: 3300,
    rounds: 20,
    modes: ['feedback_per_trial'],
    desc: "Step up to N=2 at a slow pace. Establishes the foundations of relational capacity capacity mapping without stressors.",
    streamsCount: 1
  },
  {
    title: "Foundational Focus",
    difficulty: 1.5,
    nLevel: 2,
    speedMs: 3200,
    rounds: 20,
    modes: ['feedback_per_trial'],
    desc: "Focus on simple relational matching with per-trial diagnostic feedback.",
    streamsCount: 1
  },
  {
    title: "Selective Attention",
    difficulty: 2.0,
    nLevel: 2,
    speedMs: 3000,
    rounds: 20,
    modes: ['feedback_per_trial', 'distractors'],
    desc: "Introduces near-match distractors to test your selective visual filtering.",
    streamsCount: 1
  },
  {
    title: "Interference Inoculation",
    difficulty: 2.5,
    nLevel: 2,
    speedMs: 2800,
    rounds: 22,
    modes: ['feedback_per_trial', 'distractors', 'lures'],
    desc: "Introduces N-1 or N+1 lure trials to challenge loose counter habits.",
    streamsCount: 1
  },
  {
    title: "Logical Inversion",
    difficulty: 3.0,
    nLevel: 2,
    speedMs: 2600,
    rounds: 24,
    modes: ['feedback_per_trial', 'distractors', 'lures', 'negation'],
    desc: "Introduces negation flags (¬) that flip relations to their logical opposite.",
    streamsCount: 1
  },
  {
    title: "Cognitive Control",
    difficulty: 3.0,
    nLevel: 2,
    speedMs: 2600,
    rounds: 25,
    modes: ['distractors', 'lures', 'negation', 'cct'],
    desc: "Replaces shape relations with pure Cognitive Control arithmetic n-back.",
    streamsCount: 1
  },
  {
    title: "Mathematical Dual-Tasking",
    difficulty: 3.5,
    nLevel: 2,
    speedMs: 2600,
    rounds: 25,
    modes: ['distractors', 'lures', 'negation', 'cct_overlay'],
    desc: "Layers CCT calculation as a separate key axis alongside relational matching.",
    streamsCount: 1
  },
  {
    title: "Deductive Integration",
    difficulty: 3.5,
    nLevel: 2,
    speedMs: 2400,
    rounds: 25,
    modes: ['distractors', 'lures', 'negation', 'rst_overlay'],
    rstDifficulty: 'easy',
    desc: "Layers Syllogistic Deductive Reasoning (RST) premises and conclusions. Easy difficulty: same/opposite parity chain.",
    streamsCount: 1
  },
  {
    title: "Closed-Loop Regulation",
    difficulty: 4.0,
    nLevel: 2,
    speedMs: 2400,
    rounds: 26,
    modes: ['distractors', 'lures', 'negation', 'rst_overlay', 'adaptive_closed_loop'],
    rstDifficulty: 'easy',
    desc: "Engages closed-loop adaptivity that speeds up or slows down per-trial.",
    streamsCount: 1
  },
  {
    title: "Semantic Memory Queue",
    difficulty: 4.5,
    nLevel: 2,
    speedMs: 2200,
    rounds: 26,
    modes: ['distractors', 'lures', 'negation', 'rst_overlay', 'adaptive_closed_loop', 'type_nback'],
    rstDifficulty: 'medium',
    desc: "Matches stimuli by relationship category history instead of distance. RST now draws from Comparison family too (transitive order).",
    streamsCount: 1
  },
  {
    title: "Relational Chaining",
    difficulty: 5.0,
    nLevel: 2,
    speedMs: 2200,
    rounds: 28,
    modes: ['distractors', 'lures', 'negation', 'rst_overlay', 'adaptive_closed_loop', 'rint'],
    rstDifficulty: 'medium',
    desc: "Uses Relational Integration to logically chain comparisons over N trials.",
    streamsCount: 1
  },
  {
    title: "Cross-Modal Union",
    difficulty: 5.5,
    nLevel: 2,
    speedMs: 2000,
    rounds: 28,
    modes: ['distractors', 'lures', 'negation', 'adaptive_closed_loop', 'nonverbal_rint'],
    desc: "Tests cross-modal subset-unions across up to 14 binary attributes (8 visual + 6 audio). Each audio cue fires in its own time slot so multiple layer cleanly per trial.",
    streamsCount: 1
  },
  {
    title: "Rule Flexibility",
    difficulty: 5.5,
    nLevel: 2,
    speedMs: 2000,
    rounds: 30,
    modes: ['distractors', 'lures', 'negation', 'adaptive_closed_loop', 'mixed_nback'],
    desc: "Randomly switches matching rules (Normal vs Type) on every trial.",
    streamsCount: 1
  },
  {
    title: "Cognitive Set-Shifting",
    difficulty: 6.0,
    nLevel: 2,
    speedMs: 1800,
    rounds: 30,
    modes: ['distractors', 'lures', 'negation', 'adaptive_closed_loop', 'wrapper_morph'],
    desc: "Shifts visual card themes and stimulus category pools in coherent blocks of 5 trials.",
    streamsCount: 1
  },
  {
    title: "Sensorimotor Chaos",
    difficulty: 6.0,
    nLevel: 2,
    speedMs: 1700,
    rounds: 30,
    modes: ['distractors', 'lures', 'negation', 'adaptive_closed_loop', 'wrapper_morph'],
    desc: "Flashes visual styles and logical category pools on every single trial.",
    streamsCount: 1
  },
  {
    title: "Episodic Buffer Binding",
    difficulty: 6.0,
    nLevel: 2,
    speedMs: 1600,
    rounds: 30,
    modes: ['distractors', 'lures', 'negation', 'adaptive_closed_loop', 'token_blending'],
    desc: "Blends alphanumeric code letters and emoji tokens directly inside spatial and trait relationships.",
    streamsCount: 1
  },
  {
    title: "2D Spatial Rotations",
    difficulty: 6.5,
    nLevel: 2,
    speedMs: 1600,
    rounds: 30,
    modes: ['distractors', 'lures', 'negation', 'adaptive_closed_loop', 'alien_square', 'token_blending'],
    desc: "Forces tracking of a 2D rotating spatial matrix with cross-modal token blending.",
    streamsCount: 1
  },
  {
    title: "3D Transparent Rotations",
    difficulty: 7.0,
    nLevel: 2,
    speedMs: 1600,
    rounds: 32,
    modes: ['distractors', 'lures', 'negation', 'adaptive_closed_loop', 'alien_cube', 'wrapper_morph', 'token_blending'],
    desc: "Tracks transparent 3D rotating cubes containing morphing visual styles and cross-modal tokens.",
    streamsCount: 1
  },
  {
    title: "Stress Inoculation",
    difficulty: 7.0,
    nLevel: 2,
    speedMs: 1500,
    rounds: 32,
    modes: ['distractors', 'lures', 'negation', 'adaptive_closed_loop', 'alien_cube', 'stress_glitch', 'timer_panic', 'wrapper_morph'],
    desc: "Overloads focal processing using visual glitches, shrinking countdown bars, and chaotic card shifting.",
    streamsCount: 1
  },
  {
    title: "Structural Disruption",
    difficulty: 7.5,
    nLevel: 2,
    speedMs: 1500,
    rounds: 35,
    modes: ['distractors', 'lures', 'negation', 'adaptive_closed_loop', 'alien_cube', 'stress_glitch', 'stress_shake', 'timer_panic', 'wrapper_morph', 'token_blending'],
    desc: "Injects physical screen shakes and chaotic set shifts alongside cross-modal token binding.",
    streamsCount: 1
  },
  {
    title: "Dual Stream Multitasking",
    difficulty: 7.5,
    nLevel: 2,
    speedMs: 1400,
    rounds: 35,
    modes: ['distractors', 'lures', 'negation', 'adaptive_closed_loop', 'wrapper_morph', 'token_blending'],
    desc: "Expands the challenge to tracking two parallel stimulus streams with visual wrapper morphs and blended tokens.",
    streamsCount: 2
  },
  {
    title: "Quantum Focus",
    difficulty: 8.0,
    nLevel: 3,
    speedMs: 1300,
    rounds: 35,
    modes: ['distractors', 'lures', 'negation', 'adaptive_closed_loop', 'stress_glitch', 'stress_shake', 'timer_panic', 'impossible', 'wrapper_morph', 'token_blending'],
    desc: "The absolute peak: 2 streams at N=3 with random multi-rules, full chaos morphs, and cross-modal token blending active.",
    streamsCount: 2
  },
  {
    title: "Hyper-Dimensional Tesseract",
    difficulty: 8.0,
    nLevel: 2,
    speedMs: 1400,
    rounds: 38,
    modes: ['distractors', 'lures', 'negation', 'adaptive_closed_loop', 'alien_tesseract', 'stress_glitch', 'stress_shake', 'timer_panic', 'wrapper_morph', 'token_blending'],
    desc: "Pushes spatial processing to the limit by tracking orbiting items within a projected 4D rotating hypercube (Tesseract).",
    streamsCount: 1
  },
  {
    title: "Analogy Crucible (visual 4-place)",
    difficulty: 6.5,
    nLevel: 2,
    speedMs: 1800,
    rounds: 30,
    modes: ['distractors', 'lures', 'negation', 'adaptive_closed_loop', 'analogy_nback'],
    desc: "Pure visual 4-place analogy n-back. A target fires when the current relation shares structural FORM with the N-back relation, even if the relation tokens differ (ABOVE_BELOW ≈ BIGGER_THAN ≈ STACKED). Same-token repeats are NOT matches — you have to abstract the form. The Halford 4-place rung, visual edition.",
    streamsCount: 1
  },
  {
    title: "Relational Supercomputer",
    difficulty: 8.5,
    nLevel: 3,
    speedMs: 1300,
    rounds: 40,
    modes: ['distractors', 'lures', 'negation', 'adaptive_closed_loop', 'rint', 'rst_overlay', 'cct_overlay', 'wrapper_morph'],
    rstDifficulty: 'hard',
    desc: "Unifies transitive chaining (RINT) on the main stream with syllogistic premise deductions (RST at Hard / 4-place analogy) and arithmetic CCT updating layered as side-tasks. Three response axes firing in parallel.",
    streamsCount: 1
  },
  {
    title: "Grandmaster Crucible",
    difficulty: 9.0,
    nLevel: 3,
    speedMs: 1200,
    rounds: 42,
    modes: ['distractors', 'lures', 'negation', 'adaptive_closed_loop', 'alien_cube', 'impossible', 'wrapper_morph', 'token_blending'],
    desc: "Expands multitasking to 3 parallel sequences of N=3 with chaotic visual card morphs and blended junk journal cliparts.",
    streamsCount: 3
  },
  {
    title: "The Infinite Singularity",
    difficulty: 10.0,
    nLevel: 4,
    speedMs: 1100,
    rounds: 45,
    modes: ['distractors', 'lures', 'negation', 'adaptive_closed_loop', 'alien_tesseract', 'stress_glitch', 'stress_shake', 'timer_panic', 'impossible', 'wrapper_morph', 'token_blending'],
    desc: "The ultimate boss level of human working memory: 3 parallel streams at N=4 inside a rotating 4D tesseract under extreme Glitch/Shake noise and full rule shifting!",
    streamsCount: 3
  },
  // ── Trajectory N-Back curriculum (Successor Representation training) ──────
  // A separate cognitive system from everything above. Targets hippocampus +
  // entorhinal predictive maps, not DLPFC working memory. Map fading forces
  // true internalization of the graph rather than visual edge-checking.
  {
    title: "Map Encoding (TJN Easy)",
    difficulty: 3.0,
    nLevel: 2,
    speedMs: 2800,
    rounds: 22,
    modes: ['trajectory_nback', 'feedback_per_trial'],
    tjnTier: 'easy',
    tjnTopology: 'ring',
    tjnNodes: 6,
    desc: "Trajectory N-Back at the easiest tier on a 6-node ring. Target = current node is the same as the N-back node. Edges fade after a short learning phase to force hippocampal map encoding.",
    streamsCount: 1
  },
  {
    title: "Neighbour Recall (TJN Medium)",
    difficulty: 4.0,
    nLevel: 2,
    speedMs: 2600,
    rounds: 24,
    modes: ['trajectory_nback', 'feedback_per_trial'],
    tjnTier: 'medium',
    tjnTopology: 'small_world',
    tjnNodes: 6,
    desc: "Adjacency check on a small-world graph (ring + shortcuts). Target = current node is a direct neighbour of the N-back node. Requires recalling the edge set after map fading.",
    streamsCount: 1
  },
  {
    title: "Successor Prediction (TJN Hard)",
    difficulty: 5.5,
    nLevel: 2,
    speedMs: 2400,
    rounds: 26,
    modes: ['trajectory_nback', 'feedback_per_trial'],
    tjnTier: 'hard',
    tjnTopology: 'small_world',
    tjnNodes: 6,
    tjnK: 2,
    desc: "K-step successor prediction. Target = current node is reachable in EXACTLY 2 steps from the N-back node. This is the heart of Successor Representation: predicting future occupancy.",
    streamsCount: 1
  },
  {
    title: "Goal Revaluation (TJN Extreme)",
    difficulty: 6.5,
    nLevel: 2,
    speedMs: 2400,
    rounds: 28,
    modes: ['trajectory_nback', 'feedback_per_trial'],
    tjnTier: 'extreme',
    tjnTopology: 'lattice',
    tjnNodes: 9,
    desc: "Zero-shot pathfinding under revaluation on a 3×3 lattice. Target = current node lies on the shortest path from the N-back node to a per-trial goal star. The goal is auto-picked each trial to guarantee non-trivial paths (≥1 intermediate). Forces flexible re-planning over an internalized map.",
    streamsCount: 1
  },
  // ── Schema Transfer (Tolman-Eichenbaum Machine) curriculum ───────────────
  // Same TJN engine, multiple graphs per session sharing topology family but
  // with fresh surfaces (themed maps α/β/γ). Tests whether the player encoded
  // the abstract schema rather than a specific map. Behrens et al. 2020.
  {
    title: "Schema Transfer — Easy (TEM)",
    difficulty: 4.5,
    nLevel: 2,
    speedMs: 2600,
    rounds: 27,
    modes: ['trajectory_nback', 'feedback_per_trial'],
    tjnTier: 'easy',
    tjnTopology: 'ring',
    tjnNodes: 6,
    tjnSchemaMode: true,
    tjnSchemaBlocks: 3,
    desc: "Tolman-Eichenbaum Machine training: 3 ring graphs, same topology family but fresh node identities and themes. The player must internalize the abstract schema (it's always a 6-cycle) and re-apply it when the surface swaps mid-session.",
    streamsCount: 1
  },
  {
    title: "Schema Transfer — Successor (TEM)",
    difficulty: 6.5,
    nLevel: 2,
    speedMs: 2400,
    rounds: 27,
    modes: ['trajectory_nback', 'feedback_per_trial'],
    tjnTier: 'hard',
    tjnTopology: 'small_world',
    tjnNodes: 6,
    tjnSchemaMode: true,
    tjnSchemaBlocks: 3,
    tjnK: 2,
    desc: "Schema transfer at the predictive-map tier: 3 small-world graphs (ring + shortcuts) share the structural family but swap surface. Target = 2-step successor of N-back. Combined Behrens TEM × Stachenfeld SR.",
    streamsCount: 1
  },
  {
    title: "Cross-Topology Schema Crucible",
    difficulty: 7.0,
    nLevel: 2,
    speedMs: 2300,
    rounds: 30,
    modes: ['trajectory_nback', 'feedback_per_trial'],
    tjnTier: 'medium',
    tjnTopology: 'lattice',
    tjnNodes: 6,
    tjnSchemaMode: true,
    tjnSchemaBlocks: 4,
    desc: "Maximum schema-transfer challenge: 4 lattice graphs, neighbour-prediction tier. The player must extract grid-structure once, then apply it to four distinct surfaces with no relearning between blocks.",
    streamsCount: 1
  },
  // ── Selective attention / distractor inhibition ──────────────────────────
  // Type-based decoy filter: some relation CATEGORIES are decoys to ignore in
  // real time on a single scored stream. Withhold on decoy-category stimuli
  // even when they'd match. Engle's controlled-attention construct.
  {
    title: "Selective Attention Filter",
    difficulty: 4.0,
    nLevel: 2,
    speedMs: 2400,
    rounds: 26,
    modes: ['decoy_filter', 'feedback_per_trial'],
    decoyFilterRule: 'never_target',
    decoyFilterRandom: true,
    desc: "Single stream, but certain relation CATEGORIES are decoys you must IGNORE — withhold even if they match (pressing a decoy = false alarm). The decoy categories are randomized per session and shown on the stream. Trains selective attention / distractor inhibition while holding the N-back load."
  },
  // ── NRINT match-rule ladder (Grapist request) ──────────────────────────────
  // Practices each non-default Nonverbal RINT logical rule in its own phase so
  // the new rule selector gets a curriculum, not just a setting buried in the
  // panel. Modest flag count + small cap to keep the load tractable while
  // learning the new rule.
  {
    title: "NRINT — Intersection",
    difficulty: 6.0,
    nLevel: 2,
    speedMs: 2200,
    rounds: 26,
    modes: ['nonverbal_rint', 'feedback_per_trial', 'adaptive_closed_loop'],
    nrintMatchRule: 'intersection',
    desc: "Nonverbal RINT under the INTERSECTION rule: target fires when the current attribute set equals the flags shared by every member of some non-empty subset of the last N stims. Tighter than union — current must be a subset of every chosen stim."
  },
  {
    title: "NRINT — XOR (parity)",
    difficulty: 7.0,
    nLevel: 2,
    speedMs: 2200,
    rounds: 28,
    modes: ['nonverbal_rint', 'feedback_per_trial', 'adaptive_closed_loop'],
    nrintMatchRule: 'xor',
    desc: "Nonverbal RINT under the XOR / symmetric-difference rule: a flag is ON in current iff an odd number of the chosen subset of the last N stims have it. Parity — pairs cancel out. Drilling this trains GF(2) linear thinking under WM load."
  },
  {
    title: "NRINT — Implication",
    difficulty: 5.5,
    nLevel: 2,
    speedMs: 2200,
    rounds: 28,
    modes: ['nonverbal_rint', 'feedback_per_trial', 'adaptive_closed_loop'],
    nrintMatchRule: 'implication',
    desc: "Nonverbal RINT under the IMPLICATION rule: target fires when there exists a non-empty stim s in the last N whose flag set is contained in current (s → current). The most permissive rule of the five — sharper distractor pressure to compensate."
  },
  {
    title: "NRINT — Biconditional / Equivalence",
    difficulty: 7.0,
    nLevel: 2,
    speedMs: 2200,
    rounds: 28,
    modes: ['nonverbal_rint', 'feedback_per_trial', 'adaptive_closed_loop'],
    nrintMatchRule: 'biconditional',
    desc: "Nonverbal RINT under the BICONDITIONAL / equivalence rule: current equals the flags where every member of some subset of size ≥ 2 of the last N stims agrees (the consensus / agreement set; for two stims this is exactly A ↔ B). The strictest rule — flag-by-flag agreement across multiple stims."
  },
  // ── NRINT multi-rule + weights ladder (Grapist follow-up) ──────────────────
  // After each rule has been drilled in isolation (phases 34-37), the multi-
  // rule phases mix several rules with per-rule weights so the player has to
  // recognise which logical rule is active on the current trial, not just
  // apply a fixed one. The engine samples one rule per trial in proportion to
  // the weights.
  {
    title: "NRINT — Mixed Logic Lite (Union + XOR)",
    difficulty: 6.5,
    nLevel: 2,
    speedMs: 2400,
    rounds: 28,
    modes: ['nonverbal_rint', 'feedback_per_trial', 'adaptive_closed_loop'],
    nrintMatchRuleWeights: { union: 2, intersection: 0, xor: 1, implication: 0, biconditional: 0 },
    desc: "Nonverbal RINT with TWO rules in rotation — Union (default, ~67% of trials) and XOR (~33%). The engine picks one rule per trial; you have to recognise which logic is operative on the current stim. Lighter intro to multi-rule mode."
  },
  {
    title: "NRINT — Full Logic Mix (all 5)",
    difficulty: 8.0,
    nLevel: 2,
    speedMs: 2600,
    rounds: 30,
    modes: ['nonverbal_rint', 'feedback_per_trial', 'adaptive_closed_loop'],
    nrintMatchRuleWeights: { union: 2, intersection: 1, xor: 1, implication: 1, biconditional: 1 },
    desc: "Nonverbal RINT with ALL FIVE logical rules in rotation, Union slightly favoured (~33%). Each trial independently samples one rule by weight; you must recognise which rule is active and apply it. The top of the NRINT ladder — exercises rule-switching under WM load."
  }
];

export const AVAILABLE_THEMES = [
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    className: 'bg-black/90 border-cyan-500/90 shadow-[0_0_32px_rgba(34,211,238,0.45)] text-cyan-400 border-2',
    canvasBg: '#05070c',
    primaryColor: '#22d3ee',
    secondaryColor: '#f43f5e'
  },
  {
    id: 'minimal',
    name: 'Minimal Stark',
    className: 'bg-zinc-950 border-zinc-700 shadow-none text-zinc-100 border-2',
    canvasBg: '#09090b',
    primaryColor: '#fafafa',
    secondaryColor: '#71717a'
  },
  {
    id: 'glass',
    name: 'Glassmorphic Frost',
    className: 'bg-slate-900/40 backdrop-blur-md border-white/20 shadow-[0_0_24px_rgba(255,255,255,0.05)] text-white border-2',
    canvasBg: 'rgba(15, 23, 42, 0.3)',
    primaryColor: '#f1f5f9',
    secondaryColor: '#94a3b8'
  },
  {
    id: 'sunset',
    name: 'Sunset Glow',
    className: 'bg-stone-950 border-orange-500/90 shadow-[0_0_32px_rgba(249,115,22,0.4)] text-orange-400 border-2',
    canvasBg: '#0c0a09',
    primaryColor: '#f97316',
    secondaryColor: '#ec4899'
  },
  {
    id: 'terminal',
    name: 'Matrix Terminal',
    className: 'bg-black border-emerald-500/90 shadow-[0_0_28px_rgba(16,185,129,0.35)] text-emerald-400 border-2',
    canvasBg: '#000000',
    primaryColor: '#10b981',
    secondaryColor: '#3b82f6'
  }
];

export const LANDSCAPE_PATHS = [
  '/assets/landscapes/landscape1.jpg',
  '/assets/landscapes/landscape2.jpg',
  '/assets/landscapes/landscape3.jpg',
  '/assets/landscapes/landscape4.jpg',
  '/assets/landscapes/landscape5.jpg',
  '/assets/landscapes/landscape6.jpg'
];

export function getAssetUrl(path) {
  if (!path) return '';
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
  const cleanBase = base.endsWith('/') ? base : base + '/';
  return `${cleanBase}${cleanPath}`;
}