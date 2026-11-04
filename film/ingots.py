"""ingots: one cast plaque per venture, for the foundry floor. Three stills shot with one camera and one light rig.

    sites    Crucible Sites: cast and cooled. Sand-cast steel with the raised name and Split Ring ground bright,
             sitting on dark foundry sand; one end still holds a little heat (a dull glow and temper colours).
    verge    Verge: freshly poured, still in its sand mould. Ember-orange metal, the raised bold serif V and name
             hottest, a thin dark crust forming where the metal meets the sand.
    trellis  Trellis: the same, with its lattice mark cast as a raised metal grid.

    bl/bin/python film/ingots.py --variant sites,verge,trellis --out <dir>                 # final: 2400x1500
    bl/bin/python film/ingots.py --variant verge --scale 0.25 --samples 16 --out <dir>    # preview
Writes <out>/<slug>.png. Fonts: film/fonts (Archivo ExtraBold for names, Gelasio SemiBold for Verge's V).
"""
import math
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402  (bpy first: it makes bmesh importable)
import bmesh  # noqa: E402
from common import C2, FONTS, Graph, aim, area_light, camera, cli, heat_emission, material, setup  # noqa: E402

MM = 0.001
W, D, H = 200.0, 112.0, 22.0  # plaque, mm
DRAFT = 2.5
RISE = 2.6  # raised letters, mm
SAND_RIM = 3.0  # in the mould, the sand stands this far above the metal

VENTURES = {
    'sites': dict(lines=('Crucible', 'Sites'), mark='ring', hot=False),
    'verge': dict(lines=('Verge',), mark='V', hot=True, seed=3),
    'trellis': dict(lines=('Trellis',), mark='lattice', hot=True, seed=9),
}


# ---------------------------------------------------------------------------------------------------------------
# geometry
# ---------------------------------------------------------------------------------------------------------------
def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob


def mesh_object(name, bm):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return link(bpy.data.objects.new(name, me))


def bevel(ob, width, segments=4, angle=40):
    m = ob.modifiers.new('bevel', 'BEVEL')
    m.width = width
    m.segments = segments
    m.limit_method = 'ANGLE'
    m.angle_limit = math.radians(angle)
    m.harden_normals = False
    return m


