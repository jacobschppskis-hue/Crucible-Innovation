"""ring: the Split Ring as a real cast object, for the home page's scroll story (components/Ignition.tsx).

Geometry is lib/splitRing.ts exactly, 1 SVG unit = 1 mm: two rings (r 26 and 15, stroke 3) whose left halves are
continuous arcs ("human") and right halves columns of 3 mm pixels ("machine"), and a molten core (r 4.5). Arcs and
pixels are 3 mm deep with 0.4 mm bevels, in cooled sand-cast steel (bone); the core is glowing metal.

Frame i is scroll progress p = i / 95 of Ignition's pinned scene, and the beats use Ignition's own formulas:
the machine half scatters ("Not the person."), comes back while the human half slides away ("Not the model."),
then both fuse and the core re-ignites with a flare ("Neither, alone."). The camera starts front-on and
orthographic-equivalent (a 3750 mm lens at 10 m) so frame 0 overlays the SVG (viewBox -16 -16 96 96), eases a few
degrees off-axis (dollying in to 0.5 m, lens following so the framing holds), and settles front-on again for the end.

    bl/bin/python film/ring.py --frames 0-95 --out <dir>                  # 1200x1200 sequence
    bl/bin/python film/ring.py --frames 0 --variant still --out <dir>     # 2400x2400 hero still (frame 0)
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from common import C2, area_light, camera, cli, heat_emission, look_at, material, render_frames, setup  # noqa: E402
from mathutils import Euler, Vector  # noqa: E402

N = 96
K = 0.001  # 1 SVG unit = 1 mm
C, PX, STROKE, CORE = 32.0, 3.0, 3.0, 4.5
RINGS = [(26.0, 11), (15.0, 7)]
BEV = 0.4
VIEW = 96.0  # the frame spans the viewBox -16..80


# ---- Ignition's scroll maths (lib/scroll.ts) ------------------------------------------------------------------
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def seg(p, a, b):
    return clamp((p - a) / (b - a))


def e_out(t):
    return 1 - (1 - t) ** 3


def e_inout(t):
    return 4 * t ** 3 if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2


def beats(p):
    sm = e_inout(seg(p, 0.17, 0.3)) * (1 - e_inout(seg(p, 0.42, 0.54)))
    sh = e_inout(seg(p, 0.42, 0.54)) * (1 - e_inout(seg(p, 0.64, 0.74)))
    core = 1 - e_out(seg(p, 0.15, 0.22)) + e_out(seg(p, 0.7, 0.8))
    flare = seg(p, 0.7, 0.76) * (1 - e_out(seg(p, 0.77, 0.92)))
    cam = e_inout(seg(p, 0.05, 0.24)) * (1 - e_inout(seg(p, 0.8, 0.93)))
    return sm, sh, core, flare, cam


def scatter(i):
    """Ignition's deterministic scatter, plus three more draws for depth and a tumble axis."""
    r = lambda n: ((math.sin(i * 127.1 + n * 311.7) * 43758.5453) % 1 + 1) % 1  # noqa: E731
    return dict(dx=16 + r(1) * 44, dy=(r(2) - 0.5) * 64, dr=(r(3) - 0.5) * 220, dz=r(4), ax=(r(5) - 0.5, r(6) - 0.5, r(7) - 0.5))


def svg(x, y):
    return Vector(((x - C) * K, -(y - C) * K, 0.0))


# ---- geometry ---------------------------------------------------------------------------------------------------
def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob


