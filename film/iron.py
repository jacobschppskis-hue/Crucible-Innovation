"""iron: the Thesis scene. A macro shot of a cast-iron surface heated from 293 K to 1811 K across 96 frames.

Frame i is at T = 293 + i / 95 * 1518 K. The surface is an oxide crust (mill scale) over iron, crazed into plates.
As the metal heats, the hairline cracks open and the iron under them glows first (nothing visible below ~800 K),
the glow spreads into the plates, everything goes orange then yellow-white, and in the last frames the crust breaks
up into floating slag islands on slowly moving liquid metal. The camera slowly pushes in throughout.

Emission is Blackbody(T) with strength from Wien's law, so colour and brightness follow physics; the camera's
exposure "auto-adjusts" (it follows the hottest temperature with some lag), as a real camera would.

    bl/bin/python film/iron.py --frames 0-95 --out <dir>            # final: 1600x900
    bl/bin/python film/iron.py --frames 0,40,70,95 --scale 0.25 --samples 8 --out <dir>   # preview
"""
import math
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from common import C2, area_light, camera, cli, material, heat_emission, render_frames, setup, aim  # noqa: E402

N = 96
T0, T1 = 293.0, 1811.0


LENS = 105.0
# Rendered frames: every 3rd through the solid phase (nothing moves there except a smooth temperature step, so
# encode.py synthesises the frames between by scaling the neighbours to the in-between zoom and blending them), and
# every frame of the melt, where the surface flows.
KEYS = sorted(set(range(0, 77, 3)) | {76} | set(range(77, N)))


def zoom(i):
    """The push-in: a slow 1.0x -> 1.32x zoom across the sequence."""
    return 1.0 + 0.32 * i / (N - 1)


