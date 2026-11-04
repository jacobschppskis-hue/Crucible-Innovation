"""Shared helpers for the film/ scenes: Cycles setup, a tiny node-graph DSL, the cast-metal and heat shaders.

Every scene is plain Python run with Blender-as-a-module (bpy 5.2):
    <bpy-python> film/<scene>.py --frames 0-95 --out <dir> [--scale 0.25 --samples 8]
Scenes are fully defined in code, deterministic (fixed seeds, no randomness outside the seeded noise textures).
"""
import argparse
import math
import os
import sys
import time

import bpy

FILM = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(FILM, 'fonts')

# Wien's approximation of visible radiance, exp(-C2 / T), with C2 = hc / (lambda k) at ~650 nm.
# Used to drive emission strength from a temperature, so brightness follows physics (nothing visible below ~800 K).
C2 = 22000.0


def radiance(T, Te):
    """Relative visible radiance of a body at T, normalised to 1 at the camera's exposure temperature Te."""
    return math.exp(C2 / Te - C2 / T)


# ---------------------------------------------------------------------------------------------------------------
# CLI and scene setup
# ---------------------------------------------------------------------------------------------------------------
def cli(default_frames='0', default_samples=48):
    p = argparse.ArgumentParser()
    p.add_argument('--frames', default=default_frames, help='e.g. 0-95, 0,30,60 or 10-20:2')
    p.add_argument('--out', required=True)
    p.add_argument('--scale', type=float, default=1.0, help='resolution multiplier (0.25 for previews)')
    p.add_argument('--samples', type=int, default=default_samples)
    p.add_argument('--skip-existing', action='store_true')
    p.add_argument('--variant', default='')
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    a = p.parse_args(argv)
    frames = []
    for part in a.frames.split(','):
        step = 1
        if ':' in part:
            part, step = part.split(':')
            step = int(step)
        if '-' in part:
            lo, hi = part.split('-')
            frames += list(range(int(lo), int(hi) + 1, step))
        else:
            frames.append(int(part))
    a.frame_list = frames
    os.makedirs(a.out, exist_ok=True)
    return a


def setup(res, scale=1.0, samples=48, seed=7, look='AgX - Medium High Contrast', exposure=0.0, bounces=(6, 3, 4)):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    c = sc.cycles
    c.device = 'CPU'
    c.samples = samples
    c.use_adaptive_sampling = True
    c.adaptive_threshold = 0.02
    c.use_denoising = True
    c.denoiser = 'OPENIMAGEDENOISE'
    c.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
    c.denoising_quality = 'HIGH'
    c.seed = seed
    c.use_animated_seed = False
    c.max_bounces, c.diffuse_bounces, c.glossy_bounces = bounces
    c.transmission_bounces = 4
    c.volume_bounces = 0
    c.transparent_max_bounces = 4
    c.caustics_reflective = False
    c.caustics_refractive = False
    c.sample_clamp_indirect = 8.0
    c.blur_glossy = 1.0
    c.dicing_rate = 1.0
    sc.render.resolution_x = int(round(res[0] * scale))
    sc.render.resolution_y = int(round(res[1] * scale))
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGB'
    sc.render.image_settings.color_depth = '16'
    sc.render.image_settings.compression = 15
    sc.render.threads_mode = 'AUTO'
    sc.view_settings.view_transform = 'AgX'
    try:
        sc.view_settings.look = look
    except TypeError:
        pass
    sc.view_settings.exposure = exposure
    sc.unit_settings.system = 'METRIC'
    w = bpy.data.worlds.new('world')
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.0035, 0.0032, 0.0028, 1)
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0
    return sc


def render_frames(sc, a, name, per_frame):
    """per_frame(i) sets the scene for frame i. Writes <out>/<i:03d>.png and logs timings."""
    total = time.time()
    for i in a.frame_list:
        path = os.path.join(a.out, f'{i:03d}.png')
        if a.skip_existing and os.path.exists(path):
            continue
        sc.frame_set(i)
        per_frame(i)
        sc.render.filepath = path
        t = time.time()
        bpy.ops.render.render(write_still=True)
        print(f'[{name}] frame {i:03d} {time.time() - t:6.1f}s', flush=True)
    print(f'[{name}] total {time.time() - total:.1f}s for {len(a.frame_list)} frames', flush=True)