def curve_solid(name, loops, pivot):
    """Filled 2D outline(s) in SVG units, 3 mm deep with a 0.4 mm bevel; the outline stays exact (offset -bevel)."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '2D'
    cu.fill_mode = 'BOTH'
    cu.extrude = (STROKE / 2 - BEV) * K
    cu.bevel_depth = BEV * K
    cu.bevel_resolution = 4
    cu.offset = -BEV * K
    for loop in loops:
        sp = cu.splines.new('POLY')
        sp.points.add(len(loop) - 1)
        for p, (x, y) in zip(sp.points, loop):
            v = svg(x, y) - pivot
            p.co = (v.x, v.y, 0, 1)
        sp.use_cyclic_u = True
    ob = link(bpy.data.objects.new(name + '-c', cu))
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob)
    new = link(bpy.data.objects.new(name, me))
    new.location = pivot
    for f in me.polygons:
        f.use_smooth = True
    return new


def arc(r):
    """The human half of one ring: top -> left -> bottom, running on under the end pixels (arcPath, under=true)."""
    e = PX / 2 / r
    a0, a1 = -math.pi / 2 + e, -3 * math.pi / 2 - e
    n = 160
    ro, ri = r + STROKE / 2, r - STROKE / 2
    outer = [(C + ro * math.cos(a0 + (a1 - a0) * t / n), C + ro * math.sin(a0 + (a1 - a0) * t / n)) for t in range(n + 1)]
    inner = [(C + ri * math.cos(a1 + (a0 - a1) * t / n), C + ri * math.sin(a1 + (a0 - a1) * t / n)) for t in range(n + 1)]
    pivot = svg(C - r * 2 / math.pi, C)  # the half ring's centroid
    return curve_solid(f'arc{int(r)}', [outer + inner], pivot)


def pixel_list():
    out = []
    for r, n in RINGS:
        ins = PX / 2 / r
        for i in range(n):
            a = -math.pi / 2 + ins + (math.pi - 2 * ins) * i / (n - 1)
            out.append((C + r * math.cos(a), C + r * math.sin(a), a))
    return out


def pixel(k, x, y, a):
    h = PX / 2
    cs, sn = math.cos(a), math.sin(a)
    sq = [(x + p * cs - q * sn, y + p * sn + q * cs) for p, q in ((-h, -h), (h, -h), (h, h), (-h, h))]
    return curve_solid(f'px{k}', [sq], svg(x, y))


def core_obj():
    bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=48, radius=CORE * K, location=(0, 0, 0))
    ob = bpy.context.object
    ob.name = 'core'
    ob.scale = (1, 1, 0.62)
    for f in ob.data.polygons:
        f.use_smooth = True
    return ob


# ---- materials --------------------------------------------------------------------------------------------------
def cast_metal():
    """Cooled sand-cast steel in bone: matte cast sides, the front faces lightly ground, grain and pores, a little
    oxide in the crevices."""
    m, g, out = material('cast')
    tc = g.node('ShaderNodeTexCoord')
    P = g.v('SCALE', tc.outputs['Object'], scale=1000.0)
    Pg = g.v('ADD', g.v('SCALE', tc.outputs['Generated'], scale=7.0), P)  # differs per piece
    nz = g.sep(tc.outputs['Normal'])[2]
    face = g.smooth(0.93, 0.99, nz)
    gv = g.voronoi(Pg, 2.6, 'SMOOTH_F1', rand=1.0, smooth=0.5).outputs['Distance']
    pn = g.noise(g.v('ADD', Pg, (13, 4, 2)), 0.9, detail=3, rough=0.6).outputs['Fac']
    fine = g.noise(Pg, 6.0, detail=3, rough=0.6).outputs['Fac']
    h = g.add(g.add(g.mul(g.sub(0.6, gv), 0.025), g.mul(g.sub(fine, 0.5), 0.012)), g.mul(g.smooth(0.68, 0.75, pn), -0.04))
    # the front faces are ground flat: fine grinding lines instead of the cast grain
    px_, py_, _ = g.sep(P)
    lines = g.noise(g.comb(g.mul(px_, 0.04), g.mul(py_, 22.0), 0.0), 1.0, detail=3, rough=0.6).outputs['Fac']
    h = g.lerp(h, g.mul(g.sub(lines, 0.5), 0.004), g.mul(face, 0.88))
    disp = g.node('ShaderNodeDisplacement', {'Height': h, 'Midlevel': 0.0, 'Scale': 0.001}, space='OBJECT')
    g.nt.links.new(disp.outputs[0], out.inputs['Displacement'])
    ao = g.node('ShaderNodeAmbientOcclusion', {'Distance': 0.0015}, samples=6).outputs['AO']
    crev = g.smooth(0.85, 0.35, ao)
    v1 = g.noise(g.v('ADD', Pg, (40, 1, 0)), 0.5, detail=4, rough=0.55).outputs['Fac']
    cast = g.mix_rgb((0.40, 0.385, 0.355), (0.50, 0.48, 0.44), g.smooth(0.3, 0.7, v1))
    cast = g.mix_rgb(cast, (0.30, 0.29, 0.27), g.mul(g.smooth(0.55, 0.3, gv), 0.5))
    base = g.mix_rgb(cast, (0.74, 0.71, 0.645), g.mul(face, 0.85))
    base = g.mix_rgb(base, (0.18, 0.1, 0.06), g.mul(crev, 0.5))
    rough = g.lerp(g.add(g.remap(v1, 0.3, 0.7, 0.42, 0.58), g.mul(g.sub(gv, 0.5), 0.12)),
                   g.add(0.26, g.add(g.mul(v1, 0.08), g.mul(lines, 0.08))), face)
    bsdf = g.node('ShaderNodeBsdfPrincipled', {'Base Color': base, 'Metallic': g.lerp(0.9, 0.4, crev), 'Roughness': rough})
    g.nt.links.new(bsdf.outputs[0], out.inputs['Surface'])
    m.displacement_method = 'BUMP'
    return m


CORE_TE, CORE_GAIN = 1550.0, 0.6


def core_metal():
    """Molten core: hotter in the middle, a slowly turning surface; when it goes out, a dark crust with glowing seams."""
    m, g, out = material('core')
    m.cycles.emission_sampling = 'FRONT'  # it lights the inner ring
    Tv = g.value(1550.0, 'Tcore')
    crust_v = g.value(0.0, 'crust')
    tc = g.node('ShaderNodeTexCoord')
    P = g.v('SCALE', tc.outputs['Object'], scale=1000.0)
    r = g.v('LENGTH', g.comb(*list(g.sep(P))[:2], 0.0))
    swirl = g.noise(P, 0.6, detail=3, rough=0.55, distortion=0.5).outputs['Fac']
    ce = g.voronoi(g.v('ADD', P, g.v('SCALE', g.noise(P, 0.8).outputs['Color'], scale=0.6)), 1.4, 'DISTANCE_TO_EDGE').outputs['Distance']
    seam = g.sub(1.0, g.smooth(0.02, 0.09, ce))
    crust = g.mul(crust_v.outputs[0], g.smooth(0.2, 0.5, g.add(swirl, g.mul(seam, -0.6))))
    # a mottled skin of cooler oxide drifting on it, so it reads as molten metal rather than a glossy bead
    sk = g.noise(g.v('ADD', P, (4, 1, 3)), 1.1, detail=3, rough=0.6, distortion=0.8).outputs['Fac']
    skin = g.smooth(0.5, 0.68, sk)
    T = g.add(g.sub(Tv.outputs[0], g.mul(g.smooth(1.0, 4.5, r), 120.0)), g.mul(g.sub(swirl, 0.5), 150.0))
    T = g.sub(g.sub(T, g.mul(skin, 170.0)), g.mul(crust, 350.0))
    col, strength = heat_emission(g, T, C2 / CORE_TE, CORE_GAIN)
    h = g.add(g.mul(g.sub(swirl, 0.5), 0.05), g.mul(crust, g.mul(g.smooth(0.0, 0.2, ce), 0.06)))
    disp = g.node('ShaderNodeDisplacement', {'Height': h, 'Midlevel': 0.0, 'Scale': 0.001}, space='OBJECT')
    g.nt.links.new(disp.outputs[0], out.inputs['Displacement'])
    bsdf = g.node('ShaderNodeBsdfPrincipled', {'Base Color': g.mix_rgb((0.09, 0.085, 0.08), (0.06, 0.055, 0.05), crust),
                                               'Metallic': g.lerp(0.8, 0.3, crust), 'Roughness': g.lerp(g.lerp(0.3, 0.5, skin), 0.55, crust),
                                               'Emission Color': col, 'Emission Strength': strength})
    g.nt.links.new(bsdf.outputs[0], out.inputs['Surface'])
    m.displacement_method = 'BUMP'
    return m, Tv, crust_v


# ---- scene ------------------------------------------------------------------------------------------------------
def main():
    a = cli('0,24,46,70,94', 40)
    still = a.variant == 'still'
    sc = setup((2400, 2400) if still else (1200, 1200), a.scale, a.samples, seed=13, bounces=(6, 3, 4))
    sc.cycles.adaptive_threshold = 0.012 if still else 0.025
    metal = cast_metal()
    arcs = [arc(r) for r, _ in RINGS]
    pixels = [pixel(k, x, y, ang) for k, (x, y, ang) in enumerate(pixel_list())]
    for ob in arcs + pixels:
        ob.data.materials.append(metal)
    for ob in pixels:  # a hair proud of the arcs, so the end pixels win where the arcs run on under them
        ob.location.z += 0.06 * K
    core = core_obj()
    cm, Tv, crust_v = core_metal()
    core.data.materials.append(cm)
    rest = {ob: (ob.location.copy(), ob.rotation_euler.copy()) for ob in arcs + pixels}
    scat = [scatter(k) for k in range(len(pixels))]

    cam = camera(lens=100, fstop=8.0)
    # warm low key from below-front (furnace glow), a cool soft fill from above, rims from behind for the bevels
    area_light('key', (0.01, -0.11, 0.075), (0, 0, 0), 0.6, 0.06, kelvin=2000)
    area_light('fill', (-0.03, 0.16, 0.22), (0, 0, 0), 1.25, 0.3, kelvin=8500)
    area_light('rimL', (-0.09, 0.05, -0.035), (0, 0, 0), 0.6, 0.04, kelvin=3000)
    area_light('rimR', (0.09, -0.03, -0.03), (0, 0, 0), 0.45, 0.04, kelvin=6000)

    def frame(i):
        p = i / (N - 1)
        sm, sh, core_k, flare, off = beats(p)
        # machine half: each pixel scatters in turn (Ignition's stagger), drifting right and toward the lens, tumbling
        for k, ob in enumerate(pixels):
            s = scat[k]
            q = clamp(sm * 1.6 - (k / (len(pixels) - 1)) * 0.6)
            q = q * q * (3 - 2 * q)
            loc, rot = rest[ob]
            ob.location = loc + Vector(((6 + s['dx'] * 0.42) * K * q, (s['dy'] * 0.45) * K * q, (s['dz'] * 46 - 10) * K * q))
            axis = Vector(s['ax']).normalized()
            spin = math.radians(s['dr'] * 1.1) * q
            e = Euler((axis.x * spin, axis.y * spin, axis.z * spin))
            ob.rotation_euler = (rot.to_matrix() @ e.to_matrix()).to_euler() if q > 0 else rot
        # human half: the arcs slide left and back into depth, swinging away (the inner one a beat later)
        for j, ob in enumerate(arcs):
            q = clamp(sh * 1.15 - j * 0.15)
            q = q * q * (3 - 2 * q)
            loc, rot = rest[ob]
            ob.location = loc + Vector((-(15 - 3 * j) * K * q, (2 - 4 * j) * K * q, -(26 + 8 * j) * K * q))
            ob.rotation_euler = Euler((rot.x - math.radians(7) * q, rot.y - math.radians(24 - 6 * j) * q, rot.z + math.radians(4) * q))
        # core: goes out while the halves are apart, re-ignites at the fusion with a flare
        ck = min(1.0, core_k)
        sc_ = 0.55 + 0.45 * ck + 0.12 * flare
        core.scale = (sc_, sc_, 0.62 * sc_)
        Tv.outputs[0].default_value = 960 + 540 * ck + 330 * flare  # 1500 K at rest (Ember), ~1830 K at the flare
        crust_v.outputs[0].default_value = 1.0 - ck
        # camera: front-on and orthographic-equivalent at rest; eases off-axis and in while the story plays
        yaw, pitch = math.radians(9.0) * off, math.radians(-5.5) * off
        dist = math.exp(math.log(10.0) + (math.log(0.5) - math.log(10.0)) * off)
        d = Vector((math.sin(yaw) * math.cos(pitch), math.sin(-pitch), math.cos(yaw) * math.cos(pitch)))
        cam.location = d * dist
        look_at(cam, (0, 0, 0), up=(0.0, 1.0, 0.0))
        cam.data.lens = 36.0 * dist / (VIEW * K)
        cam.data.dof.focus_distance = dist
        cam.data.dof.use_dof = off > 0.001

    render_frames(sc, a, 'ring', frame)


if __name__ == '__main__':
    main()
