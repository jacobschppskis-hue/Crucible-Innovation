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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from common import C2, area_light, camera, cli, material, heat_emission, render_frames, setup, aim  # noqa: E402

N = 96
T0, T1 = 293.0, 1811.0


def smooth(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def params(i):
    """Everything that changes with the frame, derived from the temperature."""
    f = i / (N - 1)
    T = T0 + f * (T1 - T0)
    s = smooth(1000, 1811, T)
    Tc = T + 95  # the iron under the cracks (heat comes from below)
    dp = 165 - 105 * s  # how much cooler the crust plates are
    melt = smooth(0.80, 1.0, f) if f > 0.8 else 0.0
    # Auto exposure: fixed until the hottest metal passes 1150 K, then follows it with lag.
    Te = 1150 + 0.9 * max(0.0, Tc - 1150)
    return dict(
        T=T,
        Tc=Tc,
        Tp=T - dp,
        spread=0.1 + 1.5 * smooth(850, 1750, T),  # mm: how far heat glows out from a crack into the plate
        width=0.035 + 0.11 * smooth(650, 1650, T),  # mm: crack half-width (opens as it expands)
        craze=smooth(1050, 1400, T),  # fine secondary crazing appears
        melt=melt,
        flow=f,  # time, for the liquid motion
        te_inv=C2 / Te,
        env=0.3 * math.exp(C2 / Te - C2 / max(T - 60, 400)),  # the furnace around it heats up too
        expo=math.exp(C2 / Te - C2 / 1150),  # what the auto exposure does to reflected light
    )


def build():
    m, g, out = material('iron')
    m.displacement_method = 'BOTH'
    V = {k: g.value(0.0, k) for k in ('T', 'Tc', 'Tp', 'spread', 'width', 'craze', 'melt', 'flow', 'te_inv', 'gain')}
    melt = V['melt'].outputs[0]
    flow = V['flow'].outputs[0]
    width = V['width'].outputs[0]

    tc = g.node('ShaderNodeTexCoord')
    P = g.v('SCALE', tc.outputs['Object'], scale=1000.0)  # millimetres; the surface is planar, so textures are 2D
    px, py, _ = g.sep(P)

    def at(offset, k=1.0, t=None):
        """P scaled and offset; t adds a time axis (z) for animated 3D noise."""
        x, y = g.mad(px, k, offset[0]), g.mad(py, k, offset[1])
        return g.comb(x, y, 0.0 if t is None else t)

    # -- liquid motion: a slow swirl that only exists once it melts
    sw = g.noise(at((0, 0), 0.06, g.mul(flow, 1.2)), 1.0, detail=2, dims='3D').outputs['Color']
    sw = g.v('SUBTRACT', sw, (0.5, 0.5, 0.5))
    drift = g.comb(g.mul(flow, 1.4), g.mul(flow, -2.2), 0.0)
    liquid_off = g.v('SCALE', g.v('ADD', g.v('SCALE', sw, scale=8.0), drift), scale=g.pw(melt, 1.5))
    Pl = g.v('ADD', g.comb(px, py, 0.0), liquid_off)

    # -- the crack network: domain-warped Voronoi edges at two scales
    w1 = g.v('SUBTRACT', g.noise(Pl, 0.065, detail=3, rough=0.55, dims='2D').outputs['Color'], (0.5, 0.5, 0.5))
    w2 = g.v('SUBTRACT', g.noise(Pl, 0.5, detail=2, rough=0.5, dims='2D').outputs['Color'], (0.5, 0.5, 0.5))
    Pw = g.v('ADD', g.v('ADD', Pl, g.v('SCALE', w1, scale=9.0)), g.v('SCALE', w2, scale=0.7))
    S1, S2 = 0.10, 0.27
    v1 = g.voronoi(Pw, S1, 'DISTANCE_TO_EDGE', rand=0.95, dims='2D')
    d1 = g.div(v1.outputs['Distance'], S1)
    cell = g.voronoi(Pw, S1, 'F1', rand=0.95, dims='2D')  # same cells: per-plate random values
    crand = cell.outputs['Color']
    cr, cg, cb = g.node('ShaderNodeSeparateColor', {'Color': crand}).outputs
    Pw2 = g.v('ADD', g.v('ADD', Pw, (31.7, 11.3, 0)), g.v('SCALE', w2, scale=0.5))
    d2 = g.div(g.voronoi(Pw2, S2, 'DISTANCE_TO_EDGE', rand=1.0, dims='2D').outputs['Distance'], S2)
    d2 = g.add(d2, g.mul(g.sub(1.0, V['craze'].outputs[0]), 3.0))  # fine crazing fades in
    # crack width wanders along each crack (some segments stay shut)
    wv = g.noise(at((5.1, 9.2)), 0.2, detail=2, dims='2D').outputs['Fac']
    wmul = g.smooth(0.3, 0.62, wv)
    w_1 = g.mul(width, g.add(0.2, g.mul(wmul, 1.1)))
    w_2 = g.mul(w_1, 0.5)
    w_1 = g.add(w_1, g.mul(g.pw(melt, 1.3), 3.6))  # liquid: the plates shrink into slag islands
    w_2 = g.add(w_2, g.mul(melt, 2.0))
    e1 = g.sub(d1, w_1)  # distance from the crack wall, mm (negative = inside the crack)
    e2 = g.sub(d2, w_2)
    e = g.mn(e1, e2)
    crack = g.sub(1.0, g.smooth(-0.04, 0.015, e))

    # -- heights (mm)
    opening = g.remap(width, 0.035, 0.145, 0.35, 1.0)
    plate = g.smooth(-0.02, 0.16, e)  # bevelled plate edges
    tilt_dir = g.comb(g.sub(cg, 0.5), g.sub(cb, 0.5), 0.0)
    rel = g.v('SUBTRACT', Pw, cell.outputs['Position'])
    tilt = g.mul(g.v('DOT_PRODUCT', rel, tilt_dir), 0.012)
    plate_h = g.mul(plate, g.add(g.add(g.mul(opening, 0.07), g.mul(g.sub(cr, 0.5), 0.06)), tilt))
    dome = g.mul(g.smooth(0.0, 2.5, e1), 0.02)
    gv = g.voronoi(at((3, 1)), 2.6, 'SMOOTH_F1', rand=1.0, dims='2D', smooth=0.5).outputs['Distance']
    grain = g.mul(g.sub(0.6, gv), 0.03)
    gv2 = g.voronoi(at((7, 2)), 7.0, 'F1', rand=1.0, dims='2D').outputs['Distance']
    grain2 = g.mul(g.sub(0.5, gv2), 0.008)
    fine = g.mul(g.sub(g.noise(at((0, 0)), 4.0, detail=4, rough=0.65, dims='2D').outputs['Fac'], 0.5), 0.02)
    pitn = g.noise(at((13, 4)), 0.7, detail=3, rough=0.6, dims='2D').outputs['Fac']
    pits = g.mul(g.smooth(0.67, 0.74, pitn), -0.06)
    large = g.mul(g.sub(g.noise(at((0, 0)), 0.022, detail=2, dims='2D').outputs['Fac'], 0.5), 0.7)
    h_solid = g.add(g.add(g.add(plate_h, dome), g.add(g.add(grain, grain2), fine)), g.add(pits, large))
    ripple = g.noise(at((0, 0), 0.09, g.mul(flow, 2.0)), 1.0, detail=3, dims='3D').outputs['Fac']
    h_liq = g.add(g.mul(g.sub(ripple, 0.5), 0.10), g.add(g.mul(plate, 0.03), g.mul(large, 0.5)))
    h = g.lerp(h_solid, h_liq, melt)
    disp = g.node('ShaderNodeDisplacement', {'Height': h, 'Midlevel': 0.0, 'Scale': 0.001}, space='OBJECT')
    g.nt.links.new(disp.outputs[0], out.inputs['Displacement'])

    # -- temperature field
    spread = V['spread'].outputs[0]
    halo = g.exp(g.div(g.mul(g.mx(e, 0.0), -1.0), spread))
    Tp, Tc = V['Tp'].outputs[0], V['Tc'].outputs[0]
    tn = g.noise(at((2, 7)), 0.16, detail=3, dims='2D').outputs['Fac']
    T_solid = g.add(g.lerp(Tp, Tc, g.mx(halo, crack)), g.add(g.mul(g.sub(tn, 0.5), 70.0), g.mul(g.sub(cr, 0.5), 30.0)))
    lt = g.noise(g.v('ADD', Pl, g.comb(0, 0, g.mul(flow, 1.5))), 0.11, detail=3, dims='3D').outputs['Fac']
    island = g.sub(1.0, crack)
    T_liq = g.sub(g.add(V['T'].outputs[0], g.mul(g.sub(lt, 0.5), 160.0)), g.mul(island, g.add(200.0, g.mul(cr, 120.0))))
    T_liq = g.add(T_liq, 60.0)
    T = g.lerp(T_solid, T_liq, melt)
    col, strength = heat_emission(g, T, V['te_inv'].outputs[0], V['gain'].outputs[0])
    # clean liquid iron has a low emissivity (~0.4) and is a mirror; oxide crust and slag emit near 0.9
    strength = g.mul(strength, g.sub(1.0, g.mul(g.mul(melt, crack), 0.55)))

    # -- surface (cold look): black mill scale on the plates, grey iron in the cracks, rust in the pits
    rn = g.noise(at((40, 1)), 0.35, detail=4, rough=0.6, dims='2D').outputs['Fac']
    rough = g.add(g.remap(rn, 0.3, 0.7, 0.32, 0.6), g.mul(g.sub(cg, 0.5), 0.16))
    scale_col = g.mix_rgb((0.030, 0.030, 0.032), (0.07, 0.066, 0.062), g.smooth(0.3, 0.8, g.add(rn, g.mul(g.sub(cb, 0.5), 0.4))))
    base = g.mix_rgb((0.28, 0.27, 0.26), scale_col, plate)
    rustw = g.mx(g.mul(g.smooth(0.62, 0.73, pitn), 0.85), g.mul(g.sub(1.0, plate), 0.5))
    base = g.mix_rgb(base, (0.15, 0.06, 0.028), g.mul(rustw, g.sub(1.0, melt)))
    base = g.mix_rgb(base, (0.42, 0.40, 0.38), melt)
    metal = g.lerp(g.lerp(0.95, 0.4, plate), 0.0, g.mul(rustw, 0.9))
    metal = g.lerp(metal, 1.0, melt)
    rough = g.lerp(g.lerp(rough, 0.78, g.mul(rustw, 0.6)), g.lerp(0.5, 0.05, crack), melt)
    bsdf = g.node('ShaderNodeBsdfPrincipled', {
        'Base Color': base, 'Metallic': metal, 'Roughness': rough,
        'Emission Color': col, 'Emission Strength': strength,
    })
    g.nt.links.new(bsdf.outputs[0], out.inputs['Surface'])
    return m, V


def main():
    a = cli('0,40,70,95', 48)
    sc = setup((1600, 900), a.scale, a.samples, seed=11)
    sc.cycles.adaptive_threshold = 0.03

    bpy.ops.mesh.primitive_plane_add(size=0.3)
    plane = bpy.context.object
    mat, V = build()
    plane.data.materials.append(mat)
    sub = plane.modifiers.new('dice', 'SUBSURF')
    sub.subdivision_type = 'SIMPLE'
    sub.use_adaptive_subdivision = a.variant != 'bump'
    sub.adaptive_pixel_size = 2.5
    if a.variant == 'bump':
        mat.displacement_method = 'BUMP'

    cam = camera(lens=105, fstop=5.6)
    # cool soft fill from above, warm low key from the front, a grazing rim from behind
    key = area_light('key', (-0.10, -0.30, 0.035), (0.0, 0.0, 0.0), 0.6, 0.10, kelvin=2300)
    rim = area_light('rim', (0.05, 0.40, 0.03), (0.0, 0.0, 0.0), 0.4, 0.06, kelvin=2600)
    fill = area_light('fill', (0.0, 0.05, 0.7), (0.0, 0.0, 0.0), 0.3, 0.8, kelvin=9000)
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
    fe = fg.node('ShaderNodeEmission', {'Color': fb, 'Strength': 0.0}, name='Emission')
    fg.nt.links.new(fe.outputs[0], fout.inputs['Surface'])
    furnace.data.materials.append(fm)

    def frame(i):
        p = params(i)
        for k in ('T', 'Tc', 'Tp', 'spread', 'width', 'craze', 'melt', 'flow', 'te_inv'):
            V[k].outputs[0].default_value = p[k]
        V['gain'].outputs[0].default_value = 0.3
        furnace.data.materials[0].node_tree.nodes['Emission'].inputs['Strength'].default_value = p['env']
        furnace.data.materials[0].node_tree.nodes['Blackbody'].inputs['Temperature'].default_value = max(p['T'] - 60, 800)
        for o, e0 in base_e.items():
            o.data.energy = e0 * p['expo']
        f = i / (N - 1)
        # slow push-in along the view axis with a slight drift
        el = math.radians(31 + 3 * f)
        d = 0.26 - 0.075 * f
        tx, ty = 0.004 * f, 0.006 * f
        cam.location = (tx - 0.01 * d, ty - d * math.cos(el), d * math.sin(el))
        aim(cam, (tx, ty, 0.0))
        cam.data.dof.focus_distance = d

    render_frames(sc, a, 'iron', frame)


if __name__ == '__main__':
    main()
