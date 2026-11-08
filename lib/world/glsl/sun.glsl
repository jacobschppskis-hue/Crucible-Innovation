// look: the sun, which is the mark's core. Its light (colour, illuminance, the air's transmittance and the planet's
// soft shadow) for anything another module shades, and its disc for the sky. Needs atmosphere.glsl.
//
// The star is a K-type sun (light ~5200 K): slightly warmer than ours, so the world's light is warm without a filter.
// The disc: a white-yellow heart, limb-darkened to orange (we see higher, cooler layers at the edge), its radiance
// following from the illuminance it delivers (a bigger sun is not brighter per pixel). Its glow is not painted: it is
// the air's Mie aureole (sky) and the lens's bloom (post).

uniform float look_uSunDisc;    // 0..1: the sky draws the sun's disc (the mark's core may cover it)
uniform float look_uSunBoost;   // disc radiance relative to its illuminance (1 = physical)
uniform float look_uSunTemp;    // disc centre (K)
uniform float look_uSunLimbT;   // disc limb (K)

/** The sun's light arriving at a world point: illuminance colour after the air, with the planet's soft shadow. Use it
 *  as the sun's light (times N.L) in any module: it reddens and dims at sunset and goes out at night. */
vec3 look_sunLight(vec3 pWorld) { return look_uSunE * look_sunT(pWorld / look_uK); }

// ---- the sun's disc (the mark's core is drawn around/over it by `mark`) ----------------------------------------------
// White-yellow heart, limb-darkened to orange at the edge (we see higher, cooler layers there), anti-aliased limb.
vec3 look_sunDisc(vec3 rd, float pa) {
  float c = dot(rd, look_uSun);
  if (c < cos(look_uSunR + 3.0 * pa)) return vec3(0.0);
  float ang = acos(clamp(c, -1.0, 1.0));
  float x = min(ang / look_uSunR, 1.0);
  float cov = clamp((look_uSunR - ang) / max(pa, 1e-6) + 0.5, 0.0, 1.0);
  float mu = sqrt(max(0.0, 1.0 - x * x));
  float I = 0.36 + 0.64 * mu;
  vec3 col = look_bbColor(mix(look_uSunLimbT, look_uSunTemp, pow(mu, 0.45)));
  float solid = 6.2831853 * (1.0 - cos(look_uSunR));
  return look_uSunE * col * (I / 0.79) / solid * look_uSunBoost * cov;
}


// ---- the moon: the one cold light (Quench). Off (0) except where a place's keys raise channel 'look.moon' (the
// ventures: a bright moon low behind the camera's shoulder gives the metal cool sheen and edge highlights while their
// bases glow hot). Small, distant, colourless rock lit by the sun: its light is cold only by contrast with the lava.
uniform vec3 look_uMoonDir;   // unit, toward the moon
uniform vec3 look_uMoonE;     // illuminance colour x strength (0 when off)

/** The moon's light at any point (irradiance colour; times N.L). A directional light: no shadow, no falloff. */
vec3 look_moonLight() { return look_uMoonE; }
vec3 look_moonDir() { return look_uMoonDir; }
