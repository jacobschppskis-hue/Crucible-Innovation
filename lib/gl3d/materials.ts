// Procedural materials as one uber shader: sand-cast bone metal, the glowing core, hot metal (temperature uniform) and
// packed sand. Warm key light upper-left, dim cool fill, an Ember rim from below (as if lit by the liquid), filmic tone map.
export const MATERIALS = { cast: 0, core: 1, hot: 2, sand: 3, ingot: 4 } as const;
export type MaterialName = keyof typeof MATERIALS;

export const VS = `#version 300 es
in vec3 aP;in vec3 aN;uniform mat4 uM,uVP;out vec3 vP;out vec3 vW;out vec3 vO;
void main(){vP=aP;vO=aN;vec4 w=uM*vec4(aP,1.);vW=w.xyz;gl_Position=uVP*w;}`;

export const FS = `#version 300 es
precision highp float;
in vec3 vP;in vec3 vW;in vec3 vO;out vec4 o;
uniform int uMat;uniform float uTone,uTemp,uGlow,uSeed,uGrain,uExp,uRel;uniform vec2 uTemper;
uniform vec3 uEye;uniform vec4 uCav,uRelP,uClip;uniform float uTy;uniform mat3 uNM;uniform sampler2D uRelT;
float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float vn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float ht(vec3 p){p=p*uGrain+uSeed;
return .6*(.65*vn(p)+.35*vn(p*2.3+3.1))+.4*(.6*vn(p*9.+7.)+.4*vn(p*21.+1.3));}
vec3 lit(vec3 alb,vec3 n,vec3 v,float ao,float rough,float spec){
vec3 L1=normalize(vec3(-.55,.65,.72)),L2=normalize(vec3(.85,.1,.45)),L3=normalize(vec3(.1,-.9,.4));
float d1=max(dot(n,L1)*.85+.15,0.),d2=max(dot(n,L2)*.8+.2,0.),d3=max(dot(n,L3)*.8+.2,0.);
vec3 c=alb*(vec3(1.,.82,.6)*1.45*d1+vec3(.34,.44,.62)*.42*d2+vec3(1.,.36,.1)*(uMat==3?.1:1.)*d3+vec3(.11,.09,.075)*(.6+.4*n.y)*(uMat==3?.5:1.))*ao;
float sh=mix(70.,9.,rough);
c+=vec3(1.,.88,.7)*pow(max(dot(n,normalize(L1+v)),0.),sh)*spec*d1;
c+=vec3(1.,.4,.14)*pow(max(dot(n,normalize(L3+v)),0.),sh*.5)*spec*.7*d3;
c+=vec3(.5,.36,.26)*pow(1.-max(dot(n,v),0.),4.)*.16*spec*ao;
return c;}
vec3 ramp(float t){
vec3 a=vec3(.04,0.,0.),b=vec3(.4,.035,0.),c=vec3(1.05,.15,.015),d=vec3(1.7,.55,.07),e=vec3(4.,3.,1.8);
return t<.25?mix(a,b,t*4.):t<.5?mix(b,c,(t-.25)*4.):t<.75?mix(c,d,(t-.5)*4.):mix(d,e,(t-.75)*4.);}
void main(){
if(dot(vW,uClip.xyz)>uClip.w)discard;
vec3 p=vP,nO=normalize(vO),v=normalize(uEye-vW);
float h0=ht(p),e=.05/uGrain;
#ifdef SOFT
vec3 g=vec3(0.);
#else
vec3 g=vec3(ht(p+vec3(e,0,0))-h0,ht(p+vec3(0,e,0))-h0,ht(p+vec3(0,0,e))-h0)/e;
#endif
float k=uMat==2?.5:uMat==3?1.3:uMat==1?.9:.55;
g-=dot(g,nO)*nO;
float rl=0.,ao=.6+.8*h0;
vec3 n0=nO;
vec3 nn=normalize(nO-g*k/uGrain*.05);
if(uRel>0.){vec2 uv=(p.xy-uRelP.xy)/uRelP.zw+.5,d=clamp(fwidth(uv)*.55,vec2(.0004),vec2(.0011));float w=smoothstep(.6,.95,nO.z)*step(0.,min(uv.x,uv.y))*step(max(uv.x,uv.y),1.);
rl=texture(uRelT,uv,-1.5).r*w;
vec2 gr=vec2(texture(uRelT,uv+vec2(d.x,0),-1.5).r-texture(uRelT,uv-vec2(d.x,0),-1.5).r,texture(uRelT,uv+vec2(0,d.y),-1.5).r-texture(uRelT,uv-vec2(0,d.y),-1.5).r)*w*(.0011/d);
nn=normalize(mix(nn,nO,.6*rl)-vec3(gr,0.)*uRel);}
vec3 n=normalize(uNM*nn);
vec3 bone=vec3(.7,.67,.6);
vec3 col;
if(uMat==0){
vec3 al=mix(bone,vec3(.2,.185,.18),uTone)*(.74+.5*h0)*(1.+.16*rl);
float tx=smoothstep(uTemper.x,uTemper.x+22.,p.x),tt=tx*uTemper.y;vec3 tc=mix(vec3(.2,.17,.3),vec3(.42,.2,.06),smoothstep(.2,.8,tx));al=mix(al,tc*(.7+.6*h0),tt*smoothstep(.0,.3,tx));
col=lit(al,n,v,ao,.62,.38);
}else if(uMat==1){
float bl=smoothstep(.5,.68,.7*vn(p*uGrain*1.7+5.)+.3*h0);
vec3 al=vec3(1.,.19,.03)*(1.-.78*bl)*(.7+.6*h0);
vec3 em=vec3(1.,.15,.02)*(.5+.3*uGlow)*(1.-.75*bl)*(.6+.8*h0);
col=lit(al,n,v,1.,.42,.55)*.5+em;
col=min(col,vec3(1.,.4,.12));
col+=vec3(1.,.8,.55)*(pow(max(dot(n,normalize(normalize(vec3(-.55,.65,.72))+v)),0.),70.)*.85+pow(max(dot(n,normalize(normalize(vec3(.1,-.9,.4))+v)),0.),30.)*.25)*(1.-.5*bl);
}else if(uMat==2){
vec3 q=p*uGrain*1.6+uSeed*3.;q+=vec3(vn(q*1.7),vn(q*1.7+4.),vn(q*1.7+9.))*1.1;float cn=.6*vn(q)+.4*vn(q*2.1);
float Tl=clamp(uTemp+uTy*vW.y,0.,1.);float T=clamp(Tl+(h0-.5)*.1+rl*.1,0.,1.);
vec3 em=ramp(T);
float cv=smoothstep(.42,.6,(1.-T)*1.6-.5+(cn-.5)*1.25);
vec3 al=bone*mix(.05,1.,pow(1.-Tl,6.))*(.74+.5*h0)*(1.+.07*rl);
vec3 crust=lit(al,n,v,ao,.62,.3)+ramp(Tl*.9)*.35*smoothstep(.0,.6,Tl);
vec3 liq=em*(1.-.35*smoothstep(.1,.4,Tl)*.0)+lit(vec3(.05,.02,.01)+em*.04,n,v,1.,.12,1.1)*.8;
col=mix(liq,crust,cv)+ramp(T)*smoothstep(.0,.5,cv)*(1.-smoothstep(.5,1.,cv))*.5*Tl;
}else if(uMat==4){
vec3 q=p*uGrain*1.4+uSeed*3.;q+=vec3(vn(q*1.6),vn(q*1.6+4.),vn(q*1.6+9.))*.9;float cn=.6*vn(q)+.4*vn(q*2.2);
float hot=clamp(uTemp+(cn-.5)*.55+(h0-.5)*.2-rl*.55,0.,1.);
vec3 deep=vec3(.95,.17,.01),mid=vec3(1.25,.45,.02),yel=vec3(1.55,.82,.07);
vec3 em=hot<.5?mix(deep,mid,hot*2.):mix(mid,yel,(hot-.5)*2.);
float skin=smoothstep(.55,.9,1.-hot+(vn(p*uGrain*3.+uSeed)-.5)*.5);
em=mix(em,vec3(.95,.14,.015),skin*.5*(1.-rl));
em*=1.-.5*rl;
vec3 sp=lit(vec3(.12,.05,.02),n,v,1.,.3,1.)*.7;
float sd=dot(n,normalize(vec3(-.55,.65,.72)));
col=em*(.8+.3*uGlow)*(.62+.38*ao)*(.62+.6*clamp(sd,0.,1.))+sp*.6;
}else{
float gr=vn(p*uGrain*38.);vec3 al=vec3(.016,.013,.011)*(.25+1.5*h0)*(.55+.9*gr)+vec3(.05,.04,.03)*step(.86,gr)*.6;
al*=.32*(1.+uTone*14.);
float ins=step(abs(p.x),uCav.x+.5)*step(abs(p.y),uCav.y+.5);
float dz=clamp((uCav.w-p.z)/9.,0.,1.);
ao=(.5+.7*h0)*(1.-.62*dz*ins);
vec2 qq=max(abs(p.xy)-uCav.xy,0.);float cr=(vn(p*.8)-.5)*5.+(gr-.5)*2.;ao*=mix(1.,mix(.1,1.,smoothstep(.2,2.2,length(qq)+cr)),step(uCav.w-.5,p.z)*step(.5,nO.z));
col=lit(al,n,v,ao,1.,.04);
vec2 q=max(abs(p.xy)-uCav.xy,0.);float dd=length(q);
col+=vec3(1.,.34,.08)*uCav.z*(exp(-dd/4.)*step(.5,nO.z+ins)*(.5+.7*h0)*.7+ins*dz*.25)*(.4+.6*h0);
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