def frustum(name, w0, d0, w1, d1, z0, z1):
    """A box from z0 (w0 x d0) to z1 (w1 x d1), in mm, centred on the origin."""
    bm = bmesh.new()
    lo = [bm.verts.new((sx * w0 / 2 * MM, sy * d0 / 2 * MM, z0 * MM)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    hi = [bm.verts.new((sx * w1 / 2 * MM, sy * d1 / 2 * MM, z1 * MM)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    bm.faces.new(lo[::-1])
    bm.faces.new(hi)
    for k in range(4):
        bm.faces.new((lo[k], lo[(k + 1) % 4], hi[(k + 1) % 4], hi[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_object(name, bm)


def sand(name, cavity=None, plaque=None, half=240.0, step=2.0):
    """Foundry sand (mm units, z=0 is the nominal surface): a lumpy displaced grid. cavity=(w, d, depth, draft) cuts
    an open mould into it (with a crumbled rim); plaque=(w, d) pushes up a little berm where a plaque was set down."""
    from mathutils import Vector, noise

    def height(x, y):
        p = Vector((x / 22.0, y / 22.0, 0.3))
        h = 1.3 * noise.fractal(p, 0.55, 2.0, 4, noise_basis='PERLIN_ORIGINAL')
        h += 0.35 * noise.fractal(Vector((x / 4.5, y / 4.5, 7.1)), 0.6, 2.0, 3, noise_basis='PERLIN_ORIGINAL')
        c = noise.noise(Vector((x / 9.0, y / 9.0, 3.3)), noise_basis='PERLIN_ORIGINAL')
        h += 0.9 * max(0.0, c - 0.35)  # clumps
        rect = cavity or plaque
        if rect:
            dx, dy = abs(x) - rect[0] / 2, abs(y) - rect[1] / 2
            dist = max(dx, dy, 0.0)
            near = math.exp(-dist / 6.0)
            h *= 1.0 - 0.85 * near  # packed flat at the edge
            h += (0.9 if cavity else 1.4) * math.exp(-((dist - 3.0) / 4.0) ** 2)  # a lip / berm
        return h

    bm = bmesh.new()
    n = int(2 * half / step)
    grid = [[bm.verts.new(((-half + i * step) * MM, (-half + j * step) * MM, 0.0)) for i in range(n + 1)] for j in range(n + 1)]
    for j in range(n):
        for i in range(n):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    if cavity:
        cw, cd, depth, dr = cavity
        inside = [f for f in bm.faces if all(abs(v.co.x / MM) < cw / 2 + 0.5 and abs(v.co.y / MM) < cd / 2 + 0.5 for v in f.verts)]
        bmesh.ops.delete(bm, geom=inside, context='FACES_ONLY')
        bm.verts.ensure_lookup_table()
        for v in [v for v in bm.verts if not v.link_faces]:
            bm.verts.remove(v)
        edge = [e for e in bm.edges if e.is_boundary and abs(e.verts[0].co.x / MM) < half - 1 and abs(e.verts[0].co.y / MM) < half - 1]
        loop_verts = {v for e in edge for v in e.verts}
        for v in loop_verts:  # snap the hole onto the cavity rectangle (nearest point on its outline)
            x, y = v.co.x / MM, v.co.y / MM
            cx, cy = max(-cw / 2, min(cw / 2, x)), max(-cd / 2, min(cd / 2, y))
            cands = [(math.copysign(cw / 2, x), cy), (cx, math.copysign(cd / 2, y))]
            x, y = min(cands, key=lambda q: (q[0] - x) ** 2 + (q[1] - y) ** 2)
            v.co.x, v.co.y = x * MM, y * MM
        bm.verts.ensure_lookup_table()
    for v in bm.verts:
        v.co.z = height(v.co.x / MM, v.co.y / MM) * MM
    if cavity:
        ret = bmesh.ops.extrude_edge_only(bm, edges=edge)
        new = [g for g in ret['geom'] if isinstance(g, bmesh.types.BMVert)]
        for v in new:  # the walls narrow toward the bottom (draft), corners onto corners
            v.co.x *= (cw / 2 - dr) / (cw / 2)
            v.co.y *= (cd / 2 - dr) / (cd / 2)
            v.co.z = -depth * MM
        bot_edges = [g for g in ret['geom'] if isinstance(g, bmesh.types.BMEdge) and all(v in new for v in g.verts)]
        bmesh.ops.contextual_create(bm, geom=bot_edges)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = mesh_object(name, bm)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def text_mesh(name, body, font, size, extrude, bev, align='LEFT'):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.font = bpy.data.fonts.load(font, check_existing=True)
    cu.size = size
    cu.align_x = align
    cu.align_y = 'BOTTOM_BASELINE'
    cu.extrude = extrude
    cu.bevel_depth = bev
    cu.bevel_resolution = 4
    cu.resolution_u = 16
    cu.offset = -bev * 0.6  # keep the glyph outline where the font draws it, with the bevel inside
    ob = link(bpy.data.objects.new(name + '-curve', cu))
    return to_mesh(ob)


def curve_2d(name, loops, extrude, bev):
    """Filled 2D curve from polygon loops [(x, y), ...] (no overlaps within one object), extruded with a bevel."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '2D'
    cu.fill_mode = 'BOTH'
    cu.extrude = extrude
    cu.bevel_depth = bev
    cu.bevel_resolution = 4
    cu.offset = -bev * 0.6
    for loop in loops:
        sp = cu.splines.new('POLY')
        sp.points.add(len(loop) - 1)
        for p, (x, y) in zip(sp.points, loop):
            p.co = (x, y, 0, 1)
        sp.use_cyclic_u = True
    ob = link(bpy.data.objects.new(name + '-curve', cu))
    return to_mesh(ob)


def to_mesh(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    new = link(bpy.data.objects.new(ob.name.replace('-curve', ''), me))
    bpy.data.objects.remove(ob)
    return new


def bounds(obs):
    xs, ys = [], []
    for ob in obs:
        for v in ob.data.vertices:
            co = ob.matrix_world @ v.co
            xs.append(co.x)
            ys.append(co.y)
    return min(xs), max(xs), min(ys), max(ys)


def move(obs, dx=0.0, dy=0.0, dz=0.0, scale=None):
    for ob in obs:
        if scale is not None:
            ob.scale = (scale, scale, 1.0)
        ob.location = (ob.location.x + dx, ob.location.y + dy, ob.location.z + dz)
    bpy.context.view_layer.update()


def ring_mark(diam):
    """The Split Ring (lib/splitRing.ts geometry) as raised metal, `diam` = the 64-unit box, in metres."""
    k = diam / 64.0
    c, px, stroke, core = 32.0, 3.0, 3.0, 4.5
    rings = [(26.0, 11), (15.0, 7)]
    P = lambda x, y: ((x - c) * k, -(y - c) * k)  # noqa: E731  SVG y-down -> y-up, centred
    arcs, squares = [], []
    for r, n in rings:
        e = px / 2 / r
        a0, a1 = -math.pi / 2 + e, -3 * math.pi / 2 - e  # top (slightly right) -> left -> bottom
        steps = 64
        outer = [P(c + (r + stroke / 2) * math.cos(a0 + (a1 - a0) * t / steps), c + (r + stroke / 2) * math.sin(a0 + (a1 - a0) * t / steps)) for t in range(steps + 1)]
        inner = [P(c + (r - stroke / 2) * math.cos(a1 + (a0 - a1) * t / steps), c + (r - stroke / 2) * math.sin(a1 + (a0 - a1) * t / steps)) for t in range(steps + 1)]
        arcs.append(outer + inner)
        ins = px / 2 / r
        for i in range(n):
            a = -math.pi / 2 + ins + (math.pi - 2 * ins) * i / (n - 1)
            x, y = c + r * math.cos(a), c + r * math.sin(a)
            cs, sn = math.cos(a), math.sin(a)
            h = px / 2
            squares.append([P(x + p * cs - q * sn, y + p * sn + q * cs) for p, q in ((-h, -h), (h, -h), (h, h), (-h, h))])
    ext, bev = RISE * MM / 2, 0.45 * MM
    obs = [curve_2d('ring-arcs', arcs, ext, bev), curve_2d('ring-px', squares, ext, bev)]
    circ = [[P(c + core * math.cos(t * 2 * math.pi / 48), c + core * math.sin(t * 2 * math.pi / 48)) for t in range(48)]]
    obs.append(curve_2d('ring-core', circ, ext * 1.15, bev * 1.4))
    return obs


def lattice_mark(size):
    """Trellis: within a 1024 box, a 640 square centred on 512 with 64-unit bars. `size` = the 640 extent (m)."""
    k = size / 640.0
    bars = [(192, 296, 832, 360), (192, 480, 832, 544), (192, 664, 832, 728), (336, 192, 400, 832), (624, 192, 688, 832)]
    obs = []
    for j, (x0, y0, x1, y1) in enumerate(bars):
        P = lambda x, y: ((x - 512) * k, -(y - 512) * k)  # noqa: E731
        loop = [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)]
        obs.append(curve_2d(f'lattice-{j}', [loop], RISE * MM / 2, 0.45 * MM))
    return obs


def content(v, hot):
    """Mark + name, laid out on the plaque top (z = 0 here; moved up later)."""
    fz = os.path.join(FONTS, 'Archivo-ExtraBold.ttf')
    ext, bev = RISE * MM / 2, (0.55 if hot else 0.45) * MM
    # measure the font: cap height and line widths at size 1
    probe = text_mesh('probe', 'H', fz, 1.0, 0, 0)
    cap1 = bounds([probe])[3]
    bpy.data.objects.remove(probe)
    widths = []
    for ln in v['lines']:
        t = text_mesh('probe', ln, fz, 1.0, 0, 0)
        b = bounds([t])
        widths.append(b[1] - b[0])
        bpy.data.objects.remove(t)
    nl = len(v['lines'])
    lead = 1.38  # baseline-to-baseline, in cap heights
    block_h = 1 + lead * (nl - 1)  # cap heights
    mark_h = max(1.6, block_h)  # the mark spans the name block
    gap = 0.5
    name_w = max(widths) / cap1
    avail_w, avail_h = W - 40, D - 36
    cap = min(avail_w / (mark_h + gap + name_w), avail_h / mark_h, 30.0) * MM
    size = cap / cap1
    obs = []
    # name lines, left-aligned, top line first
    x_name = (mark_h + gap) * cap
    top_base = (block_h - 1) * cap
    for i, ln in enumerate(v['lines']):
        t = text_mesh(f'name{i}', ln, fz, size, ext, bev)
        t.location = (x_name, top_base - i * lead * cap, 0)
        obs.append(t)
    # mark, centred on the name block
    mh = mark_h * cap
    cy = block_h * cap / 2
    if v['mark'] == 'ring':
        m = ring_mark(mh * 64 / 55)  # the ring's outer diameter is 55 of its 64-unit box
    elif v['mark'] == 'lattice':
        m = lattice_mark(mh)
    else:
        vf = os.path.join(FONTS, 'Gelasio-SemiBold.ttf')
        probe = text_mesh('probe', 'V', vf, 1.0, 0, 0)
        b = bounds([probe])
        bpy.data.objects.remove(probe)
        vsize = mh / (b[3] - b[2])
        m = [text_mesh('markV', 'V', vf, vsize, ext, bev, align='CENTER')]
        bpy.context.view_layer.update()
        b = bounds(m)
        m[0].location = (0, -(b[2] + b[3]) / 2, 0)
    bpy.context.view_layer.update()
    for ob in m:
        ob.location = (ob.location.x + mh / 2, ob.location.y + cy, ob.location.z)
    obs += m
    bpy.context.view_layer.update()
    x0, x1, y0, y1 = bounds(obs)
    # centre the group on the plaque, using the cap-height block (descenders hang below)
    dx = -(0 + (mark_h + gap + name_w) * cap) / 2
    dy = -cy + 1.5 * MM
    move(obs, dx, dy, 0)
    return obs


# ---------------------------------------------------------------------------------------------------------------
# materials
# ---------------------------------------------------------------------------------------------------------------
def mm_coords(g, ob=None):
    tc = g.node('ShaderNodeTexCoord')
    if ob is not None:
        tc.object = ob  # everything in the plaque's own space, so raised parts and body share one texture space
    return g.v('SCALE', tc.outputs['Object'], scale=1000.0), tc


def cast_grain(g, P, amp=1.0):
    """Sand-cast surface height (mm): imprinted sand grains, fine noise, a few pores."""
    gv = g.voronoi(P, 2.4, 'SMOOTH_F1', rand=1.0, smooth=0.5).outputs['Distance']
    grain = g.mul(g.sub(0.6, gv), 0.03 * amp)
    fine = g.mul(g.sub(g.noise(P, 5.0, detail=3, rough=0.6).outputs['Fac'], 0.5), 0.015 * amp)
    pn = g.noise(g.v('ADD', P, (13, 4, 2)), 0.9, detail=3, rough=0.6).outputs['Fac']
    pores = g.mul(g.smooth(0.68, 0.75, pn), -0.05 * amp)
    return g.add(g.add(grain, fine), pores), gv, pn


def cool_metal(plaque, raised):
    """Cooled sand-cast steel, bone-tinted. Raised = the name/mark: tops ground flat and bright, with sanding
    scratches; the cast field around them stays matte. One end still holds a little heat: temper colours on the
    way in, then dark oxide and a faint dull-red glow at the very edge."""
    m, g, out = material(f'cool-{"raised" if raised else "body"}')
    P, tc = mm_coords(g, plaque)
    px, py, pz = g.sep(P)
    h, gv, pn = cast_grain(g, P, 0.3 if raised else 1.0)
    nz = g.sep(tc.outputs['Normal'])[2]
    top = g.smooth(0.94, 0.99, nz) if raised else 0.0
    scr = g.noise(g.comb(g.mul(px, 0.05), g.mul(py, 18.0), g.mul(pz, 2.0)), 1.0, detail=3, rough=0.6).outputs['Fac']
    if raised:
        h = g.lerp(h, g.mul(g.sub(scr, 0.5), 0.003), top)
    disp = g.node('ShaderNodeDisplacement', {'Height': h, 'Midlevel': 0.0, 'Scale': 0.001}, space='OBJECT')
    g.nt.links.new(disp.outputs[0], out.inputs['Displacement'])
    ao = g.node('ShaderNodeAmbientOcclusion', {'Distance': 0.003}, samples=8, inside=False).outputs['AO']
    crev = g.smooth(0.8, 0.3, ao)
    v1 = g.noise(g.v('ADD', P, (40, 1, 0)), 0.22, detail=4, rough=0.55).outputs['Fac']
    v2 = g.noise(g.v('ADD', P, (3, 9, 0)), 0.03, detail=2).outputs['Fac']
    cast = g.mix_rgb((0.33, 0.32, 0.30), (0.42, 0.405, 0.375), g.add(g.mul(g.smooth(0.3, 0.7, v1), 0.6), g.mul(v2, 0.4)))
    cast = g.mix_rgb(cast, (0.24, 0.235, 0.225), g.mul(g.smooth(0.55, 0.3, gv), 0.5))  # sand-grain pockets
    base = g.mix_rgb(cast, (0.74, 0.71, 0.645), top) if raised else cast
    base = g.mix_rgb(base, (0.16, 0.09, 0.05), g.mul(crev, 0.55))  # a little oxide where it can't be reached
    x = g.div(g.sub(px, W / 2 - 60), 60.0)  # 0 -> 1 toward the warm end
    x = g.add(x, g.mul(g.sub(g.noise(P, 0.08, detail=2).outputs['Fac'], 0.5), 0.18))
    temper = g.ramp(g.clamp01(x), [(0.0, (1, 1, 1)), (0.3, (1.0, 0.9, 0.66)), (0.48, (0.88, 0.62, 0.4)),
                                   (0.62, (0.62, 0.4, 0.55)), (0.75, (0.42, 0.5, 0.75)), (0.88, (0.5, 0.5, 0.55)), (1.0, (0.3, 0.29, 0.29))])
    base = g.mix_rgb(base, temper, 0.85, blend='MULTIPLY')
    rough = g.add(g.remap(v1, 0.3, 0.7, 0.5, 0.7), g.mul(g.sub(gv, 0.5), 0.15))
    if raised:
        rough = g.lerp(rough, g.add(0.17, g.mul(scr, 0.12)), top)
    rough = g.lerp(rough, 0.85, g.mul(crev, 0.5))
    T = g.add(300.0, g.mul(g.pw(g.clamp01(g.div(g.sub(px, W / 2 - 18), 18.0)), 2.0), 720.0))
    col, strength = heat_emission(g, T, C2 / 1150.0, 0.3)
    bsdf = g.node('ShaderNodeBsdfPrincipled', {'Base Color': base, 'Metallic': g.lerp(0.92, 0.3, crev), 'Roughness': rough,
                                               'Emission Color': col, 'Emission Strength': strength})
    g.nt.links.new(bsdf.outputs[0], out.inputs['Surface'])
    m.displacement_method = 'BUMP'
    return m


HOT_TE, HOT_GAIN = 1440.0, 0.18  # the body of the melt (1440 K, Ember) renders at 0.18


def hot_metal(plaque, raised, seed=0):
    """Freshly poured metal in the mould: Ember body, the raised name/mark hottest, a dark crust creeping in from the
    sand walls (plates with glowing seams), a wrinkled oxide skin starting to form, and a sheen on the liquid."""
    m, g, out = material(f'hot-{"raised" if raised else "body"}')
    m.cycles.emission_sampling = 'FRONT'  # it lights the mould around it
    P0, tc = mm_coords(g, plaque)
    px, py, pz = g.sep(P0)
    P = g.v('ADD', P0, (seed * 17.0, seed * 5.0, 0.0))
    dwall = g.mn(g.sub(W / 2, g.m('ABSOLUTE', px)), g.sub(D / 2, g.m('ABSOLUTE', py)))
    wob = g.noise(P, 0.07, detail=3, rough=0.6).outputs['Fac']
    dw = g.add(dwall, g.mul(g.sub(wob, 0.5), 14.0))
    crust = 0.0 if raised else g.smooth(9.0, 3.0, dw)
    warp = g.v('SUBTRACT', g.noise(P, 0.25, detail=2).outputs['Color'], (0.5, 0.5, 0.5))
    Pw = g.v('ADD', P, g.v('SCALE', warp, scale=2.0))
    ce = g.div(g.voronoi(Pw, 0.42, 'DISTANCE_TO_EDGE', rand=1.0, dims='2D').outputs['Distance'], 0.42)
    seam = g.sub(1.0, g.smooth(0.03, 0.16, ce))
    wr = g.noise(g.comb(g.mul(px, 0.7), g.mul(py, 0.28), 0.0), 1.0, detail=4, rough=0.55, distortion=0.8).outputs['Fac']
    ripple = g.noise(P, 0.045, detail=2).outputs['Fac']
    skin = 0.1 if raised else g.add(0.1, g.mul(g.smooth(22.0, 5.0, dw), 0.9))
    h = g.add(g.mul(g.sub(ripple, 0.5), 0.35), g.mul(g.mul(g.sub(wr, 0.5), 0.09), skin))
    if not raised:
        h = g.add(h, g.mul(crust, g.add(0.05, g.mul(g.smooth(0.0, 0.6, ce), 0.12))))
    disp = g.node('ShaderNodeDisplacement', {'Height': h, 'Midlevel': 0.0, 'Scale': 0.001}, space='OBJECT')
    g.nt.links.new(disp.outputs[0], out.inputs['Displacement'])
    tn = g.noise(g.v('ADD', P, (5, 5, 0)), 0.035, detail=3).outputs['Fac']
    if raised:
        nz = g.sep(tc.outputs['Normal'])[2]
        T = g.add(1590.0, g.add(g.mul(g.sub(tn, 0.5), 50.0), g.mul(nz, 25.0)))  # hottest; the tops a touch hotter
    else:
        centre = g.smooth(5.0, 45.0, dwall)  # it cools from the walls in
        T = g.add(g.add(1370.0, g.mul(centre, 100.0)), g.mul(g.sub(tn, 0.5), 80.0))
        T = g.sub(T, g.mul(g.mul(g.smooth(0.45, 0.8, wr), 90.0), skin))  # wrinkle crests cool first
        T_crust = g.add(g.add(930.0, g.mul(seam, 330.0)), g.mul(g.smooth(3.0, 9.0, dw), 150.0))
        T = g.lerp(T, T_crust, crust)
    col, strength = heat_emission(g, T, C2 / HOT_TE, HOT_GAIN)
    base = g.mix_rgb((0.36, 0.35, 0.33), (0.06, 0.055, 0.05), crust)
    rough = g.lerp(g.add(0.1, g.mul(skin, 0.2)), 0.55, crust) if not raised else 0.14
    bsdf = g.node('ShaderNodeBsdfPrincipled', {'Base Color': base, 'Metallic': g.lerp(1.0, 0.3, crust), 'Roughness': rough,
                                               'Emission Color': col, 'Emission Strength': strength})
    g.nt.links.new(bsdf.outputs[0], out.inputs['Surface'])
    m.displacement_method = 'BUMP'
    return m


def sand_material(hot, cavity=None):
    """Dark foundry sand: individual grains (some catch the light), clumps. In a mould, the sand where the metal
    touches it is scorched black and glows dull red right at the contact."""
    m, g, out = material('sand')
    P, tc = mm_coords(g)
    px, py, pz = g.sep(P)
    vg = g.voronoi(P, 2.8, 'F1', rand=1.0)
    g1, gc = vg.outputs['Distance'], vg.outputs['Color']
    g2 = g.voronoi(g.v('ADD', P, (3, 7, 1)), 1.2, 'SMOOTH_F1', rand=1.0, smooth=0.4).outputs['Distance']
    lump = g.noise(g.v('ADD', P, (2, 2, 2)), 0.28, detail=3, rough=0.6).outputs['Fac']
    h = g.add(g.add(g.mul(g.sub(0.5, g1), 0.06), g.mul(g.sub(0.5, g2), 0.08)), g.mul(lump, 0.3))
    disp = g.node('ShaderNodeDisplacement', {'Height': h, 'Midlevel': 0.0, 'Scale': 0.001}, space='OBJECT')
    g.nt.links.new(disp.outputs[0], out.inputs['Displacement'])
    gr, gg, gb = g.node('ShaderNodeSeparateColor', {'Color': gc}).outputs
    cn = g.noise(g.v('ADD', P, (9, 2, 0)), 0.05, detail=3).outputs['Fac']
    base = g.mix_rgb((0.04, 0.038, 0.034), (0.085, 0.078, 0.068), g.smooth(0.3, 0.75, cn))
    base = g.mix_rgb(base, (0.15, 0.14, 0.125), g.mul(g.smooth(0.75, 0.95, gr), 0.7))  # light grains
    base = g.mix_rgb(base, (0.025, 0.023, 0.02), g.mul(g.smooth(0.3, 0.05, gg), 0.8))  # coal-dark grains
    rough = g.lerp(0.92, 0.38, g.smooth(0.9, 0.97, gb))  # a few glassy grains glint
    em, col = 0.0, (0, 0, 0)
    if hot and cavity is not None:
        cw, cd = cavity
        dx = g.sub(g.m('ABSOLUTE', px), cw / 2)
        dy = g.sub(g.m('ABSOLUTE', py), cd / 2)
        # distance (mm) from the line where metal meets sand: up the wall, then out across the top
        dist = g.add(g.mx(g.mx(dx, dy), 0.0), g.mx(g.add(pz, SAND_RIM), 0.0))
        near = g.exp(g.mul(dist, -0.55))
        base = g.mix_rgb(base, (0.018, 0.016, 0.014), g.smooth(14.0, 0.0, dist))
        T = g.add(320.0, g.mul(near, 870.0))
        col, em = heat_emission(g, T, C2 / HOT_TE, HOT_GAIN * 0.8)
    bsdf = g.node('ShaderNodeBsdfPrincipled', {'Base Color': base, 'Metallic': 0.0, 'Roughness': rough,
                                               'Emission Color': col, 'Emission Strength': em})
    g.nt.links.new(bsdf.outputs[0], out.inputs['Surface'])
    m.displacement_method = 'BUMP'
    return m


def build(slug, a):
    v = VENTURES[slug]
    hot = v['hot']
    sc = setup((2400, 1500), a.scale, a.samples, seed=5, bounces=(6, 3, 4))
    sc.cycles.adaptive_threshold = 0.015
    if hot:
        top = 0.0  # the metal surface; the sand rim stands SAND_RIM above it
        cav = (W + 1.0, D + 1.0)
        sand_ob = sand('sand', cavity=(*cav, H + SAND_RIM, DRAFT))
        sand_ob.location.z = (top + SAND_RIM) * MM
        body = frustum('plaque', W - 2 * DRAFT, D - 2 * DRAFT, W, D, top - H, top)
        bevel(body, 2.0 * MM, 5, angle=40)
        sand_ob.data.materials.append(sand_material(True, cav))
        body.data.materials.append(hot_metal(body, False, v.get('seed', 0)))
        raised_mat = hot_metal(body, True, v.get('seed', 0))
    else:
        sink = 1.0
        top = H - sink
        sand_ob = sand('sand', plaque=(W, D))
        body = frustum('plaque', W, D, W - 2 * DRAFT, D - 2 * DRAFT, -sink, top)
        bevel(body, 2.6 * MM, 5, angle=40)
        sand_ob.data.materials.append(sand_material(False))
        body.data.materials.append(cool_metal(body, False))
        raised_mat = cool_metal(body, True)
    for p in body.data.polygons:
        p.use_smooth = True
    obs = content(v, hot)
    for ob in obs:
        ob.location.z = top * MM + RISE * MM / 2 - 0.25 * MM
        ob.data.materials.clear()
        ob.data.materials.append(raised_mat)
        for p in ob.data.polygons:
            p.use_smooth = True

    # one camera for the set: 3/4 from the front-left, slightly above, long lens, focus on the name
    target = (0.0, 0.0, top * MM)
    cam = camera(lens=150, fstop=5.6)
    el, az, dist = math.radians(30), math.radians(-18), 1.22
    cdir = (math.cos(el) * math.sin(az), -math.cos(el) * math.cos(az), math.sin(el))
    cam.location = tuple(target[k] + dist * cdir[k] for k in range(3))
    aim(cam, target)
    cam.data.dof.focus_distance = dist
    # warm low key from the front (furnace glow), cool faint fill from above, a rim from behind-left for the bevels,
    # and a soft overhead panel placed where the camera sees it mirrored: ground metal and liquid metal catch it
    area_light('key', (0.30, -0.85, 0.07), (0, 0, 0.01), 1.8, 0.3, kelvin=2300)
    area_light('fill', (-0.2, -0.1, 1.5), (0, 0, 0), 12.0, 1.4, kelvin=9000)
    area_light('rim', (-0.5, 0.85, 0.12), (0, 0, 0.01), 7.0, 0.25, kelvin=3200)
    mir = (-cdir[0], -cdir[1], cdir[2])
    area_light('panel', tuple(target[k] + 0.9 * mir[k] for k in range(3)), target, 0.3 if hot else 2.5, 0.7, kelvin=5200, shape='RECTANGLE',
               size_y=0.28)
    return sc


def main():
    a = cli('0', 160)
    for slug in (a.variant or 'sites,verge,trellis').split(','):
        path = os.path.join(a.out, f'{slug}.png')
        if a.skip_existing and os.path.exists(path):
            continue
        sc = build(slug, a)
        sc.render.filepath = path
        t = time.time()
        bpy.ops.render.render(write_still=True)
        print(f'[ingots] {slug} {time.time() - t:.1f}s', flush=True)


if __name__ == '__main__':
    main()
