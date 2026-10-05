"""Chimera Hub's 'Battle' background: two lions rampant, reared on their hind
legs and striking at each other on a rock ledge under a large moon, with
mountains, fog and firs — in the hub's gold on near-black.

    python3 tools/backgrounds/battle.py shell/backgrounds/battle.svg shell/backgrounds/battle-tall.svg

Drawn in code rather than painted, for the reason the forest was: no request to
anybody, nothing to license, and it can be changed by changing a number. The
animals are silhouettes built from simple shapes in one fill, so overlaps merge
into one outline, and a blurred gold copy behind them makes the rim light. One
lion is drawn and mirrored, which is also why the scene reads
as heraldic."""
import math, random, sys

W, H = 1600, 1000
random.seed(11)
INK = "#070604"


def f(x):
    return f"{x:.1f}".rstrip("0").rstrip(".")


def poly(pts):
    return "M" + "L".join(f"{f(x)} {f(y)}" for x, y in pts) + "Z"


def line(pts, w):
    d = "M" + "L".join(f"{f(x)} {f(y)}" for x, y in pts)
    return f'<path d="{d}" fill="none" stroke-width="{f(w)}" stroke-linecap="round" stroke-linejoin="round"/>'


def smooth(pts, n=6):
    """Catmull-Rom through the points, n samples per span."""
    if len(pts) < 3:
        return pts
    P = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2
                                    + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    out.append(pts[-1])
    return out


def taper(pts, w0, w1, bulge=None):
    """A limb, tail or claw: a filled outline along a smoothed centreline,
    its width falling from w0 to w1. `bulge` adds width at joints, as
    (fraction along, extra width)."""
    c = smooth(pts)
    n = len(c)
    left, right = [], []
    for i, (x, y) in enumerate(c):
        a = c[max(i - 1, 0)]
        b = c[min(i + 1, n - 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy) or 1
        nx, ny = -dy / L, dx / L
        t = i / (n - 1)
        w = w0 + (w1 - w0) * t
        if bulge:
            for (at, extra) in bulge:
                w += extra * math.exp(-((t - at) ** 2) / 0.004)
        left.append((x + nx * w / 2, y + ny * w / 2))
        right.append((x - nx * w / 2, y - ny * w / 2))
    tip = c[-1]
    return f'<path d="{poly(left + [tip] + right[::-1])}"/>'


def ell(cx, cy, rx, ry, rot=0):
    return f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(ry)}" transform="rotate({f(rot)} {f(cx)} {f(cy)})"/>'


def jagged(cx, cy, r, n, depth, seed, squash=1.0, start=0.0, sweep=360.0):
    """A ragged ring: a mane, a tuft. Alternating long and short radii."""
    rnd = random.Random(seed)
    pts = []
    for i in range(n + 1):
        a = math.radians(start + sweep * i / n)
        rr = r * (1 + (depth if i % 2 == 0 else -depth * 0.4) * (0.6 + 0.8 * rnd.random()))
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a) * squash))
    return pts


def lion():
    """A lion rampant facing +x: reared on its hind legs and leaning in, one
    forepaw raised high to strike and one reaching, mane up, jaws open in a
    roar. Feet on y=0; about 440 tall."""
    p = []
    # hind legs: heavy thighs, hocks back, paws flat on the ground
    p.append(taper([(-40, -150), (-6, -98), (-30, -52), (-22, -10)], 60, 20, [(0.35, 14)]))
    p.append(taper([(-10, -150), (30, -102), (8, -54), (18, -10)], 66, 22, [(0.35, 16)]))
    for x in (-16, 24):
        p.append(ell(x + 6, -8, 26, 10, 0))
    # torso, rising and leaning in from the hips to a deep chest
    p.append(taper([(-30, -122), (-2, -188), (38, -246), (80, -290)], 100, 116, [(0.45, -22)]))
    p.append(ell(-26, -134, 52, 46, -30))                       # haunch
    p.append(ell(84, -288, 60, 66, -36))                        # chest and shoulder
    # tail: low, then an S up behind, ending in a tuft
    p.append(taper([(-60, -112), (-110, -86), (-150, -108), (-160, -160), (-146, -204)], 15, 7))
    p.append(ell(-142, -214, 9, 17, 20))
    # the far foreleg, raised high to strike
    p.append(taper([(92, -330), (124, -390), (158, -428), (196, -448)], 40, 20, [(0.5, 6)]))
    # the near foreleg, reaching forward
    p.append(taper([(108, -292), (156, -310), (198, -316), (232, -330)], 46, 22, [(0.5, 6)]))
    for (x, y, a) in ((196, -448, -30), (232, -330, -12)):
        p.append(ell(x + 3, y, 19, 14, a))
        for k in (-34, -12, 10, 32):
            r = math.radians(a + k)
            p.append(taper([(x + 12 * math.cos(r), y + 12 * math.sin(r)),
                            (x + 24 * math.cos(r - .1), y + 24 * math.sin(r - .1)),
                            (x + 33 * math.cos(r + .25), y + 33 * math.sin(r + .25))], 5.5, 1.2))
    # the mane: a shaggy mass behind the head, with locks falling down the neck
    p.append(f'<path d="{poly(jagged(86, -380, 74, 44, .16, 7, 1.12))}"/>')
    for i, (x0, y0) in enumerate([(54, -330), (70, -316), (88, -306), (106, -300), (40, -350)]):
        p.append(taper([(x0, y0), (x0 - 6 + i * 2, y0 + 30), (x0 - 2 + i * 3, y0 + 52)], 22, 3))
    for (x0, y0, x1, y1) in [(40, -430, 20, -462), (70, -448, 62, -484), (104, -446, 112, -480), (24, -400, -8, -416)]:
        p.append(taper([(x0, y0), ((x0 + x1) / 2 + 4, (y0 + y1) / 2), (x1, y1)], 24, 3))
    # head, out in front of the mane: brow, long muzzle, jaws open
    p.append(ell(150, -392, 34, 30, -14))
    p.append(f'<path d="{poly([(150,-418),(186,-418),(214,-406),(226,-396),(222,-384),(196,-382),(162,-376)])}"/>')  # upper jaw
    p.append(f'<path d="{poly([(166,-370),(212,-360),(218,-350),(196,-344),(160,-350)])}"/>')                      # lower jaw
    p.append(f'<path d="{poly([(214,-386),(218,-372),(209,-376)])}"/>')                                               # fang
    p.append(f'<path d="{poly([(196,-370),(199,-361),(192,-364)])}"/>')                                               # fang
    p.append(f'<path d="{poly([(140,-418),(130,-444),(154,-428)])}"/>')                                               # ear
    return "".join(p)


