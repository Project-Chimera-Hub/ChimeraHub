"""Chimera Hub's 'Battle' background: two red deer stags locked at the antlers
on a rocky crest, two eagles at each other's talons above, under a large moon,
with mountains, fog and firs — in the hub's gold on near-black.

    python3 tools/backgrounds/battle.py shell/backgrounds/battle.svg

Drawn in code rather than painted, for the reason the forest was: no request to
anybody, nothing to license, and it can be changed by changing a number. The
animals are silhouettes built from simple shapes in one fill, so overlaps merge
into one outline, and a blurred gold copy behind them makes the rim light. One
stag (and one eagle) is drawn and mirrored, which is also why the scene reads
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
    """A limb, antler or tine: a filled outline along a smoothed centreline,
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


def stag():
    """A red deer stag facing +x in the rut: head down, antlers thrust forward,
    forelegs braced, hinds driving. Origin mid-barrel; hooves at y=185."""
    p = []
    # barrel, rump, chest, withers
    p.append(ell(0, 0, 92, 44, 4))
    p.append(ell(-72, -4, 46, 47, 0))
    p.append(ell(60, 8, 46, 50, 0))
    p.append(ell(30, -36, 46, 16, -6))
    # neck: thick with the rut, running forward and down to a low head
    p.append(f'<path d="{poly([(20,-48),(70,-50),(112,-26),(150,12),(166,40),(150,66),(118,54),(92,46),(60,40)])}"/>')
    # shaggy mane under the throat
    p.append(f'<path d="{poly([(88,44),(96,72),(106,52),(114,78),(124,56),(132,80),(140,58),(150,66)])}"/>')
    # head: skull, long face angled down, muzzle
    p.append(ell(160, 44, 26, 19, 30))
    p.append(f'<path d="{poly([(150,38),(176,40),(196,78),(190,92),(176,92),(160,64)])}"/>')
    p.append(ell(186, 88, 11, 9, 0))
    # ears, laid back on the neck
    p.append(f'<path d="{poly([(148,30),(122,16),(130,30),(146,40)])}"/>')
    # tail
    p.append(f'<path d="{poly([(-112,-24),(-126,-8),(-118,-2),(-106,-14)])}"/>')
    # forelegs, braced forward: forearm, knee, cannon, hoof
    p.append(taper([(76, 30), (86, 70), (96, 104), (108, 140), (126, 182)], 30, 8, [(0.48, 7)]))
    p.append(taper([(48, 36), (54, 76), (62, 110), (70, 144), (82, 182)], 27, 8, [(0.48, 6)]))
    # hindlegs, driving back: thigh, hock, cannon
    p.append(taper([(-80, 10), (-74, 56), (-80, 92), (-100, 120), (-118, 150), (-132, 182)], 46, 8, [(0.45, 8)]))
    p.append(taper([(-58, 20), (-52, 62), (-58, 96), (-74, 124), (-88, 152), (-100, 182)], 38, 8, [(0.45, 7)]))
    for x in (126, 82, -132, -100):
        p.append(f'<path d="{poly([(x-8,178),(x+10,178),(x+12,188),(x-10,188)])}"/>')
    # antlers: beams sweeping up then forward from the crown, toward the rival
    a = []
    for k, (dx, dy) in enumerate([(0, 0), (-12, -8)]):
        bx, by = 156 + dx, 30 + dy
        beam = [(bx, by), (166 + dx, 0 + dy), (186 + dx, -26 + dy), (214 + dx, -40 + dy),
                (246 + dx, -38 + dy), (268 + dx, -24 + dy), (282 + dx, -4 + dy)]
        a.append(taper(beam, 10, 4))
        a.append(taper([(162 + dx, 16 + dy), (190 + dx, 14 + dy), (210 + dx, 26 + dy)], 6.5, 3.5))   # brow
        a.append(taper([(174 + dx, -12 + dy), (204 + dx, -6 + dy), (222 + dx, 6 + dy)], 6, 3))        # bez
        a.append(taper([(206 + dx, -38 + dy), (212 + dx, -66 + dy), (206 + dx, -84 + dy)], 6, 3))     # trez
        a.append(taper([(240 + dx, -38 + dy), (254 + dx, -64 + dy)], 5, 2.5))                           # crown
        a.append(taper([(262 + dx, -28 + dy), (286 + dx, -44 + dy)], 4.5, 2.5))
        a.append(taper([(282 + dx, -4 + dy), (296 + dx, 12 + dy)], 4, 2.5))
    return "".join(p), "".join(a)


def eagle():
    """An eagle facing +x, wings raised in a broad V, talons thrust forward."""
    p = []
    p.append(ell(0, 0, 50, 24, -28))                                     # body
    p.append(ell(44, -30, 19, 15, -18))                                  # head
    p.append(f'<path d="{poly([(58,-38),(80,-30),(74,-20),(64,-24),(58,-20)])}"/>')  # hooked beak
    # tail fan
    p.append(f'<path d="{poly([(-40,14),(-100,40),(-96,52),(-84,46),(-80,58),(-68,48),(-58,56),(-34,26)])}"/>')
    # near wing: broad, wrist high, primaries spread like fingers
    near = [(-4, -14), (-24, -64), (-46, -116), (-70, -164), (-96, -196),
            (-112, -210), (-108, -190), (-132, -212), (-124, -186), (-150, -204), (-138, -176),
            (-166, -188), (-150, -158), (-178, -164), (-156, -134), (-176, -130), (-146, -108),
            (-112, -76), (-82, -40), (-40, -2)]
    p.append(f'<path d="{poly(near)}"/>')
    # far wing, behind: shorter, narrower in perspective
    far = [(12, -18), (18, -74), (22, -128), (24, -170), (34, -184), (34, -160), (48, -182),
           (46, -154), (62, -170), (56, -140), (72, -150), (62, -118), (56, -70), (34, -12)]
    p.append(f'<path d="{poly(far)}"/>')
    # legs and talons
    p.append(taper([(18, 12), (44, 36), (72, 42)], 13, 6))
    p.append(taper([(6, 18), (32, 48), (62, 58)], 12, 5))
    for (x, y) in ((72, 42), (62, 58)):
        for ang in (-50, -10, 30):
            r = math.radians(ang)
            p.append(taper([(x, y), (x + 15 * math.cos(r), y + 15 * math.sin(r)),
                            (x + 20 * math.cos(r + 1.0), y + 20 * math.sin(r + 1.0))], 4, 2))
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


