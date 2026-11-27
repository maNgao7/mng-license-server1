bool near3(vec3 a, vec3 b) { return all(lessThan(abs(a-b), vec3(.002))); }
uint garment() {
    // Original unscaled sparring meshes. Invert their rigid transform so camera
    // movement and changes of pose cannot move the color onto another object.
    mat3x4 t=_106._m0[_2666]._m0;
    vec3 origin=vec3(t[0].w,t[1].w,t[2].w);
    mat3 inverseRotation=mat3(t[0].xyz,t[1].xyz,t[2].xyz);
    vec3 p=inverseRotation*(_2658.xyz-origin);
    vec3 dx=dFdx(p),dy=dFdy(p);
    vec2 ux=dFdx(_2663),uy=dFdy(_2663);
    float det=ux.x*uy.y-ux.y*uy.x;
    if (abs(length(p)-.182)<.004 && abs(dot(normalize(p),normalize(inverseRotation*_2660)))>.99) return 2u;
    if (abs(det)<1e-12) return 0u;
    vec3 edgeU=(dx*uy.y-dy*ux.y)/det,edgeV=(dy*ux.x-dx*uy.x)/det;
    vec3 n=abs(normalize(cross(edgeU,edgeV)));
    // UV derivatives span each box face. Its normal supplies the third extent.
    vec3 halfSize=.5*(abs(edgeU)+abs(edgeV))+abs(p)*n;
    if (near3(halfSize,vec3(.3,.14,.18)) || near3(halfSize,vec3(.3,.14,.21))) return 1u;
    if (near3(halfSize,vec3(.15,.5096,.15)) || near3(halfSize,vec3(.15,.52832,.15))) return 3u;
    if (near3(halfSize,vec3(.33,.125,.15))) return 4u;
    return 0u;
}
vec3 kitColor(vec3 shaded) {
    vec3 base=_137._m0[_134._m0[_106._m0[_2666]._m8 & 65535u]._m0]._m0.rgb;
    float level=clamp(max(max(shaded.r,shaded.g),shaded.b)/max(.00001,max(max(base.r,base.g),base.b)),0.,1.);
    uint kitPart=garment();
    const vec3 blue=vec3(.018,.14,.84), red=vec3(.84,.024,.035);
    bool white=all(greaterThan(base,vec3(.98)));
    bool oldRed=base.r>.98 && base.g<.01 && base.b<.01;
    if (kitPart==1u) { if (white) return red*level; if (oldRed) return blue*level; }
    if (kitPart==2u) { if (white) return blue*level; if (oldRed) return red*level; }
    if (kitPart==3u) {
        if (base.g>.20 && base.r<.01 && base.b<.01) return red*level;
        if (base.b>.98 && base.r<.01 && base.g<.01) return blue*level;
    }
    if (kitPart==4u) { if (oldRed) return red*level; if (base.r>.98 && base.g>.65 && base.b<.01) return blue*level; }
    return shaded;
}
