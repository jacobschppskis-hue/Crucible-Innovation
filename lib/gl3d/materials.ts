// Procedural materials as one uber shader: sand-cast bone metal, the glowing core, hot metal (temperature uniform), and
// the ventures' cast bars: 'ingot' (fresh from the mould, glowing all over) and 'bar' (cooled bone metal).
// Warm key light upper-left, dim cool fill, an Ember rim from below (as if lit by the liquid), filmic tone map.
// 'bar' is a metal, not a lit paint: it mirrors a night foundry (the dark liquid below, a dim ceiling, a warm lit wall at
// the horizon that every fillet sweeps through, so a warm line runs along each edge, and a broad warm softbox above that
// slides over the top face as the bar rocks), with a tight key glint on the fillets and only a little diffuse. No Ember
// light from below on it (bone lit by Ember reads peach-pink). Sand grain and the cast skin's waviness are bump octaves
// faded out as they near the pixel size (no shimmer when it moves), their lost detail kept as roughness; sparse pits.
// The stamp is cut in darker and rougher.
import { BAR } from './geometry';

export const MATERIALS = { cast: 0, core: 1, hot: 2, ingot: 4, bar: 5 } as const;
export type MaterialName = keyof typeof MATERIALS;

const g = (n: number) => n.toFixed(4);
// The bar's shape for its temperature and temper fields (lib/gl3d/geometry.ts BAR, goldBar()).
const BARS = `const float HZ=${g(BAR.H / 2)},HA=${g(BAR.L / 2)},HB=${g(BAR.W / 2)},TD=${g(Math.tan(BAR.draft))};`;

export const VS = `#version 300 es
in vec3 aP;in vec3 aN;uniform mat4 uM,uVP;out vec3 vP;out vec3 vW;out vec3 vO;
void main(){vP=aP;vO=aN;vec4 w=uM*vec4(aP,1.);vW=w.xyz;gl_Position=uVP*w;}`;

