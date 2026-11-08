// The sun, which is the mark's core: a star-like disc, hot white-yellow at the centre, limb-darkened to orange at its
// edge (real stars darken and redden toward the limb because we see higher, cooler layers there), seen through the
// atmosphere's transmittance (so it reddens and dims at sunset). Its glow is not painted: it comes from the
// atmosphere's Mie aureole (sky) and the post bloom (lens), both physically motivated.
//
// The disc radiance follows from the illuminance it delivers: E = L * solid angle, so a larger sun is not brighter
// per pixel, it lights the world the same.
#ifndef SUN_GLSL
#define SUN_GLSL

uniform float uSunTemp;    // effective temperature of the disc centre (K), ~6000
uniform float uSunLimbT;   // temperature at the limb (K), ~2600 (orange)
uniform float uSunBoost;   // extra radiance of the disc relative to its illuminance (1 = physical)

// Radiance of the sun's disc along rd (0 off the disc), before atmospheric transmittance. pixAng: one pixel's angle,
// for an anti-aliased limb.
vec3 sunDisc(vec3 rd, float pixAng) {
  float c = dot(rd, uSunDir);
  if (c < cos(uSunR + 3.0 * pixAng)) return vec3(0.0);
  float ang = acos(clamp(c, -1.0, 1.0));
  float x = ang / uSunR;
  float cov = clamp((uSunR - ang) / max(pixAng, 1e-6) + 0.5, 0.0, 1.0);
  float mu = sqrt(max(0.0, 1.0 - min(x, 1.0) * min(x, 1.0)));
  // Eddington limb darkening, plus a colour shift toward the limb
  float I = 0.36 + 0.64 * mu;
  float T = mix(uSunLimbT, uSunTemp, pow(mu, 0.45));
  vec3 col = bbColor(T);
  float solid = 6.2831853 * (1.0 - cos(uSunR));
  // normalise so the disc integrates to the illuminance (mean of I over the disc ~ 0.79 with this law)
  return uSunE * col * (I / 0.79) / solid * uSunBoost * cov;
}

#endif