def mirror(svg, cx):
    return f'<g transform="translate({f(2*cx)} 0) scale(-1 1)">{svg}</g>'


def place(svg, x, y, s=1.0):
    return f'<g transform="translate({f(x)} {f(y)}) scale({f(s)})">{svg}</g>'


def fir(x, base, h, w):
    """A layered fir, as the hub's forest draws them."""
    pts = [(x - w * 0.1, base)]
    tiers = 9
    for i in range(tiers):
        t = i / tiers
        y = base - h * (0.12 + 0.86 * t)
        half = w * (1 - t) * 0.5 + 3
        pts += [(x - half, y), (x - half * 0.45, y - h * 0.035)]
    pts.append((x, base - h))
    right = [(2 * x - px, py) for px, py in reversed(pts[1:-1])]
    pts += right + [(x + w * 0.1, base)]
    return poly(pts)


def ridge(y0, amp, step, seed):
    """A mountain line: a random walk with a few peaks pulled up out of it."""
    rnd = random.Random(seed)
    peaks = [(rnd.uniform(0, W), rnd.uniform(.6, 1.0) * amp, rnd.uniform(90, 220)) for _ in range(5)]
    pts = [(-40, H + 10)]
    x, y = -40, 0.0
    while x <= W + 60:
        y += rnd.uniform(-1, 1) * amp * 0.09
        y *= 0.97
        lift = sum(h * max(0, 1 - abs(x - px) / w) for px, h, w in peaks)
        pts.append((x, y0 + y - lift))
        x += step * 0.25
    pts.append((W + 60, H + 10))
    return poly(pts)