def build():
    cx, ground = 860, 762
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
    # stars, sparse
    rnd = random.Random(3)
    stars = "".join(f"<circle cx='{f(rnd.uniform(0,W))}' cy='{f(rnd.uniform(0,430))}' r='{f(rnd.uniform(.6,1.6))}'/>" for _ in range(90))
    out.append(f"<g fill='#e8d9ae' opacity='.5'>{stars}</g>")
    # the moon, behind where the antlers lock
    mx, my, mr = cx, 470, 230
    out.append(f"<circle cx='{mx}' cy='{my}' r='{mr*2.3:.0f}' fill='url(#halo)'/>")
    # dimmed so labels the hub sets over it stay readable
    out.append(f"<circle cx='{mx}' cy='{my}' r='{mr}' fill='url(#moon)' opacity='.62'/>")
    # craters, faint
    out.append("<g fill='#b8963c' opacity='.18'>" + "".join(
        f"<circle cx='{f(mx + dx)}' cy='{f(my + dy)}' r='{r}'/>" for dx, dy, r in
        [(-80, -60, 34), (60, -90, 22), (90, 40, 40), (-40, 80, 26), (-120, 30, 16), (20, -10, 14)]) + "</g>")
    # far mountains, then fog
    out.append(f"<path d='{ridge(600, 70, 60, 5)}' fill='#2a2212' opacity='.75'/>")
    out.append(f"<rect y='520' width='{W}' height='220' fill='url(#fog)' opacity='.22'/>")
    out.append(f"<path d='{ridge(680, 40, 45, 9)}' fill='#1a150b' opacity='.9'/>")
    # firs at the sides, two layers
    trees = []
    rnd = random.Random(21)
    for layer, (n, base, hmin, hmax, op, col) in enumerate([(26, 760, 130, 230, .85, "#151108"), (16, 860, 230, 380, 1, INK)]):
        paths = []
        for i in range(n):
            side = -1 if i % 2 == 0 else 1
            # the near layer stays clear of the stags, out at the edges
            lo, hi = ((-60, 470), (1130, 1660)) if layer == 0 else ((-80, 300), (1420, 1680))
            x = rnd.uniform(*lo) if side < 0 else rnd.uniform(*hi)
            h = rnd.uniform(hmin, hmax)
            paths.append(fir(x, base + rnd.uniform(-20, 30), h, h * 0.42))
        trees.append(f"<path d='{''.join(paths)}' fill='{col}' opacity='{op}'/>")
    out.append(trees[0])
    out.append(f"<rect y='640' width='{W}' height='200' fill='url(#fog)' opacity='.16'/>")
    # the crest the stags fight on
    crest = [(250, H + 10), (330, 900), (372, 846), (430, 820), (470, 792), (520, 776), (560, ground + 6),
             (610, ground - 2), (660, ground + 4), (720, ground - 4), (780, ground + 2), (840, ground - 6),
             (900, ground + 3), (960, ground - 3), (1020, ground + 4), (1080, ground - 2), (1130, ground + 6),
             (1180, 774), (1230, 792), (1268, 816), (1320, 846), (1366, 896), (1440, H + 10)]
    # rocks breaking the crest's edge
    for (rx, ry, rw, rh) in [(520, 772, 40, 22), (1170, 770, 46, 26), (430, 818, 30, 16), (1250, 800, 34, 18)]:
        crest_rocks.append(poly([(rx - rw, ry + rh * .4), (rx - rw * .4, ry - rh * .6), (rx + rw * .3, ry - rh),
                                 (rx + rw, ry), (rx + rw * .6, ry + rh * .5)]))
    # the fighters: one stag, and its mirror, antlers interlocked at cx
    body, antlers = stag()
    s = 1.32
    sx = cx - 262 * s      # beam tips reach just past cx, into the rival's
    sy = ground - 186 * s
    stag_a = place(body + antlers, sx, sy, s)
    stags = stag_a + mirror(stag_a, cx)
    # eagles, clashing high on the left
    e = eagle()
    ex, ey, es = 370, 290, 0.95
    eagle_a = place(e, ex - 74 * es, ey, es)
    eagles = f"<g transform='rotate(-8 {ex} {ey})'>{eagle_a}{mirror(eagle_a, ex)}</g>"
    figures = f"<path d='{poly(crest)}{''.join(crest_rocks)}'/>" + stags + eagles
    # gold rim: the same shapes, blurred, behind
    out.append(f"<g fill='#d4af37' stroke='#d4af37' opacity='.55' filter='url(#glow)'>{figures}</g>")
    out.append(f"<g fill='{INK}' stroke='{INK}'>{figures}</g>")
    out.append(trees[1])
    out.append(f"<rect y='800' width='{W}' height='200' fill='url(#floor)'/>")
    out.append("</svg>")
    return "".join(out)


if __name__ == "__main__":
    svg = build()
    open(sys.argv[1], "w").write(svg)
    print(len(svg), "bytes")