# ---------------------------------------------------------------------------------------------------------------
# Node DSL
# ---------------------------------------------------------------------------------------------------------------
Socket = bpy.types.NodeSocket


class Graph:
    """Minimal helper for building shader node trees in code: values or sockets can be passed anywhere."""

    def __init__(self, nt):
        self.nt = nt

    def _set(self, sock, v):
        if isinstance(v, Socket):
            self.nt.links.new(v, sock)
        elif isinstance(v, bpy.types.Node):
            self.nt.links.new(v.outputs[0], sock)
        elif v is not None:
            if hasattr(sock, 'default_value'):
                dv = sock.default_value
                if hasattr(dv, '__len__') and not hasattr(v, '__len__'):
                    v = [v] * len(dv)
                if hasattr(dv, '__len__') and len(dv) == 4 and len(v) == 3:
                    v = (*v, 1.0)
                sock.default_value = v

    def node(self, kind, ins=None, **props):
        n = self.nt.nodes.new(kind)
        for k, v in props.items():
            setattr(n, k, v)
        for k, v in (ins or {}).items():
            sock = n.inputs[k] if isinstance(k, int) else n.inputs.get(k)
            if sock is None:
                raise KeyError(f'{kind} has no input {k}: {[s.name for s in n.inputs]}')
            self._set(sock, v)
        return n

    # scalar math
    def m(self, op, a, b=None, c=None, clamp=False):
        n = self.node('ShaderNodeMath', operation=op, use_clamp=clamp)
        for i, v in enumerate((a, b, c)):
            if v is not None:
                self._set(n.inputs[i], v)
        return n.outputs[0]

    def add(self, a, b): return self.m('ADD', a, b)
    def sub(self, a, b): return self.m('SUBTRACT', a, b)
    def mul(self, a, b): return self.m('MULTIPLY', a, b)
    def div(self, a, b): return self.m('DIVIDE', a, b)
    def mad(self, a, b, c): return self.m('MULTIPLY_ADD', a, b, c)
    def mn(self, a, b): return self.m('MINIMUM', a, b)
    def mx(self, a, b): return self.m('MAXIMUM', a, b)
    def pw(self, a, b): return self.m('POWER', a, b)
    def exp(self, a): return self.m('EXPONENT', a)
    def clamp01(self, a): return self.m('ADD', a, 0.0, clamp=True)

    def lerp(self, a, b, t):
        return self.mad(self.sub(b, a), t, a)

    def smooth(self, lo, hi, x):
        """smoothstep(lo, hi, x) via a Map Range node."""
        n = self.node('ShaderNodeMapRange', {'Value': x, 'From Min': lo, 'From Max': hi, 'To Min': 0.0, 'To Max': 1.0},
                      interpolation_type='SMOOTHSTEP', clamp=True)
        return n.outputs[0]

    def remap(self, x, a, b, c, d, clamp=True):
        n = self.node('ShaderNodeMapRange', {'Value': x, 'From Min': a, 'From Max': b, 'To Min': c, 'To Max': d}, clamp=clamp)
        return n.outputs[0]

    # vector math
    def v(self, op, a, b=None, scale=None):
        n = self.node('ShaderNodeVectorMath', operation=op)
        self._set(n.inputs[0], a)
        if b is not None:
            self._set(n.inputs[1], b)
        if scale is not None:
            self._set(n.inputs['Scale'], scale)
        return n.outputs['Value'] if op in ('LENGTH', 'DOT_PRODUCT', 'DISTANCE') else n.outputs['Vector']

    def comb(self, x, y, z):
        return self.node('ShaderNodeCombineXYZ', {'X': x, 'Y': y, 'Z': z}).outputs[0]

    def sep(self, v):
        return self.node('ShaderNodeSeparateXYZ', {'Vector': v}).outputs

    def value(self, v, label=''):
        n = self.node('ShaderNodeValue', label=label, name=label or 'Value')
        n.outputs[0].default_value = v
        return n

    def noise(self, vec, scale, detail=4.0, rough=0.55, lac=2.0, distortion=0.0, dims='3D', w=None, ntype='FBM', normalize=True):
        ins = {'Vector': vec, 'Scale': scale, 'Detail': detail, 'Roughness': rough, 'Lacunarity': lac, 'Distortion': distortion}
        if w is not None:
            ins['W'] = w
        n = self.node('ShaderNodeTexNoise', ins, noise_dimensions=dims, noise_type=ntype, normalize=normalize)
        return n

    def voronoi(self, vec, scale, feature='F1', rand=1.0, dims='3D', w=None, metric='EUCLIDEAN', detail=0.0, smooth=None):
        ins = {'Vector': vec, 'Scale': scale, 'Randomness': rand}
        if w is not None:
            ins['W'] = w
        if feature != 'DISTANCE_TO_EDGE' and feature != 'N_SPHERE_RADIUS':
            ins['Detail'] = detail
        if smooth is not None:
            ins['Smoothness'] = smooth
        return self.node('ShaderNodeTexVoronoi', ins, feature=feature, voronoi_dimensions=dims, distance=metric)

    def bump(self, height, strength=1.0, distance=1.0, normal=None):
        ins = {'Height': height, 'Strength': strength, 'Distance': distance}
        if normal is not None:
            ins['Normal'] = normal
        return self.node('ShaderNodeBump', ins).outputs['Normal']

    def mix_rgb(self, a, b, t, blend='MIX'):
        n = self.node('ShaderNodeMix', data_type='RGBA', blend_type=blend)
        self._set(n.inputs[0], t)
        self._set(n.inputs[6], a)
        self._set(n.inputs[7], b)
        return n.outputs[2]

    def mix_vec(self, a, b, t):
        n = self.node('ShaderNodeMix', data_type='VECTOR')
        self._set(n.inputs[0], t)
        self._set(n.inputs[4], a)
        self._set(n.inputs[5], b)
        return n.outputs[1]

    def ramp(self, x, stops):
        """stops: [(pos, (r,g,b)), ...]"""
        n = self.node('ShaderNodeValToRGB', {'Fac': x})
        el = n.color_ramp.elements
        while len(el) < len(stops):
            el.new(0.5)
        for e, (p, col) in zip(el, stops):
            e.position = p
            e.color = (*col, 1.0) if len(col) == 3 else col
        return n.outputs['Color']