def build(portrait=False):
    """The scene, wide (1600x1000, for screens wider than tall) or tall
    (900x1600, for phones held upright), with the lions framed for each."""
    global W, H
    W, H = (900, 1600) if portrait else (1600, 1000)
    cx = W / 2 if portrait else 860
    ground = 1150 if portrait else 762
    X = lambda x: x - 860 + cx          # the wide layout's x, moved to this cx
    Y = lambda y: y + ground - 762      # and its y, to this ground
    crest_rocks = []
    out = [f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {W} {H}' preserveAspectRatio='xMidYMid slice'>"]
    out.append("""<defs>
<linearGradient id='sky' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#0b0905'/><stop offset='.55' stop-color='#1d170c'/><stop offset='1' stop-color='#0a0806'/></linearGradient>
<radialGradient id='moon' cx='.5' cy='.5' r='.5'><stop offset='0' stop-color='#f3e2a6'/><stop offset='.82' stop-color='#d9bd6a'/><stop offset='1' stop-color='#b8963c'/></radialGradient>
<radialGradient id='halo' cx='.5' cy='.5' r='.5'><stop offset='0' stop-color='#d4af37' stop-opacity='.42'/><stop offset='.45' stop-color='#d4af37' stop-opacity='.12'/><stop offset='1' stop-color='#d4af37' stop-opacity='0'/></radialGradient>
<linearGradient id='fog' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#dcc68e' stop-opacity='0'/><stop offset='.5' stop-color='#dcc68e' stop-opacity='.5'/><stop offset='1' stop-color='#dcc68e' stop-opacity='0'/></linearGradient>
<linearGradient id='floor' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#060503' stop-opacity='0'/><stop offset='1' stop-color='#060503' stop-opacity='.96'/></linearGradient>
<filter id='glow' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='5'/></filter>
</defs>""")
    out.append(f"<rect width='{W}' height='{H}' fill='url(#sky)'/>")
    # stars, sparse, in the sky above the mountains
    rnd = random.Random(3)
    stars = "".join(f"<circle cx='{f(rnd.uniform(0,W))}' cy='{f(rnd.uniform(0,Y(430)))}' r='{f(rnd.uniform(.6,1.6))}'/>"
                    for _ in range(int(90 * W * Y(430) / (1600 * 430))))
    out.append(f"<g fill='#e8d9ae' opacity='.5'>{stars}</g>")
    # the moon, behind where the lions meet
    mx, my, mr = cx, Y(470), 230
    out.append(f"<circle cx='{f(mx)}' cy='{f(my)}' r='{mr*2.3:.0f}' fill='url(#halo)'/>")
    # dimmed so labels the hub sets over it stay readable
    out.append(f"<circle cx='{f(mx)}' cy='{f(my)}' r='{mr}' fill='url(#moon)' opacity='.62'/>")
    out.append("<g fill='#b8963c' opacity='.18'>" + "".join(
        f"<circle cx='{f(mx + dx)}' cy='{f(my + dy)}' r='{r}'/>" for dx, dy, r in
        [(-80, -60, 34), (60, -90, 22), (90, 40, 40), (-40, 80, 26), (-120, 30, 16), (20, -10, 14)]) + "</g>")
    # far mountains, then fog
    out.append(f"<path d='{ridge(Y(600), 70, 60, 5)}' fill='#2a2212' opacity='.75'/>")
    out.append(f"<rect y='{f(Y(520))}' width='{W}' height='220' fill='url(#fog)' opacity='.22'/>")
    out.append(f"<path d='{ridge(Y(680), 40, 45, 9)}' fill='#1a150b' opacity='.9'/>")
    # firs at the sides, two layers; the near one stays clear of the lions
    if portrait:
        ranges = [((-60, 150), (W - 150, W + 60)), ((-90, -10), (W + 10, W + 90))]
    else:
        ranges = [((-60, 470), (1130, 1660)), ((-80, 300), (1420, 1680))]
    trees = []
    rnd = random.Random(21)
    for layer, (n, base, hmin, hmax, op, col) in enumerate([(26, Y(760), 130, 230, .85, "#151108"),
                                                             (16, Y(860), 230, 380, 1, INK)]):
        lo, hi = ranges[layer]
        paths = []
        for i in range(n):
            x = rnd.uniform(*lo) if i % 2 == 0 else rnd.uniform(*hi)
            h = rnd.uniform(hmin, hmax)
            paths.append(fir(x, base + rnd.uniform(-20, 30), h, h * 0.42))
        trees.append(f"<path d='{''.join(paths)}' fill='{col}' opacity='{op}'/>")
    out.append(trees[0])
    out.append(f"<rect y='{f(Y(640))}' width='{W}' height='200' fill='url(#fog)' opacity='.16'/>")
    # the ledge the lions fight on: flat where they stand, so every paw is on rock
    crest = [(X(250), H + 10), (X(300), Y(900)), (X(350), Y(852)), (X(400), Y(818)), (X(452), ground + 30),
             (X(500), ground + 12), (X(548), ground + 2)]
    x = 560
    rnd2 = random.Random(31)
    while x < 1160:
        crest.append((X(x), ground + rnd2.uniform(-1.5, 1.5)))
        x += 34
    crest += [(X(1172), ground + 2), (X(1220), ground + 12), (X(1268), ground + 30), (X(1320), Y(818)),
              (X(1370), Y(852)), (X(1420), Y(900)), (X(1470), H + 10)]
    for (rx, ry, rw, rh) in [(470, ground + 18, 40, 22), (1250, ground + 20, 46, 26),
                             (380, Y(820), 30, 16), (1340, Y(812), 34, 18)]:
        rx = X(rx)
        crest_rocks.append(poly([(rx - rw, ry + rh * .4), (rx - rw * .4, ry - rh * .6), (rx + rw * .3, ry - rh),
                                 (rx + rw, ry), (rx + rw * .6, ry + rh * .5)]))
    # the fighters: one lion, and its mirror, forepaws meeting at cx
    s = 0.98 if portrait else 1.12
    lion_a = place(lion(), cx - 252 * s, ground + 2, s)     # paws sink a hair into the rock
    lions = lion_a + mirror(lion_a, cx)
    figures = f"<path d='{poly(crest)}{''.join(crest_rocks)}'/>" + lions
    # gold rim: the same shapes, blurred, behind
    out.append(f"<g fill='#d4af37' stroke='#d4af37' opacity='.55' filter='url(#glow)'>{figures}</g>")
    out.append(f"<g fill='{INK}' stroke='{INK}'>{figures}</g>")
    out.append(trees[1])
    out.append(f"<rect y='{f(Y(800))}' width='{W}' height='{f(H - Y(800))}' fill='url(#floor)'/>")
    out.append("</svg>")
    return "".join(out)


if __name__ == "__main__":
    # python3 tools/backgrounds/battle.py <wide.svg> [<tall.svg>]
    for path, tall in zip(sys.argv[1:3], (False, True)):
        svg = build(tall)
        open(path, "w").write(svg)
        print(path, len(svg), "bytes")