export const FS = `#version 300 es
precision highp float;
in vec3 vP;in vec3 vW;in vec3 vO;out vec4 o;
uniform int uMat;uniform float uTone,uTemp,uGlow,uSeed,uGrain,uExp,uRel;uniform vec2 uTemper;
uniform vec3 uEye;uniform vec4 uRelP,uClip;uniform float uTy,uEdge,uTime;uniform mat3 uNM;uniform sampler2D uRelT;
${BARS}
float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float vn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float ht(vec3 p){p=p*uGrain+uSeed;
return .6*(.65*vn(p)+.35*vn(p*2.3+3.1))+.4*(.6*vn(p*9.+7.)+.4*vn(p*21.+1.3));}
vec3 lit(vec3 alb,vec3 n,vec3 v,float ao,float rough,float spec){
vec3 L1=normalize(vec3(-.55,.65,.72)),L2=normalize(vec3(.85,.1,.45)),L3=normalize(vec3(.1,-.9,.4));
float d1=max(dot(n,L1)*.85+.15,0.),d2=max(dot(n,L2)*.8+.2,0.),d3=max(dot(n,L3)*.8+.2,0.);
vec3 c=alb*(vec3(1.,.82,.6)*1.45*d1+vec3(.34,.44,.62)*.42*d2+vec3(1.,.36,.1)*d3+vec3(.11,.09,.075)*(.6+.4*n.y))*ao;
float sh=mix(70.,9.,rough);
c+=vec3(1.,.88,.7)*pow(max(dot(n,normalize(L1+v)),0.),sh)*spec*d1;
c+=vec3(1.,.4,.14)*pow(max(dot(n,normalize(L3+v)),0.),sh*.5)*spec*.7*d3;
c+=vec3(.5,.36,.26)*pow(1.-max(dot(n,v),0.),4.)*.16*spec*ao;
return c;}
vec3 ramp(float t){
vec3 a=vec3(.04,0.,0.),b=vec3(.4,.035,0.),c=vec3(1.05,.15,.015),d=vec3(1.7,.55,.07),e=vec3(4.,3.,1.8);
return t<.25?mix(a,b,t*4.):t<.5?mix(b,c,(t-.25)*4.):t<.75?mix(c,d,(t-.5)*4.):mix(d,e,(t-.75)*4.);}
vec3 bb(float t){
vec3 a=vec3(.04,.001,0.),b=vec3(.14,.004,0.),c=vec3(.75,.06,.003),d=vec3(2.,.35,.025),e=vec3(4.2,1.35,.26),f=vec3(6.,3.6,1.9);
return t<.2?mix(a,b,t*5.):t<.35?mix(b,c,(t-.2)/.15):t<.5?mix(c,d,(t-.35)/.15):t<.68?mix(d,e,(t-.5)/.18):mix(e,f,clamp((t-.68)/.32,0.,1.));}
void main(){
if(dot(vW,uClip.xyz)>uClip.w)discard;
vec3 p=vP,nO=normalize(vO),v=normalize(uEye-vW);
float h0=ht(p),e=.05/uGrain;
#ifdef SOFT
vec3 g=vec3(0.);
#else
vec3 g=vec3(ht(p+vec3(e,0,0))-h0,ht(p+vec3(0,e,0))-h0,ht(p+vec3(0,0,e))-h0)/e;
#endif
float k=uMat==2?.5:uMat==1?.9:uMat==4?.3:uMat==5?.08:.55;
g-=dot(g,nO)*nO;
float rl=0.,ao=.6+.8*h0;
vec3 n0=nO;
vec3 nn=normalize(nO-g*k/uGrain*.05),nb=nn;
if(uRel!=0.){vec2 uv=(p.xy-uRelP.xy)/uRelP.zw+.5,d=clamp(fwidth(uv)*.55,vec2(.0004),vec2(.0011));float w=smoothstep(.6,.95,nO.z)*step(0.,min(uv.x,uv.y))*step(max(uv.x,uv.y),1.);
rl=texture(uRelT,uv,-1.5).r*w;
vec2 gr=vec2(texture(uRelT,uv+vec2(d.x,0),-1.5).r-texture(uRelT,uv-vec2(d.x,0),-1.5).r,texture(uRelT,uv+vec2(0,d.y),-1.5).r-texture(uRelT,uv-vec2(0,d.y),-1.5).r)*w*(.0011/d);
nn=normalize(mix(nn,nO,.6*rl)-vec3(gr,0.)*uRel);}
vec3 n=normalize(uNM*nn);
vec3 bone=vec3(.7,.67,.6);
vec3 col=vec3(0.);
if(uMat==0){
vec3 al=mix(bone,vec3(.2,.185,.18),uTone)*(.74+.5*mix(h0,.5,.8*rl))*(1.-.68*rl);
float tx=smoothstep(uTemper.x,uTemper.x+22.,p.x),tt=tx*uTemper.y;vec3 tc=mix(vec3(.2,.17,.3),vec3(.42,.2,.06),smoothstep(.2,.8,tx));al=mix(al,tc*(.7+.6*h0),tt*smoothstep(.0,.3,tx));
float ink=step(abs(uTone-.88),.01);al=mix(al,vec3(.05,.047,.045),ink);
col=lit(al,n,v,mix(ao,.85,.7*rl),.62,.38*(1.-.85*rl)*(1.-.8*ink));
}else if(uMat==1){
float bl=smoothstep(.5,.68,.7*vn(p*uGrain*1.7+5.)+.3*h0);
vec3 al=vec3(1.,.19,.03)*(1.-.78*bl)*(.7+.6*h0);
vec3 em=vec3(1.,.15,.02)*(.5+.3*uGlow)*(1.-.75*bl)*(.6+.8*h0);
col=lit(al,n,v,1.,.42,.55)*.5+em;
col=min(col,vec3(1.,.4,.12));
col+=vec3(1.,.8,.55)*(pow(max(dot(n,normalize(normalize(vec3(-.55,.65,.72))+v)),0.),70.)*.85+pow(max(dot(n,normalize(normalize(vec3(.1,-.9,.4))+v)),0.),30.)*.25)*(1.-.5*bl);
}else if(uMat==2){
vec3 q=p*uGrain*1.6+uSeed*3.;q+=vec3(vn(q*1.7),vn(q*1.7+4.),vn(q*1.7+9.))*1.1;float cn=.6*vn(q)+.4*vn(q*2.1);
float Tl=clamp(uTemp+uTy*vW.y,0.,1.);Tl=max(Tl-uEdge*(1.-abs(dot(n,v))),min(Tl,.48));float T=clamp(Tl+(h0-.5)*.1+rl*.1,0.,1.);
vec3 em=ramp(T);
float cv=smoothstep(.42,.6,(1.-T)*1.6-.5+(cn-.5)*1.25);
vec3 al=bone*mix(.05,1.,pow(1.-Tl,6.))*(.74+.5*h0)*(1.+.07*rl);
vec3 crust=lit(al,n,v,ao,.62,.3)+ramp(Tl*.9)*.35*smoothstep(.0,.6,Tl);
vec3 liq=em*(1.-.35*smoothstep(.1,.4,Tl)*.0)+lit(vec3(.05,.02,.01)+em*.04,n,v,1.,.12,1.1)*.8;
col=mix(liq,crust,cv)+ramp(T)*smoothstep(.0,.5,cv)*(1.-smoothstep(.5,1.,cv))*.5*Tl;
}else if(uMat==4){
float az=clamp((p.z+HZ)/(2.*HZ),0.,1.),dr=(p.z+HZ)*TD;
float es=clamp(min(HA-dr-abs(p.x),HB-dr-abs(p.y))/13.,0.,1.);
float tp=smoothstep(.72,1.,az)*smoothstep(.2,.7,nO.z),hc=tp*pow(es,.75);
vec3 dq=p*.16+vec3(uTime*.02,-uTime*.013,uTime*.009)+uSeed;
float cn=.5*vn(dq)+.3*vn(dq*2.1+5.)+.2*vn(dq*4.3+9.);
float T=.19+.1*az*az+.42*hc;
float dn=.2*(1.-hc)+.1*(1.-az)-.24;
float sc=smoothstep(.5,.55,cn+dn);
float fc=.6*vn(dq*2.3+2.)+.4*vn(dq*4.1+7.),ck=1.-smoothstep(.0,.022,abs(fc-.5));
T=clamp(T+(h0-.5)*.04-.14*rl,0.,1.);
vec3 em=bb(T)*(1.-.5*rl)*(.9+.2*h0);
vec3 skin=bb(T*.72)*(.12+.1*h0)+bb(T)*ck*.8+vec3(.5,.1,.03)*pow(max(dot(n,normalize(normalize(vec3(-.55,.65,.72))+v)),0.),24.)*.12;
vec3 sp=vec3(1.,.82,.6)*pow(max(dot(n,normalize(normalize(vec3(-.55,.65,.72))+v)),0.),60.)*.3;
col=mix(em,skin,sc)+sp*(1.-.7*sc);
}else if(uMat==5){
float dr=(p.z+HZ)*TD;
float ds=max(0.,min(HA-dr-abs(p.x),HB-dr-abs(p.y)));
float de=length(vec2(ds,max(HZ-p.z,0.)));
float fw=length(fwidth(p));
vec3 sg=vec3(0.);
float sd=0.;
#ifndef SOFT
for(int i=0;i<3;i++){float f=i==0?.3:i==1?1.3:3.4,a=(i==0?.9:i==1?.35:.2)*(1.-smoothstep(.45,.9,fw*f));
vec3 q=p*f+uSeed*(5.+float(i));float q0=vn(q);
if(i>0)sd+=(q0-.5)*a;sg+=a*f*vec3(vn(q+vec3(.1,0,0))-q0,vn(q+vec3(0,.1,0))-q0,vn(q+vec3(0,0,.1))-q0)/.1;}
sg-=dot(sg,nO)*nO;
#endif
vec3 pc=p*.7+uSeed*7.,ci=floor(pc),po=fract(pc)-.5-(vec3(h3(ci+1.7),h3(ci+3.1),h3(ci+5.3))-.5)*.5;float pr=.09+.12*h3(ci+8.9);
float pit=step(.75,h3(ci))*smoothstep(pr,pr*.3,length(po))*(1.-smoothstep(.12,.3,fw))*mix(.4,1.,smoothstep(.5,.9,nO.z))*(1.-rl);
vec3 n=normalize(uNM*normalize(mix(nn,nb,.75*smoothstep(.15,.45,fw))-sg*.045*(1.-.8*rl)));
float ro=clamp(.36+.4*sd+.12*smoothstep(.45,.9,fw*3.4)+.3*pit+.35*rl,.15,1.),w=ro*ro;
vec3 F0=mix(vec3(.8,.77,.7),vec3(.3,.29,.27),uTone)*(.96+.22*sd)*(1.-.55*pit)*(1.-.7*rl);
F0=mix(F0,F0*vec3(1.03,.97,.8),uTemper.y*exp(-de/1.6)*(.6+.4*vn(p*.21+uSeed)));
float ab=(.92+.2*sd)*(1.-.3*pit)*(1.-.35*rl);
vec3 K=normalize(vec3(-.55,.65,.72)),S=normalize(vec3(-.3,.9,.3)),L2=normalize(vec3(.85,.1,.45));
float nv=max(dot(n,v),1e-3);
vec3 F=F0+(1.-F0)*pow(1.-nv,5.)*.5;
vec3 rr=reflect(-v,n);
vec3 env=mix(vec3(.016,.014,.012),vec3(.09,.086,.08),smoothstep(-.1-.3*w,.1+.3*w,rr.y));
env+=vec3(1.,.85,.62)*1.5*smoothstep(-.14-.2*w,.04,rr.y)*(1.-smoothstep(.28,.5+.2*w,rr.y));
env+=vec3(1.,.88,.68)*1.2*pow(max(dot(rr,S),0.),mix(11.,3.,w));
vec3 h=normalize(K+v);float nh=max(dot(n,h),0.),nl=max(dot(n,K),0.);
vec3 sp=F*env+F*vec3(1.,.84,.6)*nl*(pow(nh,mix(70.,12.,w))*.4+pow(nh,400.)*2.5*(1.-pit)*(1.-rl));
vec3 df=F0*(vec3(1.,.88,.7)*.14*nl+vec3(.3,.33,.38)*.12*max(dot(n,L2),0.)+vec3(.13,.125,.115)*(.7+.3*n.y));
col=(df+sp)*ab;
}
col*=uExp;
col=clamp((col*(2.51*col+.03))/(col*(2.43*col+.59)+.14),0.,1.);
col=pow(col,vec3(1./2.2));
o=vec4(col,1.);}`;

/** Draw into a canvas (white = raised) for the relief shader: lettering, lattice, anything flat. Soft edges welcome. */
export function reliefCanvas(w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void) {
  const cv = (typeof document === 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas')) as HTMLCanvasElement;
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#fff'; c.strokeStyle = '#fff'; c.shadowBlur = 0;
  draw(c, w, h);
  return cv;
}