def material(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    out.target = 'CYCLES'
    return m, Graph(nt), out


def heat_emission(g, T, Te_inv, gain):
    """Blackbody emission for a temperature socket T (kelvin): colour from the Blackbody node, strength from
    Wien's law normalised to the camera exposure temperature (Te_inv = C2 / Te), times gain."""
    col = g.node('ShaderNodeBlackbody', {'Temperature': T}).outputs[0]
    k = g.exp(g.sub(Te_inv, g.div(C2, g.mx(T, 300.0))))
    return col, g.mul(k, gain)


def area_light(name, loc, target, energy, size, kelvin=None, color=None, shape='DISK', size_y=None, spread=180):
    d = bpy.data.lights.new(name, 'AREA')
    d.energy = energy
    d.shape = shape
    d.size = size
    if size_y is not None:
        d.size_y = size_y
    d.spread = math.radians(spread)
    if kelvin:
        d.use_temperature = True
        d.temperature = kelvin
    if color:
        d.color = color
    o = bpy.data.objects.new(name, d)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    aim(o, target)
    return o


def aim(o, target, roll=0.0):
    from mathutils import Vector
    d = Vector(target) - Vector(o.location)
    o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    if roll:
        o.rotation_euler.rotate_axis('Z', roll)


def look_at(o, target, up=(0.0, 0.0, 1.0)):
    """Point an object's -Z at target with its +Y toward `up` (stable even when looking straight along an axis)."""
    from mathutils import Matrix, Vector
    f = (Vector(target) - Vector(o.location)).normalized()
    r = f.cross(Vector(up)).normalized()
    u = r.cross(f)
    o.rotation_euler = Matrix((r, u, -f)).transposed().to_euler()


def camera(name='cam', lens=100.0, sensor=36.0, fstop=4.0, focus=1.0):
    d = bpy.data.cameras.new(name)
    d.lens = lens
    d.sensor_width = sensor
    d.sensor_fit = 'HORIZONTAL'
    d.dof.use_dof = fstop > 0
    d.dof.aperture_fstop = max(fstop, 0.1)
    d.dof.focus_distance = focus
    d.dof.aperture_blades = 7
    d.dof.aperture_rotation = math.radians(12)
    d.clip_start = 0.001
    d.clip_end = 5000
    o = bpy.data.objects.new(name, d)
    bpy.context.scene.collection.objects.link(o)
    bpy.context.scene.camera = o
    return o