def smooth(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def exposure_temp(f, Tc, gain=0.3):
    """The camera's auto exposure, as the temperature that renders at `gain`. Fixed while only the cracks glow,
    then it lets the crack seams climb from 0.3 to ~1.0 (orange to yellow-white) through the solid phase, and once
    it is liquid it exposes the bulk of the melt (~T - 20 K, emissivity 0.6) at ~0.13, so the welling filaments,
    seams and sheen carry the highlights."""
    if f <= 0.5:
        return 1150.0
    lnB = math.log(0.3) + (math.log(1.0) - math.log(0.3)) * smooth(0.5, 0.79, f) ** 1.5
    inv_solid = 1 / Tc + math.log(gain / math.exp(lnB)) / C2 * -1
    T = T0 + f * (T1 - T0)
    inv_liq = 1 / (T - 20) + math.log(0.16 / gain) / C2
    return 1 / (inv_solid + (inv_liq - inv_solid) * smooth(0.79, 0.95, f))


def params(i):
    """Everything that changes with the frame, derived from the temperature."""
    f = i / (N - 1)
    T = T0 + f * (T1 - T0)
    s = smooth(1000, 1811, T)
    Tc = T + 95  # the iron under the cracks (heat comes from below)
    dp = 175 - 80 * s  # how much cooler the crust plates are
    melt = smooth(0.80, 1.0, f) if f > 0.8 else 0.0
    # Auto exposure: fixed until the hottest metal passes 1150 K, then follows it with lag.
    Te = exposure_temp(f, Tc)
    return dict(
        T=T,
        Tc=Tc,
        Tp=T - dp,
        spread=0.08 + 0.75 * smooth(850, 1750, T),  # mm: how far heat glows out from a crack into the plate
        width=0.035 + 0.11 * smooth(650, 1650, T),  # mm: crack half-width (opens as it expands)
        craze=smooth(1050, 1400, T),  # fine secondary crazing appears
        melt=melt,
        flow=max(0.0, (f - 0.78) / 0.22),  # time since it started to melt, for the liquid motion
        te_inv=C2 / Te,
        env=0.3 * math.exp(C2 / Te - C2 / max(T - 60, 400)),  # the furnace around it heats up too
        expo=math.exp(C2 / Te - C2 / 1150),  # what the auto exposure does to reflected light
    )


# The surface is planar and almost everything about it is static, so its fields are baked once (an orthographic
# top-down render of the procedural fields into float EXRs) and each frame only samples them. That cut the per-frame
# cost ~5x on a shared 4-core machine. Bake region in mm (covers the whole camera move plus the liquid's drift):
X0, Y0, SIZE = -64.0, -56.0, 128.0


def build_fields():
    """The procedural surface, as 4 RGB fields (all in mm, from object coordinates):
    F1 = (main crack distance d1, crazing distance d2, crack-width wander)
    F2 = (plate random, plate tilt/height offset + 0.5, static micro height + 0.5)
    F3 = (temperature noise, mill-scale mask, roughness)
    F4 = (iron tint on the grain tops, pit mask, marbling noise for the melt)"""
    m, g, out = material('fields')
    tc = g.node('ShaderNodeTexCoord')
    P = g.v('SCALE', tc.outputs['Object'], scale=1000.0)
    px, py, _ = g.sep(P)

    def at(offset, k=1.0):
        return g.comb(g.mad(px, k, offset[0]), g.mad(py, k, offset[1]), 0.0)

    P2 = at((0, 0))
    w1 = g.v('SUBTRACT', g.noise(P2, 0.065, detail=3, rough=0.55, dims='2D').outputs['Color'], (0.5, 0.5, 0.5))
    w2 = g.v('SUBTRACT', g.noise(P2, 0.5, detail=2, rough=0.5, dims='2D').outputs['Color'], (0.5, 0.5, 0.5))
    Pw = g.v('ADD', g.v('ADD', P2, g.v('SCALE', w1, scale=9.0)), g.v('SCALE', w2, scale=0.7))
    S1, S2 = 0.10, 0.27
    d1 = g.div(g.voronoi(Pw, S1, 'DISTANCE_TO_EDGE', rand=0.95, dims='2D').outputs['Distance'], S1)
    cell = g.voronoi(Pw, S1, 'F1', rand=0.95, dims='2D')  # the same cells: per-plate random values
    cr, cg, cb = g.node('ShaderNodeSeparateColor', {'Color': cell.outputs['Color']}).outputs
    Pw2 = g.v('ADD', g.v('ADD', Pw, (31.7, 11.3, 0)), g.v('SCALE', w2, scale=0.5))
    d2 = g.div(g.voronoi(Pw2, S2, 'DISTANCE_TO_EDGE', rand=1.0, dims='2D').outputs['Distance'], S2)
    wmul = g.smooth(0.3, 0.62, g.noise(at((5.1, 9.2)), 0.2, detail=2, dims='2D').outputs['Fac'])
    rel = g.v('SUBTRACT', Pw, cell.outputs['Position'])
    tilt = g.mul(g.v('DOT_PRODUCT', rel, g.comb(g.sub(cg, 0.5), g.sub(cb, 0.5), 0.0)), 0.012)
    celloff = g.add(g.mul(g.sub(cr, 0.5), 0.06), tilt)
    gv = g.voronoi(at((3, 1)), 2.6, 'SMOOTH_F1', rand=1.0, dims='2D', smooth=0.5).outputs['Distance']
    grain = g.mul(g.sub(0.6, gv), 0.03)
    gv2 = g.voronoi(at((7, 2)), 7.0, 'F1', rand=1.0, dims='2D').outputs['Distance']
    grain2 = g.mul(g.sub(0.5, gv2), 0.008)
    fine = g.mul(g.sub(g.noise(P2, 4.0, detail=4, rough=0.65, dims='2D').outputs['Fac'], 0.5), 0.02)
    pitn = g.noise(at((13, 4)), 0.7, detail=3, rough=0.6, dims='2D').outputs['Fac']
    pits = g.mul(g.smooth(0.67, 0.74, pitn), -0.06)
    large = g.mul(g.sub(g.noise(P2, 0.022, detail=2, dims='2D').outputs['Fac'], 0.5), 0.7)
    h_static = g.add(g.add(grain, grain2), g.add(g.add(fine, pits), large))
    tn = g.noise(at((2, 7)), 0.16, detail=3, dims='2D').outputs['Fac']
    rn = g.noise(at((40, 1)), 0.35, detail=4, rough=0.6, dims='2D').outputs['Fac']
    scalew = g.smooth(0.45, 0.62, g.add(rn, g.mul(g.sub(cb, 0.5), 0.35)))
    tops = g.smooth(0.0, 0.4, g.sub(0.62, gv))
    rough = g.lerp(g.add(g.lerp(0.5, 0.26, tops), g.mul(g.sub(cg, 0.5), 0.14)), 0.42, scalew)
    tint = g.mul(tops, g.sub(1.0, scalew))
    pitmask = g.smooth(0.62, 0.73, pitn)
    mv = g.noise(P2, 0.09, detail=3, rough=0.5, dims='2D').outputs['Fac']
    fields = [
        (d1, d2, wmul),
        (cr, g.add(celloff, 0.5), g.add(h_static, 0.5)),
        (tn, scalew, rough),
        (tint, pitmask, mv),
    ]
    em = g.node('ShaderNodeEmission', {'Strength': 1.0})
    g.nt.links.new(em.outputs[0], out.inputs['Surface'])
    return m, g, em, fields


def bake_fields(cache, res):
    paths = [os.path.join(cache, f'field{k + 1}-{res}.exr') for k in range(4)]
    if all(os.path.exists(p) for p in paths):
        return paths
    os.makedirs(cache, exist_ok=True)
    sc = setup((res, res), 1.0, 1, seed=1)
    c = sc.cycles
    c.use_denoising = False
    c.use_adaptive_sampling = False
    c.max_bounces = 0
    sc.cycles.filter_width = 0.01  # point-sample texel centres: these are data, not pictures
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    sc.render.image_settings.file_format = 'OPEN_EXR'
    sc.render.image_settings.color_depth = '32'
    sc.render.image_settings.exr_codec = 'ZIP'
    bpy.ops.mesh.primitive_plane_add(size=0.3)
    plane = bpy.context.object
    m, g, em, fields = build_fields()
    plane.data.materials.append(m)
    cd = bpy.data.cameras.new('top')
    cd.type = 'ORTHO'
    cd.ortho_scale = SIZE / 1000
    co = bpy.data.objects.new('top', cd)
    sc.collection.objects.link(co)
    sc.camera = co
    co.location = ((X0 + SIZE / 2) / 1000, (Y0 + SIZE / 2) / 1000, 1.0)
    for path, (a, b, cc) in zip(paths, fields):
        comb = g.node('ShaderNodeCombineColor')
        for k, v in enumerate((a, b, cc)):
            g.nt.links.new(v, comb.inputs[k])
        g.nt.links.new(comb.outputs[0], em.inputs['Color'])
        sc.render.filepath = path
        t = time.time()
        bpy.ops.render.render(write_still=True)
        print(f'[iron] baked {os.path.basename(path)} in {time.time() - t:.1f}s', flush=True)
    return paths


def build(paths, liquid):
    """The per-frame material. `liquid` adds the melt (animated flow, slag marbling, ripples); frames before the
    melt use the cheaper solid-only graph."""
    m, g, out = material('iron-liquid' if liquid else 'iron-solid')
    m.displacement_method = 'BUMP'
    m.cycles.emission_sampling = 'NONE'  # the whole plane emits: sampling it as a light costs a shader eval per ray
    V = {k: g.value(0.0, k) for k in ('T', 'Tc', 'Tp', 'spread', 'width', 'craze', 'melt', 'flow', 'te_inv', 'gain')}
    melt = V['melt'].outputs[0]
    flow = V['flow'].outputs[0]
    width = V['width'].outputs[0]
    imgs = [bpy.data.images.load(p, check_existing=True) for p in paths]
    for im in imgs:
        im.colorspace_settings.name = 'Non-Color'

    def tex(k, Q, cubic=False):
        uv = g.v('SCALE', g.v('SUBTRACT', Q, (X0, Y0, 0.0)), scale=1.0 / SIZE)
        n = g.node('ShaderNodeTexImage', {'Vector': uv}, image=imgs[k], interpolation='Cubic' if cubic else 'Linear',
                   extension='EXTEND')
        return g.node('ShaderNodeSeparateColor', {'Color': n.outputs['Color']}).outputs

    tc = g.node('ShaderNodeTexCoord')
    px, py, _ = g.sep(g.v('SCALE', tc.outputs['Object'], scale=1000.0))  # millimetres
    P2 = g.comb(px, py, 0.0)

    def warp_noise(Q, k, t, detail):
        x, y, _ = g.sep(Q)
        n = g.noise(g.comb(g.mul(x, k), g.mul(y, k), t), 1.0, detail=detail, dims='3D').outputs['Color']
        return g.v('SUBTRACT', n, (0.5, 0.5, 0.5))

    if liquid:  # a slow swirl and drift once it melts
        sw = warp_noise(P2, 0.06, g.mul(flow, 0.5), 2)
        drift = g.comb(g.mul(flow, 2.0), g.mul(flow, -3.0), 0.0)
        Pl = g.v('ADD', P2, g.v('SCALE', g.v('ADD', g.v('SCALE', sw, scale=8.0), drift), scale=g.pw(melt, 1.5)))
    else:
        Pl = P2
    d1, d2, wmul = tex(0, Pl)
    cr, celloff, hst = tex(1, Pl, cubic=True)
    celloff, hst = g.sub(celloff, 0.5), g.sub(hst, 0.5)
    tn, scalew, rough_s = tex(2, Pl)
    tint, pitmask, _ = tex(3, Pl)

    # -- the crack network opens with the heat; in the melt the plates shrink into floating islands
    d2 = g.add(d2, g.add(g.mul(g.sub(1.0, V['craze'].outputs[0]), 3.0), g.mul(melt, 6.0)))
    w_1 = g.mul(width, g.add(0.2, g.mul(wmul, 1.1)))
    w_2 = g.mul(w_1, 0.5)
    if liquid:
        w_1 = g.add(w_1, g.add(g.mul(g.pw(melt, 1.3), 2.0), g.mul(g.pw(melt, 4.0), 0.8)))
        w_2 = g.add(w_2, g.mul(melt, 2.0))
    e1 = g.sub(d1, w_1)  # distance from the crack wall, mm (negative = inside the crack)
    e2 = g.sub(d2, w_2)
    e = g.mn(e1, e2)
    crack = g.sub(1.0, g.smooth(-0.04, 0.015, e))

    # -- heights (mm), used as bump
    opening = g.remap(width, 0.035, 0.145, 0.35, 1.0)
    plate = g.smooth(-0.02, 0.16, e)  # bevelled plate edges
    plate_h = g.mul(plate, g.add(g.mul(opening, 0.07), celloff))
    dome = g.mul(g.smooth(0.0, 2.5, e1), 0.02)
    h = g.add(g.add(plate_h, dome), hst)
    if liquid:
        x, y, _ = g.sep(Pl)
        ripple = g.noise(g.comb(g.mul(x, 0.13), g.mul(y, 0.13), g.mul(flow, 1.2)), 1.0, detail=3, dims='3D').outputs['Fac']
        # the liquid is smooth (ripples only); floating crust keeps its cast grain
        h_liq = g.add(g.mul(g.sub(ripple, 0.5), 0.26), g.mul(plate, 0.06))
        h = g.lerp(h, h_liq, g.mul(melt, crack))
    disp = g.node('ShaderNodeDisplacement', {'Height': h, 'Midlevel': 0.0, 'Scale': 0.001}, space='OBJECT')
    g.nt.links.new(disp.outputs[0], out.inputs['Displacement'])

    # -- temperature: the main cracks carry the heat; the fine crazing is shallower and runs cooler
    spread = V['spread'].outputs[0]
    halo1 = g.mx(g.exp(g.div(g.mul(g.mx(e1, 0.0), -1.0), spread)), g.sub(1.0, g.smooth(-0.04, 0.015, e1)))
    halo2 = g.mx(g.exp(g.div(g.mul(g.mx(e2, 0.0), -1.6), spread)), g.sub(1.0, g.smooth(-0.04, 0.015, e2)))
    halo = g.mx(halo1, g.mul(halo2, 0.55))
    Tp, Tc = V['Tp'].outputs[0], V['Tc'].outputs[0]
    T = g.add(g.lerp(Tp, Tc, halo), g.add(g.mul(g.sub(tn, 0.5), 70.0), g.mul(g.sub(cr, 0.5), 30.0)))
    if liquid:
        # slag collects into marbled filaments stretched by the current; hot metal wells up in thin bright seams
        lw = warp_noise(Pl, 0.09, g.mul(flow, 0.7), 2)
        Plc = g.v('ADD', Pl, g.v('SCALE', lw, scale=5.0))
        mw = warp_noise(Plc, 0.05, g.mul(flow, 0.35), 3)
        Pm = g.v('ADD', Plc, g.v('SCALE', mw, scale=14.0))
        mv = tex(3, Pm)[2]
        lbreak = g.smooth(0.38, 0.62, tex(2, g.v('ADD', Pm, (3.0, 3.0, 0.0)))[0])
        lwid = g.mul(g.add(0.006, g.mul(lbreak, 0.03)), g.smooth(0.35, 1.0, melt))
        lace = g.sub(1.0, g.smooth(g.mul(lwid, 0.3), g.add(lwid, 0.004), g.m('ABSOLUTE', g.sub(mv, 0.5))))
        lace = g.mul(lace, g.smooth(0.35, 1.0, melt))
        island = g.sub(1.0, crack)
        cx, cy, _ = g.sep(Plc)
        rid = g.noise(g.comb(g.mul(cx, 0.3), g.mul(cy, 0.3), g.mul(flow, 0.8)), 1.0, detail=2, dims='3D').outputs['Fac']
        lx, ly, _ = g.sep(Pl)
        lt = g.noise(g.comb(g.mul(lx, 0.11), g.mul(ly, 0.11), g.mul(flow, 0.165)), 1.0, detail=3, dims='3D').outputs['Fac']
        # broad hot and cooler zones; welling filaments cluster in the hot ones; a hot rim of fresh metal
        # outlines each floating crust plate
        fil = g.smooth(0.9, 0.99, g.sub(1.0, g.m('ABSOLUTE', g.sub(g.mul(rid, 2.0), 1.0))))
        fil = g.mul(fil, g.smooth(0.42, 0.72, lt))
        rim = g.mul(g.smooth(-0.45, -0.05, e), crack)
        T_liq = g.sub(g.add(V['T'].outputs[0], g.mul(g.sub(lt, 0.5), 240.0)), g.mul(island, g.add(380.0, g.mul(cr, 150.0))))
        T_liq = g.add(g.sub(T_liq, 20.0), g.sub(g.add(g.mul(fil, 300.0), g.mul(rim, 170.0)), g.mul(lace, 300.0)))
        T = g.lerp(T, T_liq, melt)
        slag = g.mx(island, lace)
    col, strength = heat_emission(g, T, V['te_inv'].outputs[0], V['gain'].outputs[0])
    if liquid:  # clean liquid iron has a low emissivity (~0.6 here) and is a mirror; oxide and slag emit near 0.9
        strength = g.mul(strength, g.sub(1.0, g.mul(g.mul(melt, g.mul(g.sub(1.0, slag), g.sub(1.0, fil))), 0.4)))

    # -- surface: sand-cast grey iron (polished grain tops), black mill-scale patches, rust in pits and cracks
    base = g.mix_rgb(g.mix_rgb((0.19, 0.185, 0.18), (0.30, 0.29, 0.28), tint), (0.05, 0.05, 0.055), scalew)
    rustw = g.mx(g.mul(pitmask, 0.85), g.mul(g.sub(1.0, plate), 0.5))
    base = g.mix_rgb(base, (0.14, 0.055, 0.025), g.mul(rustw, g.sub(1.0, melt)))
    metal = g.lerp(g.lerp(0.95, 0.7, scalew), 0.0, g.mul(rustw, 0.9))
    rough = g.lerp(rough_s, 0.8, g.mul(rustw, 0.6))
    if liquid:
        base = g.mix_rgb(base, (0.62, 0.60, 0.57), melt)
        metal = g.lerp(metal, 1.0, melt)
        rough = g.lerp(rough, g.lerp(0.04, 0.5, slag), melt)
    bsdf = g.node('ShaderNodeBsdfPrincipled', {
        'Base Color': base, 'Metallic': metal, 'Roughness': rough,
        'Emission Color': col, 'Emission Strength': strength,
    })
    g.nt.links.new(bsdf.outputs[0], out.inputs['Surface'])
    return m, V


def main():
    if '--frames' in sys.argv and sys.argv[sys.argv.index('--frames') + 1] == 'keys':
        sys.argv[sys.argv.index('--frames') + 1] = ','.join(map(str, KEYS))
    a = cli('0,40,70,95', 12)
    cache = os.path.join(os.path.dirname(os.path.abspath(a.out)), 'iron-fields')
    paths = bake_fields(cache, 4096)
    sc = setup((1600, 900), a.scale, a.samples, seed=11, bounces=(3, 1, 2))
    sc.cycles.adaptive_threshold = 0.03

    bpy.ops.mesh.primitive_plane_add(size=0.3)
    plane = bpy.context.object
    # Bump only: at this framing no silhouette ever shows, and true displacement (adaptive dicing) cost ~4x the time
    # for no visible gain once the frames are compressed for the web.
    solid, Vs = build(paths, liquid=False)
    liquid, Vl = build(paths, liquid=True)
    plane.data.materials.append(solid)

    # A fixed camera that zooms in (the push-in), so any two frames differ by a pure scale about the centre: the
    # encode step can then synthesise the solid-phase frames between rendered keyframes exactly (see KEYS).
    cam = camera(lens=LENS, fstop=5.6)
    el, d = math.radians(31), 0.26
    cam.location = (-0.0026, -d * math.cos(el), d * math.sin(el))
    aim(cam, (0.0, 0.0, 0.0))
    cam.data.dof.focus_distance = d
    # cool soft fill from above, warm low key from the front, a grazing rim from behind
    key = area_light('key', (-0.10, -0.30, 0.035), (0.0, 0.0, 0.0), 0.5, 0.10, kelvin=2500)
    rim = area_light('rim', (0.05, 0.40, 0.03), (0.0, 0.0, 0.0), 0.4, 0.06, kelvin=2600)
    fill = area_light('fill', (0.0, 0.05, 0.7), (0.0, 0.0, 0.0), 1.6, 0.8, kelvin=9000)
    base_e = {o: o.data.energy for o in (key, rim, fill)}
    # the furnace mouth behind and above: never seen directly, only in reflections once the iron is liquid
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0.0, 0.55, 0.35))
    furnace = bpy.context.object
    furnace.scale = (1.2, 0.5, 1)
    aim(furnace, (0, 0, 0))
    furnace.rotation_euler.rotate_axis('X', math.pi)
    furnace.visible_camera = False
    fm, fg, fout = material('furnace')
    fb = fg.node('ShaderNodeBlackbody', {'Temperature': 1500.0}, name='Blackbody')
    # the mouth has structure (glowing gaps between darker bricks and slag), so ripples reflect light and dark
    fn = fg.noise(fg.node('ShaderNodeTexCoord').outputs['UV'], 7.0, detail=3, rough=0.6)
    fmask = fg.add(0.01, fg.smooth(0.5, 0.58, fn.outputs['Fac']))
    fe = fg.node('ShaderNodeEmission', {'Color': fb, 'Strength': 0.0}, name='Emission')
    fm2 = fg.node('ShaderNodeEmission', {'Color': fb, 'Strength': fg.mul(fmask, 0.0)}, name='Masked')
    fe = fm2
    fg.nt.links.new(fe.outputs[0], fout.inputs['Surface'])
    furnace.data.materials.append(fm)

    def frame(i):
        p = params(i)
        V = Vl if p['melt'] > 0 else Vs
        plane.data.materials[0] = liquid if p['melt'] > 0 else solid
        for k in ('T', 'Tc', 'Tp', 'spread', 'width', 'craze', 'melt', 'flow', 'te_inv'):
            V[k].outputs[0].default_value = p[k]
        V['gain'].outputs[0].default_value = 0.3
        fnodes = furnace.data.materials[0].node_tree.nodes
        fnodes['Masked'].inputs['Strength'].links[0].from_node.inputs[1].default_value = p['env'] * 7.0
        furnace.data.materials[0].node_tree.nodes['Blackbody'].inputs['Temperature'].default_value = max(p['T'] - 60, 800)
        for o, e0 in base_e.items():
            o.data.energy = e0 * p['expo']
        cam.data.lens = LENS * zoom(i)

    render_frames(sc, a, 'iron', frame)


if __name__ == '__main__':
    main()
