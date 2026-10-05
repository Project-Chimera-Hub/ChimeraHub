"""Chimera Hub's 'Lake' background: a large moon low over a still lake, its
light laid on the water in a broken gold column, with mountains, fog, dark
shores and firs, in the hub's gold on near-black. No animals.

    python3 tools/backgrounds/lake.py shell/backgrounds/lake.svg shell/backgrounds/lake-tall.svg

Drawn in code rather than painted, for the reason the forest was: no request to
anybody, nothing to license, and it can be changed by changing a number. The
first file is the wide scene; the second is framed for a phone held upright."""
import math, random, sys

W, H = 1600, 1000
random.seed(11)
INK = "#070604"


def f(x):
    return f"{x:.1f}".rstrip("0").rstrip(".")


def poly(pts):
    return "M" + "L".join(f"{f(x)} {f(y)}" for x, y in pts) + "Z"


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
    (900x1600, for phones held upright)."""
    global W, H
    W, H = (900, 1600) if portrait else (1600, 1000)
    cx = W / 2 if portrait else 860
    ground = 1150 if portrait else 762
    X = lambda x: x - 860 + cx          # the wide layout's x, moved to this cx
    Y = lambda y: y + ground - 762      # and its y, to this ground
    out = [f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {W} {H}' preserveAspectRatio='xMidYMid slice'>"]
    out.append("""<defs>
<linearGradient id='sky' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#0b0905'/><stop offset='.55' stop-color='#1d170c'/><stop offset='1' stop-color='#0a0806'/></linearGradient>
<radialGradient id='moon' cx='.5' cy='.5' r='.5'><stop offset='0' stop-color='#f3e2a6'/><stop offset='.82' stop-color='#d9bd6a'/><stop offset='1' stop-color='#b8963c'/></radialGradient>
<radialGradient id='halo' cx='.5' cy='.5' r='.5'><stop offset='0' stop-color='#d4af37' stop-opacity='.42'/><stop offset='.45' stop-color='#d4af37' stop-opacity='.12'/><stop offset='1' stop-color='#d4af37' stop-opacity='0'/></radialGradient>
<linearGradient id='fog' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#dcc68e' stop-opacity='0'/><stop offset='.5' stop-color='#dcc68e' stop-opacity='.5'/><stop offset='1' stop-color='#dcc68e' stop-opacity='0'/></linearGradient>
<linearGradient id='floor' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#060503' stop-opacity='0'/><stop offset='1' stop-color='#060503' stop-opacity='.96'/></linearGradient>
<linearGradient id='water' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#1b160c'/><stop offset='1' stop-color='#070604'/></linearGradient>
</defs>""")
    out.append(f"<rect width='{W}' height='{H}' fill='url(#sky)'/>")
    # stars, sparse, in the sky above the mountains
    rnd = random.Random(3)
    stars = "".join(f"<circle cx='{f(rnd.uniform(0,W))}' cy='{f(rnd.uniform(0,Y(430)))}' r='{f(rnd.uniform(.6,1.6))}'/>"
                    for _ in range(int(90 * W * Y(430) / (1600 * 430))))
    out.append(f"<g fill='#e8d9ae' opacity='.5'>{stars}</g>")
    # the moon, low over the water
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
    # firs at the sides, two layers; the near one keeps the middle open
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
    # the lake: still water from the shore down, the moon laid on it in a
    # column of broken gold
    lake_top = Y(770)
    out.append(f"<rect y='{f(lake_top)}' width='{W}' height='{f(H - lake_top)}' fill='url(#water)'/>")
    rnd3 = random.Random(41)
    streaks = []
    y = lake_top + 6
    while y < H:
        t = (y - lake_top) / (H - lake_top)
        width = mr * (0.55 + 0.9 * t) * rnd3.uniform(0.5, 1.0)
        off = rnd3.uniform(-0.12, 0.12) * width
        streaks.append(f"<rect x='{f(mx + off - width / 2)}' y='{f(y)}' width='{f(width)}' height='{f(2 + 4 * t)}' "
                       f"opacity='{f(max(0.05, 0.55 - 0.5 * t) * rnd3.uniform(.5, 1))}'/>")
        y += 6 + 16 * t
    out.append(f"<g fill='#e8cf86'>{''.join(streaks)}</g>")
    # a faint mirror of the far ridge, and mist on the water
    out.append(f"<rect y='{f(lake_top - 30)}' width='{W}' height='90' fill='url(#fog)' opacity='.22'/>")
    # the shores: dark banks closing in from both sides
    for side in (-1, 1):
        edge = 0 if side < 0 else W
        reach = W * (0.34 if portrait else 0.3)
        pts = [(edge, H + 10), (edge, lake_top - 8)]
        x = edge
        rnd4 = random.Random(51 + side)
        steps = 14
        for i in range(1, steps + 1):
            t = i / steps
            x = edge - side * reach * t
            pts.append((x, lake_top - 8 + (H - lake_top) * (t ** 2.2) * 0.9 + rnd4.uniform(-6, 6)))
        pts.append((x, H + 10))
        out.append(f"<path d='{poly(pts)}' fill='{INK}'/>")
    out.append(trees[1])
    out.append(f"<rect y='{f(Y(800))}' width='{W}' height='{f(H - Y(800))}' fill='url(#floor)'/>")
    out.append("</svg>")
    return "".join(out)


if __name__ == "__main__":
    # python3 tools/backgrounds/lake.py <wide.svg> [<tall.svg>]
    for path, tall in zip(sys.argv[1:3], (False, True)):
        svg = build(tall)
        open(path, "w").write(svg)
        print(path, len(svg), "bytes")
