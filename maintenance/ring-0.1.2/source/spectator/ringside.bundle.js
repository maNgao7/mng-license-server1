(()=>{var Vu=Object.create;var xa=Object.defineProperty;var Ku=Object.getOwnPropertyDescriptor;var Wu=Object.getOwnPropertyNames;var Yu=Object.getPrototypeOf,Xu=Object.prototype.hasOwnProperty;var va=(n,e)=>()=>{try{return e||n((e={exports:{}}).exports,e),e.exports}catch(t){throw e=0,t}};var Ju=(n,e,t,i)=>{if(e&&typeof e=="object"||typeof e=="function")for(let r of Wu(e))!Xu.call(n,r)&&r!==t&&xa(n,r,{get:()=>e[r],enumerable:!(i=Ku(e,r))||i.enumerable});return n};var Ea=(n,e,t)=>(t=n!=null?Vu(Yu(n)):{},Ju(e||!n||!n.__esModule?xa(t,"default",{value:n,enumerable:!0}):t,n));var bu=va((LS,ls)=>{"use strict";var Iu=Object.freeze({centerX:-.5,centerZ:4,halfRing:9,halfDeck:20.5,cornerInset:2.1});typeof ls=="object"&&ls.exports?ls.exports=Iu:globalThis.TikMngRingLayout=Iu});var Lu=va((OS,As)=>{"use strict";function Ru(n){let e=[],t=[[-.62,-1],[.62,-1],[1,-.62],[1,.62],[.62,1],[-.62,1],[-1,.62],[-1,-.62]];for(let i=n.halfRing+4.8;i<=n.halfDeck-1.5;i+=2.5)for(let r=0;r<t.length;r++){let[o,s]=t[r],[a,c]=t[(r+1)%t.length],l=a-o,f=c-s,p=Math.max(1,Math.floor(i*Math.hypot(l,f)/2.85));for(let u=0;u<p;u++){let d=(u+.5)/p;e.push({x:n.centerX+(o+d*l)*i,z:n.centerZ+(s+d*f)*i,heading:Math.atan2(-f,l)})}}return e}typeof As=="object"&&As.exports?As.exports={waitingSeats:Ru}:globalThis.TikMngQueueLayout={waitingSeats:Ru}});var wa=0,gs=1,Ca=2;var $r=1,Sa=2,$t=3,Nt=0,ot=1,_t=2,zt=0,xi=1,Ms=2,_s=3,xs=4,Pa=5,vi=100,Da=101,ya=102,Ta=103,Ba=104,Ia=200,ba=201,Ra=202,La=203,nr=204,rr=205,Oa=206,Ua=207,Na=208,Fa=209,Qa=210,Ga=211,Ha=212,ka=213,za=214,eo=0,to=1,io=2,Li=3,no=4,ro=5,oo=6,so=7,ao=0,Va=1,Ka=2,Vt=0,Wa=1,Ya=2,Xa=3,Ja=4,qa=5,Za=6,ja=7;var vs=300,ei=301,ui=302,or=303,sr=304,Oi=306,ar=1e3,ti=1001,cr=1002,ut=1003,$a=1004;var lr=1005;var Dt=1006,co=1007;var ii=1008;var Et=1009,lo=1010,Ao=1011,Ei=1012,fn=1013,Ft=1014,xt=1015,hi=1016,un=1017,hn=1018,ni=1020,fo=35902,uo=1021,ho=1022,mt=1023,po=1024,mo=1025,di=1026,pi=1027,dn=1028,pn=1029,go=1030,mn=1031;var gn=1033,Mn=33776,_n=33777,xn=33778,vn=33779,Ar=35840,fr=35841,ur=35842,hr=35843,dr=36196,pr=37492,mr=37496,gr=37808,Mr=37809,_r=37810,xr=37811,vr=37812,Er=37813,wr=37814,Cr=37815,Sr=37816,Pr=37817,Dr=37818,yr=37819,Tr=37820,Br=37821,En=36492,Ir=36494,br=36495,Mo=36283,Rr=36284,Lr=36285,Or=36286;var ec=3200,tc=3201;var ic=0,nc=1,Kt="",yt="srgb",ri="srgb-linear",Yi="linear",Ve="srgb";var Xi=7680;var Es=519,rc=512,oc=513,sc=514,_o=515,ac=516,cc=517,lc=518,Ac=519,ws=35044,fc=35048;var Cs="300 es",bt=2e3,Ji=2001;var Rt=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let i=this._listeners;i[e]===void 0&&(i[e]=[]),i[e].indexOf(t)===-1&&i[e].push(t)}hasEventListener(e,t){if(this._listeners===void 0)return!1;let i=this._listeners;return i[e]!==void 0&&i[e].indexOf(t)!==-1}removeEventListener(e,t){if(this._listeners===void 0)return;let r=this._listeners[e];if(r!==void 0){let o=r.indexOf(t);o!==-1&&r.splice(o,1)}}dispatchEvent(e){if(this._listeners===void 0)return;let i=this._listeners[e.type];if(i!==void 0){e.target=this;let r=i.slice(0);for(let o=0,s=r.length;o<s;o++)r[o].call(this,e);e.target=null}}};var wt=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];var xo=Math.PI/180,Ur=180/Math.PI;function mi(){let n=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(wt[n&255]+wt[n>>8&255]+wt[n>>16&255]+wt[n>>24&255]+"-"+wt[e&255]+wt[e>>8&255]+"-"+wt[e>>16&15|64]+wt[e>>24&255]+"-"+wt[t&63|128]+wt[t>>8&255]+"-"+wt[t>>16&255]+wt[t>>24&255]+wt[i&255]+wt[i>>8&255]+wt[i>>16&255]+wt[i>>24&255]).toLowerCase()}function ht(n,e,t){return Math.max(e,Math.min(t,n))}function uc(n,e){return(n%e+e)%e}function vo(n,e,t){return(1-t)*n+t*e}function wn(n,e){switch(e.constructor){case Float32Array:return n;case Uint32Array:return n/4294967295;case Uint16Array:return n/65535;case Uint8Array:return n/255;case Int32Array:return Math.max(n/2147483647,-1);case Int16Array:return Math.max(n/32767,-1);case Int8Array:return Math.max(n/127,-1);default:throw new Error("Invalid component type.")}}function Tt(n,e){switch(e.constructor){case Float32Array:return n;case Uint32Array:return Math.round(n*4294967295);case Uint16Array:return Math.round(n*65535);case Uint8Array:return Math.round(n*255);case Int32Array:return Math.round(n*2147483647);case Int16Array:return Math.round(n*32767);case Int8Array:return Math.round(n*127);default:throw new Error("Invalid component type.")}}var Qe=class n{constructor(e=0,t=0){n.prototype.isVector2=!0,this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,i=this.y,r=e.elements;return this.x=r[0]*t+r[3]*i+r[6],this.y=r[1]*t+r[4]*i+r[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(e,Math.min(t,i)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let i=this.dot(e)/t;return Math.acos(ht(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,i=this.y-e.y;return t*t+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let i=Math.cos(t),r=Math.sin(t),o=this.x-e.x,s=this.y-e.y;return this.x=o*i-s*r+e.x,this.y=o*r+s*i+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}};var ye=class n{constructor(e,t,i,r,o,s,a,c,l){n.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,i,r,o,s,a,c,l)}set(e,t,i,r,o,s,a,c,l){let f=this.elements;return f[0]=e,f[1]=r,f[2]=a,f[3]=t,f[4]=o,f[5]=c,f[6]=i,f[7]=s,f[8]=l,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],this}extractBasis(e,t,i){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let i=e.elements,r=t.elements,o=this.elements,s=i[0],a=i[3],c=i[6],l=i[1],f=i[4],p=i[7],u=i[2],d=i[5],m=i[8],M=r[0],h=r[3],A=r[6],w=r[1],C=r[4],v=r[7],N=r[2],D=r[5],y=r[8];return o[0]=s*M+a*w+c*N,o[3]=s*h+a*C+c*D,o[6]=s*A+a*v+c*y,o[1]=l*M+f*w+p*N,o[4]=l*h+f*C+p*D,o[7]=l*A+f*v+p*y,o[2]=u*M+d*w+m*N,o[5]=u*h+d*C+m*D,o[8]=u*A+d*v+m*y,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],i=e[1],r=e[2],o=e[3],s=e[4],a=e[5],c=e[6],l=e[7],f=e[8];return t*s*f-t*a*l-i*o*f+i*a*c+r*o*l-r*s*c}invert(){let e=this.elements,t=e[0],i=e[1],r=e[2],o=e[3],s=e[4],a=e[5],c=e[6],l=e[7],f=e[8],p=f*s-a*l,u=a*c-f*o,d=l*o-s*c,m=t*p+i*u+r*d;if(m===0)return this.set(0,0,0,0,0,0,0,0,0);let M=1/m;return e[0]=p*M,e[1]=(r*l-f*i)*M,e[2]=(a*i-r*s)*M,e[3]=u*M,e[4]=(f*t-r*c)*M,e[5]=(r*o-a*t)*M,e[6]=d*M,e[7]=(i*c-l*t)*M,e[8]=(s*t-i*o)*M,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,i,r,o,s,a){let c=Math.cos(o),l=Math.sin(o);return this.set(i*c,i*l,-i*(c*s+l*a)+s+e,-r*l,r*c,-r*(-l*s+c*a)+a+t,0,0,1),this}scale(e,t){return this.premultiply(Ss.makeScale(e,t)),this}rotate(e){return this.premultiply(Ss.makeRotation(-e)),this}translate(e,t){return this.premultiply(Ss.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,i,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,i=e.elements;for(let r=0;r<9;r++)if(t[r]!==i[r])return!1;return!0}fromArray(e,t=0){for(let i=0;i<9;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){let i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e}clone(){return new this.constructor().fromArray(this.elements)}},Ss=new ye;function Eo(n){for(let e=n.length-1;e>=0;--e)if(n[e]>=65535)return!0;return!1}function Cn(n){return document.createElementNS("http://www.w3.org/1999/xhtml",n)}function dc(){let n=Cn("canvas");return n.style.display="block",n}var hc={};function qi(n){n in hc||(hc[n]=!0,console.warn(n))}function pc(n,e,t){return new Promise(function(i,r){function o(){switch(n.clientWaitSync(e,n.SYNC_FLUSH_COMMANDS_BIT,0)){case n.WAIT_FAILED:r();break;case n.TIMEOUT_EXPIRED:setTimeout(o,t);break;default:i()}}setTimeout(o,t)})}function mc(n){let e=n.elements;e[2]=.5*e[2]+.5*e[3],e[6]=.5*e[6]+.5*e[7],e[10]=.5*e[10]+.5*e[11],e[14]=.5*e[14]+.5*e[15]}function gc(n){let e=n.elements;e[11]===-1?(e[10]=-e[10]-1,e[14]=-e[14]):(e[10]=-e[10],e[14]=-e[14]+1)}var Ne={enabled:!0,workingColorSpace:ri,spaces:{},convert:function(n,e,t){return this.enabled===!1||e===t||!e||!t||(this.spaces[e].transfer===Ve&&(n.r=oi(n.r),n.g=oi(n.g),n.b=oi(n.b)),this.spaces[e].primaries!==this.spaces[t].primaries&&(n.applyMatrix3(this.spaces[e].toXYZ),n.applyMatrix3(this.spaces[t].fromXYZ)),this.spaces[t].transfer===Ve&&(n.r=Zi(n.r),n.g=Zi(n.g),n.b=Zi(n.b))),n},fromWorkingColorSpace:function(n,e){return this.convert(n,this.workingColorSpace,e)},toWorkingColorSpace:function(n,e){return this.convert(n,e,this.workingColorSpace)},getPrimaries:function(n){return this.spaces[n].primaries},getTransfer:function(n){return n===Kt?Yi:this.spaces[n].transfer},getLuminanceCoefficients:function(n,e=this.workingColorSpace){return n.fromArray(this.spaces[e].luminanceCoefficients)},define:function(n){Object.assign(this.spaces,n)},_getMatrix:function(n,e,t){return n.copy(this.spaces[e].toXYZ).multiply(this.spaces[t].fromXYZ)},_getDrawingBufferColorSpace:function(n){return this.spaces[n].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(n=this.workingColorSpace){return this.spaces[n].workingColorSpaceConfig.unpackColorSpace}};function oi(n){return n<.04045?n*.0773993808:Math.pow(n*.9478672986+.0521327014,2.4)}function Zi(n){return n<.0031308?n*12.92:1.055*Math.pow(n,.41666)-.055}var Mc=[.64,.33,.3,.6,.15,.06],_c=[.2126,.7152,.0722],xc=[.3127,.329],vc=new ye().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Ec=new ye().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);Ne.define({[ri]:{primaries:Mc,whitePoint:xc,transfer:Yi,toXYZ:vc,fromXYZ:Ec,luminanceCoefficients:_c,workingColorSpaceConfig:{unpackColorSpace:yt},outputColorSpaceConfig:{drawingBufferColorSpace:yt}},[yt]:{primaries:Mc,whitePoint:xc,transfer:Ve,toXYZ:vc,fromXYZ:Ec,luminanceCoefficients:_c,outputColorSpaceConfig:{drawingBufferColorSpace:yt}}});var Sn,wo=class{static getDataURL(e){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let t;if(e instanceof HTMLCanvasElement)t=e;else{Sn===void 0&&(Sn=Cn("canvas")),Sn.width=e.width,Sn.height=e.height;let i=Sn.getContext("2d");e instanceof ImageData?i.putImageData(e,0,0):i.drawImage(e,0,0,e.width,e.height),t=Sn}return t.width>2048||t.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",e),t.toDataURL("image/jpeg",.6)):t.toDataURL("image/png")}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){let t=Cn("canvas");t.width=e.width,t.height=e.height;let i=t.getContext("2d");i.drawImage(e,0,0,e.width,e.height);let r=i.getImageData(0,0,e.width,e.height),o=r.data;for(let s=0;s<o.length;s++)o[s]=oi(o[s]/255)*255;return i.putImageData(r,0,0),t}else if(e.data){let t=e.data.slice(0);for(let i=0;i<t.length;i++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[i]=Math.floor(oi(t[i]/255)*255):t[i]=oi(t[i]);return{data:t,width:e.width,height:e.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}};var qu=0,Pn=class{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:qu++}),this.uuid=mi(),this.data=e,this.dataReady=!0,this.version=0}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let i={uuid:this.uuid,url:""},r=this.data;if(r!==null){let o;if(Array.isArray(r)){o=[];for(let s=0,a=r.length;s<a;s++)r[s].isDataTexture?o.push(Ps(r[s].image)):o.push(Ps(r[s]))}else o=Ps(r);i.url=o}return t||(e.images[this.uuid]=i),i}};function Ps(n){return typeof HTMLImageElement<"u"&&n instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&n instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&n instanceof ImageBitmap?wo.getDataURL(n):n.data?{data:Array.from(n.data),width:n.width,height:n.height,type:n.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}var Zu=0,st=class n extends Rt{constructor(e=n.DEFAULT_IMAGE,t=n.DEFAULT_MAPPING,i=ti,r=ti,o=Dt,s=ii,a=mt,c=Et,l=n.DEFAULT_ANISOTROPY,f=Kt){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Zu++}),this.uuid=mi(),this.name="",this.source=new Pn(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=i,this.wrapT=r,this.magFilter=o,this.minFilter=s,this.anisotropy=l,this.format=a,this.internalFormat=null,this.type=c,this.offset=new Qe(0,0),this.repeat=new Qe(1,1),this.center=new Qe(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new ye,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=f,this.userData={},this.version=0,this.onUpdate=null,this.isRenderTargetTexture=!1,this.pmremVersion=0}get image(){return this.source.data}set image(e=null){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let i={metadata:{version:4.6,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(i.userData=this.userData),t||(e.textures[this.uuid]=i),i}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==vs)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case ar:e.x=e.x-Math.floor(e.x);break;case ti:e.x=e.x<0?0:1;break;case cr:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case ar:e.y=e.y-Math.floor(e.y);break;case ti:e.y=e.y<0?0:1;break;case cr:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}};st.DEFAULT_IMAGE=null;st.DEFAULT_MAPPING=vs;st.DEFAULT_ANISOTROPY=1;var et=class n{constructor(e=0,t=0,i=0,r=1){n.prototype.isVector4=!0,this.x=e,this.y=t,this.z=i,this.w=r}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,i,r){return this.x=e,this.y=t,this.z=i,this.w=r,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,i=this.y,r=this.z,o=this.w,s=e.elements;return this.x=s[0]*t+s[4]*i+s[8]*r+s[12]*o,this.y=s[1]*t+s[5]*i+s[9]*r+s[13]*o,this.z=s[2]*t+s[6]*i+s[10]*r+s[14]*o,this.w=s[3]*t+s[7]*i+s[11]*r+s[15]*o,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,i,r,o,c=e.elements,l=c[0],f=c[4],p=c[8],u=c[1],d=c[5],m=c[9],M=c[2],h=c[6],A=c[10];if(Math.abs(f-u)<.01&&Math.abs(p-M)<.01&&Math.abs(m-h)<.01){if(Math.abs(f+u)<.1&&Math.abs(p+M)<.1&&Math.abs(m+h)<.1&&Math.abs(l+d+A-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;let C=(l+1)/2,v=(d+1)/2,N=(A+1)/2,D=(f+u)/4,y=(p+M)/4,L=(m+h)/4;return C>v&&C>N?C<.01?(i=0,r=.707106781,o=.707106781):(i=Math.sqrt(C),r=D/i,o=y/i):v>N?v<.01?(i=.707106781,r=0,o=.707106781):(r=Math.sqrt(v),i=D/r,o=L/r):N<.01?(i=.707106781,r=.707106781,o=0):(o=Math.sqrt(N),i=y/o,r=L/o),this.set(i,r,o,t),this}let w=Math.sqrt((h-m)*(h-m)+(p-M)*(p-M)+(u-f)*(u-f));return Math.abs(w)<.001&&(w=1),this.x=(h-m)/w,this.y=(p-M)/w,this.z=(u-f)/w,this.w=Math.acos((l+d+A-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this.w=Math.max(e.w,Math.min(t.w,this.w)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this.z=Math.max(e,Math.min(t,this.z)),this.w=Math.max(e,Math.min(t,this.w)),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(e,Math.min(t,i)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this.w=e.w+(t.w-e.w)*i,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}};var Co=class extends Rt{constructor(e=1,t=1,i={}){super(),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=1,this.scissor=new et(0,0,e,t),this.scissorTest=!1,this.viewport=new et(0,0,e,t);let r={width:e,height:t,depth:1};i=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Dt,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1},i);let o=new st(r,i.mapping,i.wrapS,i.wrapT,i.magFilter,i.minFilter,i.format,i.type,i.anisotropy,i.colorSpace);o.flipY=!1,o.generateMipmaps=i.generateMipmaps,o.internalFormat=i.internalFormat,this.textures=[];let s=i.count;for(let a=0;a<s;a++)this.textures[a]=o.clone(),this.textures[a].isRenderTargetTexture=!0;this.depthBuffer=i.depthBuffer,this.stencilBuffer=i.stencilBuffer,this.resolveDepthBuffer=i.resolveDepthBuffer,this.resolveStencilBuffer=i.resolveStencilBuffer,this.depthTexture=i.depthTexture,this.samples=i.samples}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}setSize(e,t,i=1){if(this.width!==e||this.height!==t||this.depth!==i){this.width=e,this.height=t,this.depth=i;for(let r=0,o=this.textures.length;r<o;r++)this.textures[r].image.width=e,this.textures[r].image.height=t,this.textures[r].image.depth=i;this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let i=0,r=e.textures.length;i<r;i++)this.textures[i]=e.textures[i].clone(),this.textures[i].isRenderTargetTexture=!0;let t=Object.assign({},e.texture.image);return this.texture.source=new Pn(t),this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}};var Lt=class extends Co{constructor(e=1,t=1,i={}){super(e,t,i),this.isWebGLRenderTarget=!0}};var Dn=class extends st{constructor(e=null,t=1,i=1,r=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:i,depth:r},this.magFilter=ut,this.minFilter=ut,this.wrapR=ti,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}};var So=class extends st{constructor(e=null,t=1,i=1,r=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:i,depth:r},this.magFilter=ut,this.minFilter=ut,this.wrapR=ti,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var Ct=class{constructor(e=0,t=0,i=0,r=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=i,this._w=r}static slerpFlat(e,t,i,r,o,s,a){let c=i[r+0],l=i[r+1],f=i[r+2],p=i[r+3],u=o[s+0],d=o[s+1],m=o[s+2],M=o[s+3];if(a===0){e[t+0]=c,e[t+1]=l,e[t+2]=f,e[t+3]=p;return}if(a===1){e[t+0]=u,e[t+1]=d,e[t+2]=m,e[t+3]=M;return}if(p!==M||c!==u||l!==d||f!==m){let h=1-a,A=c*u+l*d+f*m+p*M,w=A>=0?1:-1,C=1-A*A;if(C>Number.EPSILON){let N=Math.sqrt(C),D=Math.atan2(N,A*w);h=Math.sin(h*D)/N,a=Math.sin(a*D)/N}let v=a*w;if(c=c*h+u*v,l=l*h+d*v,f=f*h+m*v,p=p*h+M*v,h===1-a){let N=1/Math.sqrt(c*c+l*l+f*f+p*p);c*=N,l*=N,f*=N,p*=N}}e[t]=c,e[t+1]=l,e[t+2]=f,e[t+3]=p}static multiplyQuaternionsFlat(e,t,i,r,o,s){let a=i[r],c=i[r+1],l=i[r+2],f=i[r+3],p=o[s],u=o[s+1],d=o[s+2],m=o[s+3];return e[t]=a*m+f*p+c*d-l*u,e[t+1]=c*m+f*u+l*p-a*d,e[t+2]=l*m+f*d+a*u-c*p,e[t+3]=f*m-a*p-c*u-l*d,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,i,r){return this._x=e,this._y=t,this._z=i,this._w=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let i=e._x,r=e._y,o=e._z,s=e._order,a=Math.cos,c=Math.sin,l=a(i/2),f=a(r/2),p=a(o/2),u=c(i/2),d=c(r/2),m=c(o/2);switch(s){case"XYZ":this._x=u*f*p+l*d*m,this._y=l*d*p-u*f*m,this._z=l*f*m+u*d*p,this._w=l*f*p-u*d*m;break;case"YXZ":this._x=u*f*p+l*d*m,this._y=l*d*p-u*f*m,this._z=l*f*m-u*d*p,this._w=l*f*p+u*d*m;break;case"ZXY":this._x=u*f*p-l*d*m,this._y=l*d*p+u*f*m,this._z=l*f*m+u*d*p,this._w=l*f*p-u*d*m;break;case"ZYX":this._x=u*f*p-l*d*m,this._y=l*d*p+u*f*m,this._z=l*f*m-u*d*p,this._w=l*f*p+u*d*m;break;case"YZX":this._x=u*f*p+l*d*m,this._y=l*d*p+u*f*m,this._z=l*f*m-u*d*p,this._w=l*f*p-u*d*m;break;case"XZY":this._x=u*f*p-l*d*m,this._y=l*d*p-u*f*m,this._z=l*f*m+u*d*p,this._w=l*f*p+u*d*m;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+s)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let i=t/2,r=Math.sin(i);return this._x=e.x*r,this._y=e.y*r,this._z=e.z*r,this._w=Math.cos(i),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,i=t[0],r=t[4],o=t[8],s=t[1],a=t[5],c=t[9],l=t[2],f=t[6],p=t[10],u=i+a+p;if(u>0){let d=.5/Math.sqrt(u+1);this._w=.25/d,this._x=(f-c)*d,this._y=(o-l)*d,this._z=(s-r)*d}else if(i>a&&i>p){let d=2*Math.sqrt(1+i-a-p);this._w=(f-c)/d,this._x=.25*d,this._y=(r+s)/d,this._z=(o+l)/d}else if(a>p){let d=2*Math.sqrt(1+a-i-p);this._w=(o-l)/d,this._x=(r+s)/d,this._y=.25*d,this._z=(c+f)/d}else{let d=2*Math.sqrt(1+p-i-a);this._w=(s-r)/d,this._x=(o+l)/d,this._y=(c+f)/d,this._z=.25*d}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let i=e.dot(t)+1;return i<Number.EPSILON?(i=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=i):(this._x=0,this._y=-e.z,this._z=e.y,this._w=i)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=i),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(ht(this.dot(e),-1,1)))}rotateTowards(e,t){let i=this.angleTo(e);if(i===0)return this;let r=Math.min(1,t/i);return this.slerp(e,r),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let i=e._x,r=e._y,o=e._z,s=e._w,a=t._x,c=t._y,l=t._z,f=t._w;return this._x=i*f+s*a+r*l-o*c,this._y=r*f+s*c+o*a-i*l,this._z=o*f+s*l+i*c-r*a,this._w=s*f-i*a-r*c-o*l,this._onChangeCallback(),this}slerp(e,t){if(t===0)return this;if(t===1)return this.copy(e);let i=this._x,r=this._y,o=this._z,s=this._w,a=s*e._w+i*e._x+r*e._y+o*e._z;if(a<0?(this._w=-e._w,this._x=-e._x,this._y=-e._y,this._z=-e._z,a=-a):this.copy(e),a>=1)return this._w=s,this._x=i,this._y=r,this._z=o,this;let c=1-a*a;if(c<=Number.EPSILON){let d=1-t;return this._w=d*s+t*this._w,this._x=d*i+t*this._x,this._y=d*r+t*this._y,this._z=d*o+t*this._z,this.normalize(),this}let l=Math.sqrt(c),f=Math.atan2(l,a),p=Math.sin((1-t)*f)/l,u=Math.sin(t*f)/l;return this._w=s*p+this._w*u,this._x=i*p+this._x*u,this._y=r*p+this._y*u,this._z=o*p+this._z*u,this._onChangeCallback(),this}slerpQuaternions(e,t,i){return this.copy(e).slerp(t,i)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),i=Math.random(),r=Math.sqrt(1-i),o=Math.sqrt(i);return this.set(r*Math.sin(e),r*Math.cos(e),o*Math.sin(t),o*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}};var R=class n{constructor(e=0,t=0,i=0){n.prototype.isVector3=!0,this.x=e,this.y=t,this.z=i}set(e,t,i){return i===void 0&&(i=this.z),this.x=e,this.y=t,this.z=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(wc.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(wc.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,i=this.y,r=this.z,o=e.elements;return this.x=o[0]*t+o[3]*i+o[6]*r,this.y=o[1]*t+o[4]*i+o[7]*r,this.z=o[2]*t+o[5]*i+o[8]*r,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,i=this.y,r=this.z,o=e.elements,s=1/(o[3]*t+o[7]*i+o[11]*r+o[15]);return this.x=(o[0]*t+o[4]*i+o[8]*r+o[12])*s,this.y=(o[1]*t+o[5]*i+o[9]*r+o[13])*s,this.z=(o[2]*t+o[6]*i+o[10]*r+o[14])*s,this}applyQuaternion(e){let t=this.x,i=this.y,r=this.z,o=e.x,s=e.y,a=e.z,c=e.w,l=2*(s*r-a*i),f=2*(a*t-o*r),p=2*(o*i-s*t);return this.x=t+c*l+s*p-a*f,this.y=i+c*f+a*l-o*p,this.z=r+c*p+o*f-s*l,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,i=this.y,r=this.z,o=e.elements;return this.x=o[0]*t+o[4]*i+o[8]*r,this.y=o[1]*t+o[5]*i+o[9]*r,this.z=o[2]*t+o[6]*i+o[10]*r,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this.z=Math.max(e,Math.min(t,this.z)),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(e,Math.min(t,i)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let i=e.x,r=e.y,o=e.z,s=t.x,a=t.y,c=t.z;return this.x=r*c-o*a,this.y=o*s-i*c,this.z=i*a-r*s,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let i=e.dot(this)/t;return this.copy(e).multiplyScalar(i)}projectOnPlane(e){return Ds.copy(this).projectOnVector(e),this.sub(Ds)}reflect(e){return this.sub(Ds.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let i=this.dot(e)/t;return Math.acos(ht(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,i=this.y-e.y,r=this.z-e.z;return t*t+i*i+r*r}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,i){let r=Math.sin(t)*e;return this.x=r*Math.sin(i),this.y=Math.cos(t)*e,this.z=r*Math.cos(i),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,i){return this.x=e*Math.sin(t),this.y=i,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),i=this.setFromMatrixColumn(e,1).length(),r=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=i,this.z=r,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,i=Math.sqrt(1-t*t);return this.x=i*Math.cos(e),this.y=t,this.z=i*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},Ds=new R,wc=new Ct;var Wt=class{constructor(e=new R(1/0,1/0,1/0),t=new R(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t+=3)this.expandByPoint(si.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,i=e.count;t<i;t++)this.expandByPoint(si.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let i=si.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(i),this.max.copy(e).add(i),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let i=e.geometry;if(i!==void 0){let o=i.getAttribute("position");if(t===!0&&o!==void 0&&e.isInstancedMesh!==!0)for(let s=0,a=o.count;s<a;s++)e.isMesh===!0?e.getVertexPosition(s,si):si.fromBufferAttribute(o,s),si.applyMatrix4(e.matrixWorld),this.expandByPoint(si);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),Po.copy(e.boundingBox)):(i.boundingBox===null&&i.computeBoundingBox(),Po.copy(i.boundingBox)),Po.applyMatrix4(e.matrixWorld),this.union(Po)}let r=e.children;for(let o=0,s=r.length;o<s;o++)this.expandByObject(r[o],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,si),si.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,i;return e.normal.x>0?(t=e.normal.x*this.min.x,i=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,i=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,i+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,i+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,i+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,i+=e.normal.z*this.min.z),t<=-e.constant&&i>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Nr),Do.subVectors(this.max,Nr),yn.subVectors(e.a,Nr),Tn.subVectors(e.b,Nr),Bn.subVectors(e.c,Nr),Ui.subVectors(Tn,yn),Ni.subVectors(Bn,Tn),ji.subVectors(yn,Bn);let t=[0,-Ui.z,Ui.y,0,-Ni.z,Ni.y,0,-ji.z,ji.y,Ui.z,0,-Ui.x,Ni.z,0,-Ni.x,ji.z,0,-ji.x,-Ui.y,Ui.x,0,-Ni.y,Ni.x,0,-ji.y,ji.x,0];return!ys(t,yn,Tn,Bn,Do)||(t=[1,0,0,0,1,0,0,0,1],!ys(t,yn,Tn,Bn,Do))?!1:(yo.crossVectors(Ui,Ni),t=[yo.x,yo.y,yo.z],ys(t,yn,Tn,Bn,Do))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,si).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(si).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(Ci[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),Ci[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),Ci[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),Ci[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),Ci[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),Ci[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),Ci[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),Ci[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(Ci),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}},Ci=[new R,new R,new R,new R,new R,new R,new R,new R],si=new R,Po=new Wt,yn=new R,Tn=new R,Bn=new R,Ui=new R,Ni=new R,ji=new R,Nr=new R,Do=new R,yo=new R,$i=new R;function ys(n,e,t,i,r){for(let o=0,s=n.length-3;o<=s;o+=3){$i.fromArray(n,o);let a=r.x*Math.abs($i.x)+r.y*Math.abs($i.y)+r.z*Math.abs($i.z),c=e.dot($i),l=t.dot($i),f=i.dot($i);if(Math.max(-Math.max(c,l,f),Math.min(c,l,f))>a)return!1}return!0}var ju=new Wt,Fr=new R,Ts=new R,ai=class{constructor(e=new R,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let i=this.center;t!==void 0?i.copy(t):ju.setFromPoints(e).getCenter(i);let r=0;for(let o=0,s=e.length;o<s;o++)r=Math.max(r,i.distanceToSquared(e[o]));return this.radius=Math.sqrt(r),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let i=this.center.distanceToSquared(e);return t.copy(e),i>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Fr.subVectors(e,this.center);let t=Fr.lengthSq();if(t>this.radius*this.radius){let i=Math.sqrt(t),r=(i-this.radius)*.5;this.center.addScaledVector(Fr,r/i),this.radius+=r}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(Ts.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Fr.copy(e.center).add(Ts)),this.expandByPoint(Fr.copy(e.center).sub(Ts))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}};var Si=new R,Bs=new R,To=new R,Fi=new R,Is=new R,Bo=new R,bs=new R,Io=class{constructor(e=new R,t=new R(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,Si)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let i=t.dot(this.direction);return i<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,i)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=Si.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(Si.copy(this.origin).addScaledVector(this.direction,t),Si.distanceToSquared(e))}distanceSqToSegment(e,t,i,r){Bs.copy(e).add(t).multiplyScalar(.5),To.copy(t).sub(e).normalize(),Fi.copy(this.origin).sub(Bs);let o=e.distanceTo(t)*.5,s=-this.direction.dot(To),a=Fi.dot(this.direction),c=-Fi.dot(To),l=Fi.lengthSq(),f=Math.abs(1-s*s),p,u,d,m;if(f>0)if(p=s*c-a,u=s*a-c,m=o*f,p>=0)if(u>=-m)if(u<=m){let M=1/f;p*=M,u*=M,d=p*(p+s*u+2*a)+u*(s*p+u+2*c)+l}else u=o,p=Math.max(0,-(s*u+a)),d=-p*p+u*(u+2*c)+l;else u=-o,p=Math.max(0,-(s*u+a)),d=-p*p+u*(u+2*c)+l;else u<=-m?(p=Math.max(0,-(-s*o+a)),u=p>0?-o:Math.min(Math.max(-o,-c),o),d=-p*p+u*(u+2*c)+l):u<=m?(p=0,u=Math.min(Math.max(-o,-c),o),d=u*(u+2*c)+l):(p=Math.max(0,-(s*o+a)),u=p>0?o:Math.min(Math.max(-o,-c),o),d=-p*p+u*(u+2*c)+l);else u=s>0?-o:o,p=Math.max(0,-(s*u+a)),d=-p*p+u*(u+2*c)+l;return i&&i.copy(this.origin).addScaledVector(this.direction,p),r&&r.copy(Bs).addScaledVector(To,u),d}intersectSphere(e,t){Si.subVectors(e.center,this.origin);let i=Si.dot(this.direction),r=Si.dot(Si)-i*i,o=e.radius*e.radius;if(r>o)return null;let s=Math.sqrt(o-r),a=i-s,c=i+s;return c<0?null:a<0?this.at(c,t):this.at(a,t)}intersectsSphere(e){return this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let i=-(this.origin.dot(e.normal)+e.constant)/t;return i>=0?i:null}intersectPlane(e,t){let i=this.distanceToPlane(e);return i===null?null:this.at(i,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let i,r,o,s,a,c,l=1/this.direction.x,f=1/this.direction.y,p=1/this.direction.z,u=this.origin;return l>=0?(i=(e.min.x-u.x)*l,r=(e.max.x-u.x)*l):(i=(e.max.x-u.x)*l,r=(e.min.x-u.x)*l),f>=0?(o=(e.min.y-u.y)*f,s=(e.max.y-u.y)*f):(o=(e.max.y-u.y)*f,s=(e.min.y-u.y)*f),i>s||o>r||((o>i||isNaN(i))&&(i=o),(s<r||isNaN(r))&&(r=s),p>=0?(a=(e.min.z-u.z)*p,c=(e.max.z-u.z)*p):(a=(e.max.z-u.z)*p,c=(e.min.z-u.z)*p),i>c||a>r)||((a>i||i!==i)&&(i=a),(c<r||r!==r)&&(r=c),r<0)?null:this.at(i>=0?i:r,t)}intersectsBox(e){return this.intersectBox(e,Si)!==null}intersectTriangle(e,t,i,r,o){Is.subVectors(t,e),Bo.subVectors(i,e),bs.crossVectors(Is,Bo);let s=this.direction.dot(bs),a;if(s>0){if(r)return null;a=1}else if(s<0)a=-1,s=-s;else return null;Fi.subVectors(this.origin,e);let c=a*this.direction.dot(Bo.crossVectors(Fi,Bo));if(c<0)return null;let l=a*this.direction.dot(Is.cross(Fi));if(l<0||c+l>s)return null;let f=-a*Fi.dot(bs);return f<0?null:this.at(f/s,o)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}};var We=class n{constructor(e,t,i,r,o,s,a,c,l,f,p,u,d,m,M,h){n.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,i,r,o,s,a,c,l,f,p,u,d,m,M,h)}set(e,t,i,r,o,s,a,c,l,f,p,u,d,m,M,h){let A=this.elements;return A[0]=e,A[4]=t,A[8]=i,A[12]=r,A[1]=o,A[5]=s,A[9]=a,A[13]=c,A[2]=l,A[6]=f,A[10]=p,A[14]=u,A[3]=d,A[7]=m,A[11]=M,A[15]=h,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new n().fromArray(this.elements)}copy(e){let t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],t[9]=i[9],t[10]=i[10],t[11]=i[11],t[12]=i[12],t[13]=i[13],t[14]=i[14],t[15]=i[15],this}copyPosition(e){let t=this.elements,i=e.elements;return t[12]=i[12],t[13]=i[13],t[14]=i[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,i){return e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this}makeBasis(e,t,i){return this.set(e.x,t.x,i.x,0,e.y,t.y,i.y,0,e.z,t.z,i.z,0,0,0,0,1),this}extractRotation(e){let t=this.elements,i=e.elements,r=1/In.setFromMatrixColumn(e,0).length(),o=1/In.setFromMatrixColumn(e,1).length(),s=1/In.setFromMatrixColumn(e,2).length();return t[0]=i[0]*r,t[1]=i[1]*r,t[2]=i[2]*r,t[3]=0,t[4]=i[4]*o,t[5]=i[5]*o,t[6]=i[6]*o,t[7]=0,t[8]=i[8]*s,t[9]=i[9]*s,t[10]=i[10]*s,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,i=e.x,r=e.y,o=e.z,s=Math.cos(i),a=Math.sin(i),c=Math.cos(r),l=Math.sin(r),f=Math.cos(o),p=Math.sin(o);if(e.order==="XYZ"){let u=s*f,d=s*p,m=a*f,M=a*p;t[0]=c*f,t[4]=-c*p,t[8]=l,t[1]=d+m*l,t[5]=u-M*l,t[9]=-a*c,t[2]=M-u*l,t[6]=m+d*l,t[10]=s*c}else if(e.order==="YXZ"){let u=c*f,d=c*p,m=l*f,M=l*p;t[0]=u+M*a,t[4]=m*a-d,t[8]=s*l,t[1]=s*p,t[5]=s*f,t[9]=-a,t[2]=d*a-m,t[6]=M+u*a,t[10]=s*c}else if(e.order==="ZXY"){let u=c*f,d=c*p,m=l*f,M=l*p;t[0]=u-M*a,t[4]=-s*p,t[8]=m+d*a,t[1]=d+m*a,t[5]=s*f,t[9]=M-u*a,t[2]=-s*l,t[6]=a,t[10]=s*c}else if(e.order==="ZYX"){let u=s*f,d=s*p,m=a*f,M=a*p;t[0]=c*f,t[4]=m*l-d,t[8]=u*l+M,t[1]=c*p,t[5]=M*l+u,t[9]=d*l-m,t[2]=-l,t[6]=a*c,t[10]=s*c}else if(e.order==="YZX"){let u=s*c,d=s*l,m=a*c,M=a*l;t[0]=c*f,t[4]=M-u*p,t[8]=m*p+d,t[1]=p,t[5]=s*f,t[9]=-a*f,t[2]=-l*f,t[6]=d*p+m,t[10]=u-M*p}else if(e.order==="XZY"){let u=s*c,d=s*l,m=a*c,M=a*l;t[0]=c*f,t[4]=-p,t[8]=l*f,t[1]=u*p+M,t[5]=s*f,t[9]=d*p-m,t[2]=m*p-d,t[6]=a*f,t[10]=M*p+u}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose($u,e,eh)}lookAt(e,t,i){let r=this.elements;return Qt.subVectors(e,t),Qt.lengthSq()===0&&(Qt.z=1),Qt.normalize(),Qi.crossVectors(i,Qt),Qi.lengthSq()===0&&(Math.abs(i.z)===1?Qt.x+=1e-4:Qt.z+=1e-4,Qt.normalize(),Qi.crossVectors(i,Qt)),Qi.normalize(),bo.crossVectors(Qt,Qi),r[0]=Qi.x,r[4]=bo.x,r[8]=Qt.x,r[1]=Qi.y,r[5]=bo.y,r[9]=Qt.y,r[2]=Qi.z,r[6]=bo.z,r[10]=Qt.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let i=e.elements,r=t.elements,o=this.elements,s=i[0],a=i[4],c=i[8],l=i[12],f=i[1],p=i[5],u=i[9],d=i[13],m=i[2],M=i[6],h=i[10],A=i[14],w=i[3],C=i[7],v=i[11],N=i[15],D=r[0],y=r[4],L=r[8],E=r[12],x=r[1],P=r[5],G=r[9],O=r[13],z=r[2],W=r[6],Q=r[10],J=r[14],F=r[3],ee=r[7],se=r[11],oe=r[15];return o[0]=s*D+a*x+c*z+l*F,o[4]=s*y+a*P+c*W+l*ee,o[8]=s*L+a*G+c*Q+l*se,o[12]=s*E+a*O+c*J+l*oe,o[1]=f*D+p*x+u*z+d*F,o[5]=f*y+p*P+u*W+d*ee,o[9]=f*L+p*G+u*Q+d*se,o[13]=f*E+p*O+u*J+d*oe,o[2]=m*D+M*x+h*z+A*F,o[6]=m*y+M*P+h*W+A*ee,o[10]=m*L+M*G+h*Q+A*se,o[14]=m*E+M*O+h*J+A*oe,o[3]=w*D+C*x+v*z+N*F,o[7]=w*y+C*P+v*W+N*ee,o[11]=w*L+C*G+v*Q+N*se,o[15]=w*E+C*O+v*J+N*oe,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],i=e[4],r=e[8],o=e[12],s=e[1],a=e[5],c=e[9],l=e[13],f=e[2],p=e[6],u=e[10],d=e[14],m=e[3],M=e[7],h=e[11],A=e[15];return m*(+o*c*p-r*l*p-o*a*u+i*l*u+r*a*d-i*c*d)+M*(+t*c*d-t*l*u+o*s*u-r*s*d+r*l*f-o*c*f)+h*(+t*l*p-t*a*d-o*s*p+i*s*d+o*a*f-i*l*f)+A*(-r*a*f-t*c*p+t*a*u+r*s*p-i*s*u+i*c*f)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,i){let r=this.elements;return e.isVector3?(r[12]=e.x,r[13]=e.y,r[14]=e.z):(r[12]=e,r[13]=t,r[14]=i),this}invert(){let e=this.elements,t=e[0],i=e[1],r=e[2],o=e[3],s=e[4],a=e[5],c=e[6],l=e[7],f=e[8],p=e[9],u=e[10],d=e[11],m=e[12],M=e[13],h=e[14],A=e[15],w=p*h*l-M*u*l+M*c*d-a*h*d-p*c*A+a*u*A,C=m*u*l-f*h*l-m*c*d+s*h*d+f*c*A-s*u*A,v=f*M*l-m*p*l+m*a*d-s*M*d-f*a*A+s*p*A,N=m*p*c-f*M*c-m*a*u+s*M*u+f*a*h-s*p*h,D=t*w+i*C+r*v+o*N;if(D===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let y=1/D;return e[0]=w*y,e[1]=(M*u*o-p*h*o-M*r*d+i*h*d+p*r*A-i*u*A)*y,e[2]=(a*h*o-M*c*o+M*r*l-i*h*l-a*r*A+i*c*A)*y,e[3]=(p*c*o-a*u*o-p*r*l+i*u*l+a*r*d-i*c*d)*y,e[4]=C*y,e[5]=(f*h*o-m*u*o+m*r*d-t*h*d-f*r*A+t*u*A)*y,e[6]=(m*c*o-s*h*o-m*r*l+t*h*l+s*r*A-t*c*A)*y,e[7]=(s*u*o-f*c*o+f*r*l-t*u*l-s*r*d+t*c*d)*y,e[8]=v*y,e[9]=(m*p*o-f*M*o-m*i*d+t*M*d+f*i*A-t*p*A)*y,e[10]=(s*M*o-m*a*o+m*i*l-t*M*l-s*i*A+t*a*A)*y,e[11]=(f*a*o-s*p*o-f*i*l+t*p*l+s*i*d-t*a*d)*y,e[12]=N*y,e[13]=(f*M*r-m*p*r+m*i*u-t*M*u-f*i*h+t*p*h)*y,e[14]=(m*a*r-s*M*r-m*i*c+t*M*c+s*i*h-t*a*h)*y,e[15]=(s*p*r-f*a*r+f*i*c-t*p*c-s*i*u+t*a*u)*y,this}scale(e){let t=this.elements,i=e.x,r=e.y,o=e.z;return t[0]*=i,t[4]*=r,t[8]*=o,t[1]*=i,t[5]*=r,t[9]*=o,t[2]*=i,t[6]*=r,t[10]*=o,t[3]*=i,t[7]*=r,t[11]*=o,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],i=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],r=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,i,r))}makeTranslation(e,t,i){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,i,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),i=Math.sin(e);return this.set(1,0,0,0,0,t,-i,0,0,i,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,0,i,0,0,1,0,0,-i,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,0,i,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let i=Math.cos(t),r=Math.sin(t),o=1-i,s=e.x,a=e.y,c=e.z,l=o*s,f=o*a;return this.set(l*s+i,l*a-r*c,l*c+r*a,0,l*a+r*c,f*a+i,f*c-r*s,0,l*c-r*a,f*c+r*s,o*c*c+i,0,0,0,0,1),this}makeScale(e,t,i){return this.set(e,0,0,0,0,t,0,0,0,0,i,0,0,0,0,1),this}makeShear(e,t,i,r,o,s){return this.set(1,i,o,0,e,1,s,0,t,r,1,0,0,0,0,1),this}compose(e,t,i){let r=this.elements,o=t._x,s=t._y,a=t._z,c=t._w,l=o+o,f=s+s,p=a+a,u=o*l,d=o*f,m=o*p,M=s*f,h=s*p,A=a*p,w=c*l,C=c*f,v=c*p,N=i.x,D=i.y,y=i.z;return r[0]=(1-(M+A))*N,r[1]=(d+v)*N,r[2]=(m-C)*N,r[3]=0,r[4]=(d-v)*D,r[5]=(1-(u+A))*D,r[6]=(h+w)*D,r[7]=0,r[8]=(m+C)*y,r[9]=(h-w)*y,r[10]=(1-(u+M))*y,r[11]=0,r[12]=e.x,r[13]=e.y,r[14]=e.z,r[15]=1,this}decompose(e,t,i){let r=this.elements,o=In.set(r[0],r[1],r[2]).length(),s=In.set(r[4],r[5],r[6]).length(),a=In.set(r[8],r[9],r[10]).length();this.determinant()<0&&(o=-o),e.x=r[12],e.y=r[13],e.z=r[14],ci.copy(this);let l=1/o,f=1/s,p=1/a;return ci.elements[0]*=l,ci.elements[1]*=l,ci.elements[2]*=l,ci.elements[4]*=f,ci.elements[5]*=f,ci.elements[6]*=f,ci.elements[8]*=p,ci.elements[9]*=p,ci.elements[10]*=p,t.setFromRotationMatrix(ci),i.x=o,i.y=s,i.z=a,this}makePerspective(e,t,i,r,o,s,a=bt){let c=this.elements,l=2*o/(t-e),f=2*o/(i-r),p=(t+e)/(t-e),u=(i+r)/(i-r),d,m;if(a===bt)d=-(s+o)/(s-o),m=-2*s*o/(s-o);else if(a===Ji)d=-s/(s-o),m=-s*o/(s-o);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return c[0]=l,c[4]=0,c[8]=p,c[12]=0,c[1]=0,c[5]=f,c[9]=u,c[13]=0,c[2]=0,c[6]=0,c[10]=d,c[14]=m,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,i,r,o,s,a=bt){let c=this.elements,l=1/(t-e),f=1/(i-r),p=1/(s-o),u=(t+e)*l,d=(i+r)*f,m,M;if(a===bt)m=(s+o)*p,M=-2*p;else if(a===Ji)m=o*p,M=-1*p;else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return c[0]=2*l,c[4]=0,c[8]=0,c[12]=-u,c[1]=0,c[5]=2*f,c[9]=0,c[13]=-d,c[2]=0,c[6]=0,c[10]=M,c[14]=-m,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){let t=this.elements,i=e.elements;for(let r=0;r<16;r++)if(t[r]!==i[r])return!1;return!0}fromArray(e,t=0){for(let i=0;i<16;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){let i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e[t+9]=i[9],e[t+10]=i[10],e[t+11]=i[11],e[t+12]=i[12],e[t+13]=i[13],e[t+14]=i[14],e[t+15]=i[15],e}},In=new R,ci=new We,$u=new R(0,0,0),eh=new R(1,1,1),Qi=new R,bo=new R,Qt=new R;var Cc=new We,Sc=new Ct,Ot=class n{constructor(e=0,t=0,i=0,r=n.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=i,this._order=r}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,i,r=this._order){return this._x=e,this._y=t,this._z=i,this._order=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,i=!0){let r=e.elements,o=r[0],s=r[4],a=r[8],c=r[1],l=r[5],f=r[9],p=r[2],u=r[6],d=r[10];switch(t){case"XYZ":this._y=Math.asin(ht(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-f,d),this._z=Math.atan2(-s,o)):(this._x=Math.atan2(u,l),this._z=0);break;case"YXZ":this._x=Math.asin(-ht(f,-1,1)),Math.abs(f)<.9999999?(this._y=Math.atan2(a,d),this._z=Math.atan2(c,l)):(this._y=Math.atan2(-p,o),this._z=0);break;case"ZXY":this._x=Math.asin(ht(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(-p,d),this._z=Math.atan2(-s,l)):(this._y=0,this._z=Math.atan2(c,o));break;case"ZYX":this._y=Math.asin(-ht(p,-1,1)),Math.abs(p)<.9999999?(this._x=Math.atan2(u,d),this._z=Math.atan2(c,o)):(this._x=0,this._z=Math.atan2(-s,l));break;case"YZX":this._z=Math.asin(ht(c,-1,1)),Math.abs(c)<.9999999?(this._x=Math.atan2(-f,l),this._y=Math.atan2(-p,o)):(this._x=0,this._y=Math.atan2(a,d));break;case"XZY":this._z=Math.asin(-ht(s,-1,1)),Math.abs(s)<.9999999?(this._x=Math.atan2(u,l),this._y=Math.atan2(a,o)):(this._x=Math.atan2(-f,d),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,i===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,i){return Cc.makeRotationFromQuaternion(e),this.setFromRotationMatrix(Cc,t,i)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return Sc.setFromEuler(this),this.setFromQuaternion(Sc,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};Ot.DEFAULT_ORDER="XYZ";var bn=class{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}};var th=0,Pc=new R,Rn=new Ct,Pi=new We,Ro=new R,Qr=new R,ih=new R,nh=new Ct,Dc=new R(1,0,0),yc=new R(0,1,0),Tc=new R(0,0,1),Bc={type:"added"},rh={type:"removed"},Ln={type:"childadded",child:null},Rs={type:"childremoved",child:null},lt=class n extends Rt{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:th++}),this.uuid=mi(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=n.DEFAULT_UP.clone();let e=new R,t=new Ot,i=new Ct,r=new R(1,1,1);function o(){i.setFromEuler(t,!1)}function s(){t.setFromQuaternion(i,void 0,!1)}t._onChange(o),i._onChange(s),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:i},scale:{configurable:!0,enumerable:!0,value:r},modelViewMatrix:{value:new We},normalMatrix:{value:new ye}}),this.matrix=new We,this.matrixWorld=new We,this.matrixAutoUpdate=n.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=n.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new bn,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return Rn.setFromAxisAngle(e,t),this.quaternion.multiply(Rn),this}rotateOnWorldAxis(e,t){return Rn.setFromAxisAngle(e,t),this.quaternion.premultiply(Rn),this}rotateX(e){return this.rotateOnAxis(Dc,e)}rotateY(e){return this.rotateOnAxis(yc,e)}rotateZ(e){return this.rotateOnAxis(Tc,e)}translateOnAxis(e,t){return Pc.copy(e).applyQuaternion(this.quaternion),this.position.add(Pc.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(Dc,e)}translateY(e){return this.translateOnAxis(yc,e)}translateZ(e){return this.translateOnAxis(Tc,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(Pi.copy(this.matrixWorld).invert())}lookAt(e,t,i){e.isVector3?Ro.copy(e):Ro.set(e,t,i);let r=this.parent;this.updateWorldMatrix(!0,!1),Qr.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Pi.lookAt(Qr,Ro,this.up):Pi.lookAt(Ro,Qr,this.up),this.quaternion.setFromRotationMatrix(Pi),r&&(Pi.extractRotation(r.matrixWorld),Rn.setFromRotationMatrix(Pi),this.quaternion.premultiply(Rn.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(Bc),Ln.child=e,this.dispatchEvent(Ln),Ln.child=null):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let i=0;i<arguments.length;i++)this.remove(arguments[i]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(rh),Rs.child=e,this.dispatchEvent(Rs),Rs.child=null),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),Pi.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),Pi.multiply(e.parent.matrixWorld)),e.applyMatrix4(Pi),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(Bc),Ln.child=e,this.dispatchEvent(Ln),Ln.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let i=0,r=this.children.length;i<r;i++){let s=this.children[i].getObjectByProperty(e,t);if(s!==void 0)return s}}getObjectsByProperty(e,t,i=[]){this[e]===t&&i.push(this);let r=this.children;for(let o=0,s=r.length;o<s;o++)r[o].getObjectsByProperty(e,t,i);return i}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Qr,e,ih),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Qr,nh,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);let t=this.children;for(let i=0,r=t.length;i<r;i++)t[i].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let i=0,r=t.length;i<r;i++)t[i].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let i=0,r=t.length;i<r;i++)t[i].updateMatrixWorld(e)}updateWorldMatrix(e,t){let i=this.parent;if(e===!0&&i!==null&&i.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),t===!0){let r=this.children;for(let o=0,s=r.length;o<s;o++)r[o].updateWorldMatrix(!1,!0)}}toJSON(e){let t=e===void 0||typeof e=="string",i={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},i.metadata={version:4.6,type:"Object",generator:"Object3D.toJSON"});let r={};r.uuid=this.uuid,r.type=this.type,this.name!==""&&(r.name=this.name),this.castShadow===!0&&(r.castShadow=!0),this.receiveShadow===!0&&(r.receiveShadow=!0),this.visible===!1&&(r.visible=!1),this.frustumCulled===!1&&(r.frustumCulled=!1),this.renderOrder!==0&&(r.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(r.userData=this.userData),r.layers=this.layers.mask,r.matrix=this.matrix.toArray(),r.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(r.matrixAutoUpdate=!1),this.isInstancedMesh&&(r.type="InstancedMesh",r.count=this.count,r.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(r.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(r.type="BatchedMesh",r.perObjectFrustumCulled=this.perObjectFrustumCulled,r.sortObjects=this.sortObjects,r.drawRanges=this._drawRanges,r.reservedRanges=this._reservedRanges,r.visibility=this._visibility,r.active=this._active,r.bounds=this._bounds.map(a=>({boxInitialized:a.boxInitialized,boxMin:a.box.min.toArray(),boxMax:a.box.max.toArray(),sphereInitialized:a.sphereInitialized,sphereRadius:a.sphere.radius,sphereCenter:a.sphere.center.toArray()})),r.maxInstanceCount=this._maxInstanceCount,r.maxVertexCount=this._maxVertexCount,r.maxIndexCount=this._maxIndexCount,r.geometryInitialized=this._geometryInitialized,r.geometryCount=this._geometryCount,r.matricesTexture=this._matricesTexture.toJSON(e),this._colorsTexture!==null&&(r.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(r.boundingSphere={center:r.boundingSphere.center.toArray(),radius:r.boundingSphere.radius}),this.boundingBox!==null&&(r.boundingBox={min:r.boundingBox.min.toArray(),max:r.boundingBox.max.toArray()}));function o(a,c){return a[c.uuid]===void 0&&(a[c.uuid]=c.toJSON(e)),c.uuid}if(this.isScene)this.background&&(this.background.isColor?r.background=this.background.toJSON():this.background.isTexture&&(r.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(r.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){r.geometry=o(e.geometries,this.geometry);let a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){let c=a.shapes;if(Array.isArray(c))for(let l=0,f=c.length;l<f;l++){let p=c[l];o(e.shapes,p)}else o(e.shapes,c)}}if(this.isSkinnedMesh&&(r.bindMode=this.bindMode,r.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(o(e.skeletons,this.skeleton),r.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let a=[];for(let c=0,l=this.material.length;c<l;c++)a.push(o(e.materials,this.material[c]));r.material=a}else r.material=o(e.materials,this.material);if(this.children.length>0){r.children=[];for(let a=0;a<this.children.length;a++)r.children.push(this.children[a].toJSON(e).object)}if(this.animations.length>0){r.animations=[];for(let a=0;a<this.animations.length;a++){let c=this.animations[a];r.animations.push(o(e.animations,c))}}if(t){let a=s(e.geometries),c=s(e.materials),l=s(e.textures),f=s(e.images),p=s(e.shapes),u=s(e.skeletons),d=s(e.animations),m=s(e.nodes);a.length>0&&(i.geometries=a),c.length>0&&(i.materials=c),l.length>0&&(i.textures=l),f.length>0&&(i.images=f),p.length>0&&(i.shapes=p),u.length>0&&(i.skeletons=u),d.length>0&&(i.animations=d),m.length>0&&(i.nodes=m)}return i.object=r,i;function s(a){let c=[];for(let l in a){let f=a[l];delete f.metadata,c.push(f)}return c}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let i=0;i<e.children.length;i++){let r=e.children[i];this.add(r.clone())}return this}};lt.DEFAULT_UP=new R(0,1,0);lt.DEFAULT_MATRIX_AUTO_UPDATE=!0;lt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var li=new R,Di=new R,Ls=new R,yi=new R,On=new R,Un=new R,Ic=new R,Os=new R,Us=new R,Ns=new R,Fs=new et,Qs=new et,Gs=new et,Gi=class n{constructor(e=new R,t=new R,i=new R){this.a=e,this.b=t,this.c=i}static getNormal(e,t,i,r){r.subVectors(i,t),li.subVectors(e,t),r.cross(li);let o=r.lengthSq();return o>0?r.multiplyScalar(1/Math.sqrt(o)):r.set(0,0,0)}static getBarycoord(e,t,i,r,o){li.subVectors(r,t),Di.subVectors(i,t),Ls.subVectors(e,t);let s=li.dot(li),a=li.dot(Di),c=li.dot(Ls),l=Di.dot(Di),f=Di.dot(Ls),p=s*l-a*a;if(p===0)return o.set(0,0,0),null;let u=1/p,d=(l*c-a*f)*u,m=(s*f-a*c)*u;return o.set(1-d-m,m,d)}static containsPoint(e,t,i,r){return this.getBarycoord(e,t,i,r,yi)===null?!1:yi.x>=0&&yi.y>=0&&yi.x+yi.y<=1}static getInterpolation(e,t,i,r,o,s,a,c){return this.getBarycoord(e,t,i,r,yi)===null?(c.x=0,c.y=0,"z"in c&&(c.z=0),"w"in c&&(c.w=0),null):(c.setScalar(0),c.addScaledVector(o,yi.x),c.addScaledVector(s,yi.y),c.addScaledVector(a,yi.z),c)}static getInterpolatedAttribute(e,t,i,r,o,s){return Fs.setScalar(0),Qs.setScalar(0),Gs.setScalar(0),Fs.fromBufferAttribute(e,t),Qs.fromBufferAttribute(e,i),Gs.fromBufferAttribute(e,r),s.setScalar(0),s.addScaledVector(Fs,o.x),s.addScaledVector(Qs,o.y),s.addScaledVector(Gs,o.z),s}static isFrontFacing(e,t,i,r){return li.subVectors(i,t),Di.subVectors(e,t),li.cross(Di).dot(r)<0}set(e,t,i){return this.a.copy(e),this.b.copy(t),this.c.copy(i),this}setFromPointsAndIndices(e,t,i,r){return this.a.copy(e[t]),this.b.copy(e[i]),this.c.copy(e[r]),this}setFromAttributeAndIndices(e,t,i,r){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,i),this.c.fromBufferAttribute(e,r),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return li.subVectors(this.c,this.b),Di.subVectors(this.a,this.b),li.cross(Di).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return n.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return n.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,i,r,o){return n.getInterpolation(e,this.a,this.b,this.c,t,i,r,o)}containsPoint(e){return n.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return n.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let i=this.a,r=this.b,o=this.c,s,a;On.subVectors(r,i),Un.subVectors(o,i),Os.subVectors(e,i);let c=On.dot(Os),l=Un.dot(Os);if(c<=0&&l<=0)return t.copy(i);Us.subVectors(e,r);let f=On.dot(Us),p=Un.dot(Us);if(f>=0&&p<=f)return t.copy(r);let u=c*p-f*l;if(u<=0&&c>=0&&f<=0)return s=c/(c-f),t.copy(i).addScaledVector(On,s);Ns.subVectors(e,o);let d=On.dot(Ns),m=Un.dot(Ns);if(m>=0&&d<=m)return t.copy(o);let M=d*l-c*m;if(M<=0&&l>=0&&m<=0)return a=l/(l-m),t.copy(i).addScaledVector(Un,a);let h=f*m-d*p;if(h<=0&&p-f>=0&&d-m>=0)return Ic.subVectors(o,r),a=(p-f)/(p-f+(d-m)),t.copy(r).addScaledVector(Ic,a);let A=1/(h+M+u);return s=M*A,a=u*A,t.copy(i).addScaledVector(On,s).addScaledVector(Un,a)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}};var bc={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Hi={h:0,s:0,l:0},Lo={h:0,s:0,l:0};function Hs(n,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?n+(e-n)*6*t:t<1/2?e:t<2/3?n+(e-n)*6*(2/3-t):n}var Ge=class{constructor(e,t,i){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,i)}set(e,t,i){if(t===void 0&&i===void 0){let r=e;r&&r.isColor?this.copy(r):typeof r=="number"?this.setHex(r):typeof r=="string"&&this.setStyle(r)}else this.setRGB(e,t,i);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=yt){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,Ne.toWorkingColorSpace(this,t),this}setRGB(e,t,i,r=Ne.workingColorSpace){return this.r=e,this.g=t,this.b=i,Ne.toWorkingColorSpace(this,r),this}setHSL(e,t,i,r=Ne.workingColorSpace){if(e=uc(e,1),t=ht(t,0,1),i=ht(i,0,1),t===0)this.r=this.g=this.b=i;else{let o=i<=.5?i*(1+t):i+t-i*t,s=2*i-o;this.r=Hs(s,o,e+1/3),this.g=Hs(s,o,e),this.b=Hs(s,o,e-1/3)}return Ne.toWorkingColorSpace(this,r),this}setStyle(e,t=yt){function i(o){o!==void 0&&parseFloat(o)<1&&console.warn("THREE.Color: Alpha component of "+e+" will be ignored.")}let r;if(r=/^(\w+)\(([^\)]*)\)/.exec(e)){let o,s=r[1],a=r[2];switch(s){case"rgb":case"rgba":if(o=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(o[4]),this.setRGB(Math.min(255,parseInt(o[1],10))/255,Math.min(255,parseInt(o[2],10))/255,Math.min(255,parseInt(o[3],10))/255,t);if(o=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(o[4]),this.setRGB(Math.min(100,parseInt(o[1],10))/100,Math.min(100,parseInt(o[2],10))/100,Math.min(100,parseInt(o[3],10))/100,t);break;case"hsl":case"hsla":if(o=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(o[4]),this.setHSL(parseFloat(o[1])/360,parseFloat(o[2])/100,parseFloat(o[3])/100,t);break;default:console.warn("THREE.Color: Unknown color model "+e)}}else if(r=/^\#([A-Fa-f\d]+)$/.exec(e)){let o=r[1],s=o.length;if(s===3)return this.setRGB(parseInt(o.charAt(0),16)/15,parseInt(o.charAt(1),16)/15,parseInt(o.charAt(2),16)/15,t);if(s===6)return this.setHex(parseInt(o,16),t);console.warn("THREE.Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=yt){let i=bc[e.toLowerCase()];return i!==void 0?this.setHex(i,t):console.warn("THREE.Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=oi(e.r),this.g=oi(e.g),this.b=oi(e.b),this}copyLinearToSRGB(e){return this.r=Zi(e.r),this.g=Zi(e.g),this.b=Zi(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=yt){return Ne.fromWorkingColorSpace(St.copy(this),e),Math.round(ht(St.r*255,0,255))*65536+Math.round(ht(St.g*255,0,255))*256+Math.round(ht(St.b*255,0,255))}getHexString(e=yt){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=Ne.workingColorSpace){Ne.fromWorkingColorSpace(St.copy(this),t);let i=St.r,r=St.g,o=St.b,s=Math.max(i,r,o),a=Math.min(i,r,o),c,l,f=(a+s)/2;if(a===s)c=0,l=0;else{let p=s-a;switch(l=f<=.5?p/(s+a):p/(2-s-a),s){case i:c=(r-o)/p+(r<o?6:0);break;case r:c=(o-i)/p+2;break;case o:c=(i-r)/p+4;break}c/=6}return e.h=c,e.s=l,e.l=f,e}getRGB(e,t=Ne.workingColorSpace){return Ne.fromWorkingColorSpace(St.copy(this),t),e.r=St.r,e.g=St.g,e.b=St.b,e}getStyle(e=yt){Ne.fromWorkingColorSpace(St.copy(this),e);let t=St.r,i=St.g,r=St.b;return e!==yt?`color(${e} ${t.toFixed(3)} ${i.toFixed(3)} ${r.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(i*255)},${Math.round(r*255)})`}offsetHSL(e,t,i){return this.getHSL(Hi),this.setHSL(Hi.h+e,Hi.s+t,Hi.l+i)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,i){return this.r=e.r+(t.r-e.r)*i,this.g=e.g+(t.g-e.g)*i,this.b=e.b+(t.b-e.b)*i,this}lerpHSL(e,t){this.getHSL(Hi),e.getHSL(Lo);let i=vo(Hi.h,Lo.h,t),r=vo(Hi.s,Lo.s,t),o=vo(Hi.l,Lo.l,t);return this.setHSL(i,r,o),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,i=this.g,r=this.b,o=e.elements;return this.r=o[0]*t+o[3]*i+o[6]*r,this.g=o[1]*t+o[4]*i+o[7]*r,this.b=o[2]*t+o[5]*i+o[8]*r,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},St=new Ge;Ge.NAMES=bc;var oh=0,gi=class extends Rt{static get type(){return"Material"}get type(){return this.constructor.type}set type(e){}constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:oh++}),this.uuid=mi(),this.name="",this.blending=xi,this.side=Nt,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=nr,this.blendDst=rr,this.blendEquation=vi,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Ge(0,0,0),this.blendAlpha=0,this.depthFunc=Li,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=Es,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Xi,this.stencilZFail=Xi,this.stencilZPass=Xi,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(let t in e){let i=e[t];if(i===void 0){console.warn(`THREE.Material: parameter '${t}' has value of undefined.`);continue}let r=this[t];if(r===void 0){console.warn(`THREE.Material: '${t}' is not a property of THREE.${this.type}.`);continue}r&&r.isColor?r.set(i):r&&r.isVector3&&i&&i.isVector3?r.copy(i):this[t]=i}}toJSON(e){let t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});let i={metadata:{version:4.6,type:"Material",generator:"Material.toJSON"}};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.color&&this.color.isColor&&(i.color=this.color.getHex()),this.roughness!==void 0&&(i.roughness=this.roughness),this.metalness!==void 0&&(i.metalness=this.metalness),this.sheen!==void 0&&(i.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(i.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(i.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(i.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(i.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(i.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(i.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(i.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(i.shininess=this.shininess),this.clearcoat!==void 0&&(i.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(i.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(i.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(i.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(i.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,i.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.dispersion!==void 0&&(i.dispersion=this.dispersion),this.iridescence!==void 0&&(i.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(i.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(i.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(i.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(i.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(i.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(i.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(i.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(i.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(i.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(i.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(i.lightMap=this.lightMap.toJSON(e).uuid,i.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(i.aoMap=this.aoMap.toJSON(e).uuid,i.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(i.bumpMap=this.bumpMap.toJSON(e).uuid,i.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(i.normalMap=this.normalMap.toJSON(e).uuid,i.normalMapType=this.normalMapType,i.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(i.displacementMap=this.displacementMap.toJSON(e).uuid,i.displacementScale=this.displacementScale,i.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(i.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(i.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(i.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(i.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(i.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(i.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(i.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(i.combine=this.combine)),this.envMapRotation!==void 0&&(i.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(i.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(i.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(i.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(i.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(i.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(i.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(i.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(i.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(i.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(i.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(i.size=this.size),this.shadowSide!==null&&(i.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(i.sizeAttenuation=this.sizeAttenuation),this.blending!==xi&&(i.blending=this.blending),this.side!==Nt&&(i.side=this.side),this.vertexColors===!0&&(i.vertexColors=!0),this.opacity<1&&(i.opacity=this.opacity),this.transparent===!0&&(i.transparent=!0),this.blendSrc!==nr&&(i.blendSrc=this.blendSrc),this.blendDst!==rr&&(i.blendDst=this.blendDst),this.blendEquation!==vi&&(i.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(i.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(i.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(i.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(i.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(i.blendAlpha=this.blendAlpha),this.depthFunc!==Li&&(i.depthFunc=this.depthFunc),this.depthTest===!1&&(i.depthTest=this.depthTest),this.depthWrite===!1&&(i.depthWrite=this.depthWrite),this.colorWrite===!1&&(i.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(i.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==Es&&(i.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(i.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(i.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Xi&&(i.stencilFail=this.stencilFail),this.stencilZFail!==Xi&&(i.stencilZFail=this.stencilZFail),this.stencilZPass!==Xi&&(i.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(i.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(i.rotation=this.rotation),this.polygonOffset===!0&&(i.polygonOffset=!0),this.polygonOffsetFactor!==0&&(i.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(i.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(i.linewidth=this.linewidth),this.dashSize!==void 0&&(i.dashSize=this.dashSize),this.gapSize!==void 0&&(i.gapSize=this.gapSize),this.scale!==void 0&&(i.scale=this.scale),this.dithering===!0&&(i.dithering=!0),this.alphaTest>0&&(i.alphaTest=this.alphaTest),this.alphaHash===!0&&(i.alphaHash=!0),this.alphaToCoverage===!0&&(i.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(i.premultipliedAlpha=!0),this.forceSinglePass===!0&&(i.forceSinglePass=!0),this.wireframe===!0&&(i.wireframe=!0),this.wireframeLinewidth>1&&(i.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(i.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(i.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(i.flatShading=!0),this.visible===!1&&(i.visible=!1),this.toneMapped===!1&&(i.toneMapped=!1),this.fog===!1&&(i.fog=!1),Object.keys(this.userData).length>0&&(i.userData=this.userData);function r(o){let s=[];for(let a in o){let c=o[a];delete c.metadata,s.push(c)}return s}if(t){let o=r(e.textures),s=r(e.images);o.length>0&&(i.textures=o),s.length>0&&(i.images=s)}return i}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,i=null;if(t!==null){let r=t.length;i=new Array(r);for(let o=0;o!==r;++o)i[o]=t[o].clone()}return this.clippingPlanes=i,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}onBuild(){console.warn("Material: onBuild() has been removed.")}};var Yt=class extends gi{static get type(){return"MeshBasicMaterial"}constructor(e){super(),this.isMeshBasicMaterial=!0,this.color=new Ge(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Ot,this.combine=ao,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}};var At=new R,Oo=new Qe,rt=class{constructor(e,t,i=!1){if(Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=i,this.usage=ws,this.updateRanges=[],this.gpuType=xt,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,i){e*=this.itemSize,i*=t.itemSize;for(let r=0,o=this.itemSize;r<o;r++)this.array[e+r]=t.array[i+r];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,i=this.count;t<i;t++)Oo.fromBufferAttribute(this,t),Oo.applyMatrix3(e),this.setXY(t,Oo.x,Oo.y);else if(this.itemSize===3)for(let t=0,i=this.count;t<i;t++)At.fromBufferAttribute(this,t),At.applyMatrix3(e),this.setXYZ(t,At.x,At.y,At.z);return this}applyMatrix4(e){for(let t=0,i=this.count;t<i;t++)At.fromBufferAttribute(this,t),At.applyMatrix4(e),this.setXYZ(t,At.x,At.y,At.z);return this}applyNormalMatrix(e){for(let t=0,i=this.count;t<i;t++)At.fromBufferAttribute(this,t),At.applyNormalMatrix(e),this.setXYZ(t,At.x,At.y,At.z);return this}transformDirection(e){for(let t=0,i=this.count;t<i;t++)At.fromBufferAttribute(this,t),At.transformDirection(e),this.setXYZ(t,At.x,At.y,At.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let i=this.array[e*this.itemSize+t];return this.normalized&&(i=wn(i,this.array)),i}setComponent(e,t,i){return this.normalized&&(i=Tt(i,this.array)),this.array[e*this.itemSize+t]=i,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=wn(t,this.array)),t}setX(e,t){return this.normalized&&(t=Tt(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=wn(t,this.array)),t}setY(e,t){return this.normalized&&(t=Tt(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=wn(t,this.array)),t}setZ(e,t){return this.normalized&&(t=Tt(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=wn(t,this.array)),t}setW(e,t){return this.normalized&&(t=Tt(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,i){return e*=this.itemSize,this.normalized&&(t=Tt(t,this.array),i=Tt(i,this.array)),this.array[e+0]=t,this.array[e+1]=i,this}setXYZ(e,t,i,r){return e*=this.itemSize,this.normalized&&(t=Tt(t,this.array),i=Tt(i,this.array),r=Tt(r,this.array)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=r,this}setXYZW(e,t,i,r,o){return e*=this.itemSize,this.normalized&&(t=Tt(t,this.array),i=Tt(i,this.array),r=Tt(r,this.array),o=Tt(o,this.array)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=r,this.array[e+3]=o,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==ws&&(e.usage=this.usage),e}};var Nn=class extends rt{constructor(e,t,i){super(new Uint16Array(e),t,i)}};var Fn=class extends rt{constructor(e,t,i){super(new Uint32Array(e),t,i)}};var Xt=class extends rt{constructor(e,t,i){super(new Float32Array(e),t,i)}};var sh=0,Jt=new We,ks=new lt,Qn=new R,Gt=new Wt,Gr=new Wt,gt=new R,Mt=class n extends Rt{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:sh++}),this.uuid=mi(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(Eo(e)?Fn:Nn)(e,1):this.index=e,this}setIndirect(e){return this.indirect=e,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,i=0){this.groups.push({start:e,count:t,materialIndex:i})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let i=this.attributes.normal;if(i!==void 0){let o=new ye().getNormalMatrix(e);i.applyNormalMatrix(o),i.needsUpdate=!0}let r=this.attributes.tangent;return r!==void 0&&(r.transformDirection(e),r.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(e){return Jt.makeRotationFromQuaternion(e),this.applyMatrix4(Jt),this}rotateX(e){return Jt.makeRotationX(e),this.applyMatrix4(Jt),this}rotateY(e){return Jt.makeRotationY(e),this.applyMatrix4(Jt),this}rotateZ(e){return Jt.makeRotationZ(e),this.applyMatrix4(Jt),this}translate(e,t,i){return Jt.makeTranslation(e,t,i),this.applyMatrix4(Jt),this}scale(e,t,i){return Jt.makeScale(e,t,i),this.applyMatrix4(Jt),this}lookAt(e){return ks.lookAt(e),ks.updateMatrix(),this.applyMatrix4(ks.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Qn).negate(),this.translate(Qn.x,Qn.y,Qn.z),this}setFromPoints(e){let t=this.getAttribute("position");if(t===void 0){let i=[];for(let r=0,o=e.length;r<o;r++){let s=e[r];i.push(s.x,s.y,s.z||0)}this.setAttribute("position",new Xt(i,3))}else{for(let i=0,r=t.count;i<r;i++){let o=e[i];t.setXYZ(i,o.x,o.y,o.z||0)}e.length>t.count&&console.warn("THREE.BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Wt);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new R(-1/0,-1/0,-1/0),new R(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let i=0,r=t.length;i<r;i++){let o=t[i];Gt.setFromBufferAttribute(o),this.morphTargetsRelative?(gt.addVectors(this.boundingBox.min,Gt.min),this.boundingBox.expandByPoint(gt),gt.addVectors(this.boundingBox.max,Gt.max),this.boundingBox.expandByPoint(gt)):(this.boundingBox.expandByPoint(Gt.min),this.boundingBox.expandByPoint(Gt.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new ai);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new R,1/0);return}if(e){let i=this.boundingSphere.center;if(Gt.setFromBufferAttribute(e),t)for(let o=0,s=t.length;o<s;o++){let a=t[o];Gr.setFromBufferAttribute(a),this.morphTargetsRelative?(gt.addVectors(Gt.min,Gr.min),Gt.expandByPoint(gt),gt.addVectors(Gt.max,Gr.max),Gt.expandByPoint(gt)):(Gt.expandByPoint(Gr.min),Gt.expandByPoint(Gr.max))}Gt.getCenter(i);let r=0;for(let o=0,s=e.count;o<s;o++)gt.fromBufferAttribute(e,o),r=Math.max(r,i.distanceToSquared(gt));if(t)for(let o=0,s=t.length;o<s;o++){let a=t[o],c=this.morphTargetsRelative;for(let l=0,f=a.count;l<f;l++)gt.fromBufferAttribute(a,l),c&&(Qn.fromBufferAttribute(e,l),gt.add(Qn)),r=Math.max(r,i.distanceToSquared(gt))}this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let i=t.position,r=t.normal,o=t.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new rt(new Float32Array(4*i.count),4));let s=this.getAttribute("tangent"),a=[],c=[];for(let L=0;L<i.count;L++)a[L]=new R,c[L]=new R;let l=new R,f=new R,p=new R,u=new Qe,d=new Qe,m=new Qe,M=new R,h=new R;function A(L,E,x){l.fromBufferAttribute(i,L),f.fromBufferAttribute(i,E),p.fromBufferAttribute(i,x),u.fromBufferAttribute(o,L),d.fromBufferAttribute(o,E),m.fromBufferAttribute(o,x),f.sub(l),p.sub(l),d.sub(u),m.sub(u);let P=1/(d.x*m.y-m.x*d.y);isFinite(P)&&(M.copy(f).multiplyScalar(m.y).addScaledVector(p,-d.y).multiplyScalar(P),h.copy(p).multiplyScalar(d.x).addScaledVector(f,-m.x).multiplyScalar(P),a[L].add(M),a[E].add(M),a[x].add(M),c[L].add(h),c[E].add(h),c[x].add(h))}let w=this.groups;w.length===0&&(w=[{start:0,count:e.count}]);for(let L=0,E=w.length;L<E;++L){let x=w[L],P=x.start,G=x.count;for(let O=P,z=P+G;O<z;O+=3)A(e.getX(O+0),e.getX(O+1),e.getX(O+2))}let C=new R,v=new R,N=new R,D=new R;function y(L){N.fromBufferAttribute(r,L),D.copy(N);let E=a[L];C.copy(E),C.sub(N.multiplyScalar(N.dot(E))).normalize(),v.crossVectors(D,E);let P=v.dot(c[L])<0?-1:1;s.setXYZW(L,C.x,C.y,C.z,P)}for(let L=0,E=w.length;L<E;++L){let x=w[L],P=x.start,G=x.count;for(let O=P,z=P+G;O<z;O+=3)y(e.getX(O+0)),y(e.getX(O+1)),y(e.getX(O+2))}}computeVertexNormals(){let e=this.index,t=this.getAttribute("position");if(t!==void 0){let i=this.getAttribute("normal");if(i===void 0)i=new rt(new Float32Array(t.count*3),3),this.setAttribute("normal",i);else for(let u=0,d=i.count;u<d;u++)i.setXYZ(u,0,0,0);let r=new R,o=new R,s=new R,a=new R,c=new R,l=new R,f=new R,p=new R;if(e)for(let u=0,d=e.count;u<d;u+=3){let m=e.getX(u+0),M=e.getX(u+1),h=e.getX(u+2);r.fromBufferAttribute(t,m),o.fromBufferAttribute(t,M),s.fromBufferAttribute(t,h),f.subVectors(s,o),p.subVectors(r,o),f.cross(p),a.fromBufferAttribute(i,m),c.fromBufferAttribute(i,M),l.fromBufferAttribute(i,h),a.add(f),c.add(f),l.add(f),i.setXYZ(m,a.x,a.y,a.z),i.setXYZ(M,c.x,c.y,c.z),i.setXYZ(h,l.x,l.y,l.z)}else for(let u=0,d=t.count;u<d;u+=3)r.fromBufferAttribute(t,u+0),o.fromBufferAttribute(t,u+1),s.fromBufferAttribute(t,u+2),f.subVectors(s,o),p.subVectors(r,o),f.cross(p),i.setXYZ(u+0,f.x,f.y,f.z),i.setXYZ(u+1,f.x,f.y,f.z),i.setXYZ(u+2,f.x,f.y,f.z);this.normalizeNormals(),i.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,i=e.count;t<i;t++)gt.fromBufferAttribute(e,t),gt.normalize(),e.setXYZ(t,gt.x,gt.y,gt.z)}toNonIndexed(){function e(a,c){let l=a.array,f=a.itemSize,p=a.normalized,u=new l.constructor(c.length*f),d=0,m=0;for(let M=0,h=c.length;M<h;M++){a.isInterleavedBufferAttribute?d=c[M]*a.data.stride+a.offset:d=c[M]*f;for(let A=0;A<f;A++)u[m++]=l[d++]}return new rt(u,f,p)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let t=new n,i=this.index.array,r=this.attributes;for(let a in r){let c=r[a],l=e(c,i);t.setAttribute(a,l)}let o=this.morphAttributes;for(let a in o){let c=[],l=o[a];for(let f=0,p=l.length;f<p;f++){let u=l[f],d=e(u,i);c.push(d)}t.morphAttributes[a]=c}t.morphTargetsRelative=this.morphTargetsRelative;let s=this.groups;for(let a=0,c=s.length;a<c;a++){let l=s[a];t.addGroup(l.start,l.count,l.materialIndex)}return t}toJSON(){let e={metadata:{version:4.6,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0){let c=this.parameters;for(let l in c)c[l]!==void 0&&(e[l]=c[l]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let i=this.attributes;for(let c in i){let l=i[c];e.data.attributes[c]=l.toJSON(e.data)}let r={},o=!1;for(let c in this.morphAttributes){let l=this.morphAttributes[c],f=[];for(let p=0,u=l.length;p<u;p++){let d=l[p];f.push(d.toJSON(e.data))}f.length>0&&(r[c]=f,o=!0)}o&&(e.data.morphAttributes=r,e.data.morphTargetsRelative=this.morphTargetsRelative);let s=this.groups;s.length>0&&(e.data.groups=JSON.parse(JSON.stringify(s)));let a=this.boundingSphere;return a!==null&&(e.data.boundingSphere={center:a.center.toArray(),radius:a.radius}),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let i=e.index;i!==null&&this.setIndex(i.clone(t));let r=e.attributes;for(let l in r){let f=r[l];this.setAttribute(l,f.clone(t))}let o=e.morphAttributes;for(let l in o){let f=[],p=o[l];for(let u=0,d=p.length;u<d;u++)f.push(p[u].clone(t));this.morphAttributes[l]=f}this.morphTargetsRelative=e.morphTargetsRelative;let s=e.groups;for(let l=0,f=s.length;l<f;l++){let p=s[l];this.addGroup(p.start,p.count,p.materialIndex)}let a=e.boundingBox;a!==null&&(this.boundingBox=a.clone());let c=e.boundingSphere;return c!==null&&(this.boundingSphere=c.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}};var Rc=new We,en=new Io,Uo=new ai,Lc=new R,No=new R,Fo=new R,Qo=new R,zs=new R,Go=new R,Oc=new R,Ho=new R,ct=class extends lt{constructor(e=new Mt,t=new Yt){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){let r=t[i[0]];if(r!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let o=0,s=r.length;o<s;o++){let a=r[o].name||String(o);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=o}}}}getVertexPosition(e,t){let i=this.geometry,r=i.attributes.position,o=i.morphAttributes.position,s=i.morphTargetsRelative;t.fromBufferAttribute(r,e);let a=this.morphTargetInfluences;if(o&&a){Go.set(0,0,0);for(let c=0,l=o.length;c<l;c++){let f=a[c],p=o[c];f!==0&&(zs.fromBufferAttribute(p,e),s?Go.addScaledVector(zs,f):Go.addScaledVector(zs.sub(t),f))}t.add(Go)}return t}raycast(e,t){let i=this.geometry,r=this.material,o=this.matrixWorld;r!==void 0&&(i.boundingSphere===null&&i.computeBoundingSphere(),Uo.copy(i.boundingSphere),Uo.applyMatrix4(o),en.copy(e.ray).recast(e.near),!(Uo.containsPoint(en.origin)===!1&&(en.intersectSphere(Uo,Lc)===null||en.origin.distanceToSquared(Lc)>(e.far-e.near)**2))&&(Rc.copy(o).invert(),en.copy(e.ray).applyMatrix4(Rc),!(i.boundingBox!==null&&en.intersectsBox(i.boundingBox)===!1)&&this._computeIntersections(e,t,en)))}_computeIntersections(e,t,i){let r,o=this.geometry,s=this.material,a=o.index,c=o.attributes.position,l=o.attributes.uv,f=o.attributes.uv1,p=o.attributes.normal,u=o.groups,d=o.drawRange;if(a!==null)if(Array.isArray(s))for(let m=0,M=u.length;m<M;m++){let h=u[m],A=s[h.materialIndex],w=Math.max(h.start,d.start),C=Math.min(a.count,Math.min(h.start+h.count,d.start+d.count));for(let v=w,N=C;v<N;v+=3){let D=a.getX(v),y=a.getX(v+1),L=a.getX(v+2);r=ko(this,A,e,i,l,f,p,D,y,L),r&&(r.faceIndex=Math.floor(v/3),r.face.materialIndex=h.materialIndex,t.push(r))}}else{let m=Math.max(0,d.start),M=Math.min(a.count,d.start+d.count);for(let h=m,A=M;h<A;h+=3){let w=a.getX(h),C=a.getX(h+1),v=a.getX(h+2);r=ko(this,s,e,i,l,f,p,w,C,v),r&&(r.faceIndex=Math.floor(h/3),t.push(r))}}else if(c!==void 0)if(Array.isArray(s))for(let m=0,M=u.length;m<M;m++){let h=u[m],A=s[h.materialIndex],w=Math.max(h.start,d.start),C=Math.min(c.count,Math.min(h.start+h.count,d.start+d.count));for(let v=w,N=C;v<N;v+=3){let D=v,y=v+1,L=v+2;r=ko(this,A,e,i,l,f,p,D,y,L),r&&(r.faceIndex=Math.floor(v/3),r.face.materialIndex=h.materialIndex,t.push(r))}}else{let m=Math.max(0,d.start),M=Math.min(c.count,d.start+d.count);for(let h=m,A=M;h<A;h+=3){let w=h,C=h+1,v=h+2;r=ko(this,s,e,i,l,f,p,w,C,v),r&&(r.faceIndex=Math.floor(h/3),t.push(r))}}}};function ah(n,e,t,i,r,o,s,a){let c;if(e.side===ot?c=i.intersectTriangle(s,o,r,!0,a):c=i.intersectTriangle(r,o,s,e.side===Nt,a),c===null)return null;Ho.copy(a),Ho.applyMatrix4(n.matrixWorld);let l=t.ray.origin.distanceTo(Ho);return l<t.near||l>t.far?null:{distance:l,point:Ho.clone(),object:n}}function ko(n,e,t,i,r,o,s,a,c,l){n.getVertexPosition(a,No),n.getVertexPosition(c,Fo),n.getVertexPosition(l,Qo);let f=ah(n,e,t,i,No,Fo,Qo,Oc);if(f){let p=new R;Gi.getBarycoord(Oc,No,Fo,Qo,p),r&&(f.uv=Gi.getInterpolatedAttribute(r,a,c,l,p,new Qe)),o&&(f.uv1=Gi.getInterpolatedAttribute(o,a,c,l,p,new Qe)),s&&(f.normal=Gi.getInterpolatedAttribute(s,a,c,l,p,new R),f.normal.dot(i.direction)>0&&f.normal.multiplyScalar(-1));let u={a,b:c,c:l,normal:new R,materialIndex:0};Gi.getNormal(No,Fo,Qo,u.normal),f.face=u,f.barycoord=p}return f}var ki=class n extends Mt{constructor(e=1,t=1,i=1,r=1,o=1,s=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:i,widthSegments:r,heightSegments:o,depthSegments:s};let a=this;r=Math.floor(r),o=Math.floor(o),s=Math.floor(s);let c=[],l=[],f=[],p=[],u=0,d=0;m("z","y","x",-1,-1,i,t,e,s,o,0),m("z","y","x",1,-1,i,t,-e,s,o,1),m("x","z","y",1,1,e,i,t,r,s,2),m("x","z","y",1,-1,e,i,-t,r,s,3),m("x","y","z",1,-1,e,t,i,r,o,4),m("x","y","z",-1,-1,e,t,-i,r,o,5),this.setIndex(c),this.setAttribute("position",new Xt(l,3)),this.setAttribute("normal",new Xt(f,3)),this.setAttribute("uv",new Xt(p,2));function m(M,h,A,w,C,v,N,D,y,L,E){let x=v/y,P=N/L,G=v/2,O=N/2,z=D/2,W=y+1,Q=L+1,J=0,F=0,ee=new R;for(let se=0;se<Q;se++){let oe=se*P-O;for(let me=0;me<W;me++){let Be=me*x-G;ee[M]=Be*w,ee[h]=oe*C,ee[A]=z,l.push(ee.x,ee.y,ee.z),ee[M]=0,ee[h]=0,ee[A]=D>0?1:-1,f.push(ee.x,ee.y,ee.z),p.push(me/y),p.push(1-se/L),J+=1}}for(let se=0;se<L;se++)for(let oe=0;oe<y;oe++){let me=u+oe+W*se,Be=u+oe+W*(se+1),V=u+(oe+1)+W*(se+1),j=u+(oe+1)+W*se;c.push(me,Be,j),c.push(Be,V,j),F+=6}a.addGroup(d,F,E),d+=F,u+=J}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new n(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}};function Ti(n){let e={};for(let t in n){e[t]={};for(let i in n[t]){let r=n[t][i];r&&(r.isColor||r.isMatrix3||r.isMatrix4||r.isVector2||r.isVector3||r.isVector4||r.isTexture||r.isQuaternion)?r.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][i]=null):e[t][i]=r.clone():Array.isArray(r)?e[t][i]=r.slice():e[t][i]=r}}return e}function Pt(n){let e={};for(let t=0;t<n.length;t++){let i=Ti(n[t]);for(let r in i)e[r]=i[r]}return e}function Uc(n){let e=[];for(let t=0;t<n.length;t++)e.push(n[t].clone());return e}function zo(n){let e=n.getRenderTarget();return e===null?n.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:Ne.workingColorSpace}var Nc={clone:Ti,merge:Pt};var Fc=`
void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`;var Qc=`
void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}
`;var Bt=class extends gi{static get type(){return"ShaderMaterial"}constructor(e){super(),this.isShaderMaterial=!0,this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Fc,this.fragmentShader=Qc,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Ti(e.uniforms),this.uniformsGroups=Uc(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let r in this.uniforms){let s=this.uniforms[r].value;s&&s.isTexture?t.uniforms[r]={type:"t",value:s.toJSON(e).uuid}:s&&s.isColor?t.uniforms[r]={type:"c",value:s.getHex()}:s&&s.isVector2?t.uniforms[r]={type:"v2",value:s.toArray()}:s&&s.isVector3?t.uniforms[r]={type:"v3",value:s.toArray()}:s&&s.isVector4?t.uniforms[r]={type:"v4",value:s.toArray()}:s&&s.isMatrix3?t.uniforms[r]={type:"m3",value:s.toArray()}:s&&s.isMatrix4?t.uniforms[r]={type:"m4",value:s.toArray()}:t.uniforms[r]={value:s}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let i={};for(let r in this.extensions)this.extensions[r]===!0&&(i[r]=!0);return Object.keys(i).length>0&&(t.extensions=i),t}};var Bi=class extends lt{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new We,this.projectionMatrix=new We,this.projectionMatrixInverse=new We,this.coordinateSystem=bt}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(e,t){super.updateWorldMatrix(e,t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}};var zi=new R,Gc=new Qe,Hc=new Qe,ft=class extends Bi{constructor(e=50,t=1,i=.1,r=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=i,this.far=r,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=Ur*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(xo*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return Ur*2*Math.atan(Math.tan(xo*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,i){zi.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(zi.x,zi.y).multiplyScalar(-e/zi.z),zi.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),i.set(zi.x,zi.y).multiplyScalar(-e/zi.z)}getViewSize(e,t){return this.getViewBounds(e,Gc,Hc),t.subVectors(Hc,Gc)}setViewOffset(e,t,i,r,o,s){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=r,this.view.width=o,this.view.height=s,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(xo*.5*this.fov)/this.zoom,i=2*t,r=this.aspect*i,o=-.5*r,s=this.view;if(this.view!==null&&this.view.enabled){let c=s.fullWidth,l=s.fullHeight;o+=s.offsetX*r/c,t-=s.offsetY*i/l,r*=s.width/c,i*=s.height/l}let a=this.filmOffset;a!==0&&(o+=e*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(o,o+r,t,t-i,e,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}};var Gn=-90,Hn=1,Vo=class extends lt{constructor(e,t,i){super(),this.type="CubeCamera",this.renderTarget=i,this.coordinateSystem=null,this.activeMipmapLevel=0;let r=new ft(Gn,Hn,e,t);r.layers=this.layers,this.add(r);let o=new ft(Gn,Hn,e,t);o.layers=this.layers,this.add(o);let s=new ft(Gn,Hn,e,t);s.layers=this.layers,this.add(s);let a=new ft(Gn,Hn,e,t);a.layers=this.layers,this.add(a);let c=new ft(Gn,Hn,e,t);c.layers=this.layers,this.add(c);let l=new ft(Gn,Hn,e,t);l.layers=this.layers,this.add(l)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[i,r,o,s,a,c]=t;for(let l of t)this.remove(l);if(e===bt)i.up.set(0,1,0),i.lookAt(1,0,0),r.up.set(0,1,0),r.lookAt(-1,0,0),o.up.set(0,0,-1),o.lookAt(0,1,0),s.up.set(0,0,1),s.lookAt(0,-1,0),a.up.set(0,1,0),a.lookAt(0,0,1),c.up.set(0,1,0),c.lookAt(0,0,-1);else if(e===Ji)i.up.set(0,-1,0),i.lookAt(-1,0,0),r.up.set(0,-1,0),r.lookAt(1,0,0),o.up.set(0,0,1),o.lookAt(0,1,0),s.up.set(0,0,-1),s.lookAt(0,-1,0),a.up.set(0,-1,0),a.lookAt(0,0,1),c.up.set(0,-1,0),c.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(let l of t)this.add(l),l.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();let{renderTarget:i,activeMipmapLevel:r}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());let[o,s,a,c,l,f]=this.children,p=e.getRenderTarget(),u=e.getActiveCubeFace(),d=e.getActiveMipmapLevel(),m=e.xr.enabled;e.xr.enabled=!1;let M=i.texture.generateMipmaps;i.texture.generateMipmaps=!1,e.setRenderTarget(i,0,r),e.render(t,o),e.setRenderTarget(i,1,r),e.render(t,s),e.setRenderTarget(i,2,r),e.render(t,a),e.setRenderTarget(i,3,r),e.render(t,c),e.setRenderTarget(i,4,r),e.render(t,l),i.texture.generateMipmaps=M,e.setRenderTarget(i,5,r),e.render(t,f),e.setRenderTarget(p,u,d),e.xr.enabled=m,i.texture.needsPMREMUpdate=!0}};var kn=class extends st{constructor(e,t,i,r,o,s,a,c,l,f){e=e!==void 0?e:[],t=t!==void 0?t:ei,super(e,t,i,r,o,s,a,c,l,f),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}};var Ko=class extends Lt{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let i={width:e,height:e,depth:1},r=[i,i,i,i,i,i];this.texture=new kn(r,t.mapping,t.wrapS,t.wrapT,t.magFilter,t.minFilter,t.format,t.type,t.anisotropy,t.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.generateMipmaps=t.generateMipmaps!==void 0?t.generateMipmaps:!1,this.texture.minFilter=t.minFilter!==void 0?t.minFilter:Dt}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let i={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},r=new ki(5,5,5),o=new Bt({name:"CubemapFromEquirect",uniforms:Ti(i.uniforms),vertexShader:i.vertexShader,fragmentShader:i.fragmentShader,side:ot,blending:zt});o.uniforms.tEquirect.value=t;let s=new ct(r,o),a=t.minFilter;return t.minFilter===ii&&(t.minFilter=Dt),new Vo(1,10,this).update(e,s),t.minFilter=a,s.geometry.dispose(),s.material.dispose(),this}clear(e,t,i,r){let o=e.getRenderTarget();for(let s=0;s<6;s++)e.setRenderTarget(this,s),e.clear(t,i,r);e.setRenderTarget(o)}};var Vs=new R,ch=new R,lh=new ye,Ai=class{constructor(e=new R(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,i,r){return this.normal.set(e,t,i),this.constant=r,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,i){let r=Vs.subVectors(i,t).cross(ch.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(r,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t){let i=e.delta(Vs),r=this.normal.dot(i);if(r===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let o=-(e.start.dot(this.normal)+this.constant)/r;return o<0||o>1?null:t.copy(e.start).addScaledVector(i,o)}intersectsLine(e){let t=this.distanceToPoint(e.start),i=this.distanceToPoint(e.end);return t<0&&i>0||i<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let i=t||lh.getNormalMatrix(e),r=this.coplanarPoint(Vs).applyMatrix4(e),o=this.normal.applyMatrix3(i).normalize();return this.constant=-r.dot(o),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}};var tn=new ai,Wo=new R,zn=class{constructor(e=new Ai,t=new Ai,i=new Ai,r=new Ai,o=new Ai,s=new Ai){this.planes=[e,t,i,r,o,s]}set(e,t,i,r,o,s){let a=this.planes;return a[0].copy(e),a[1].copy(t),a[2].copy(i),a[3].copy(r),a[4].copy(o),a[5].copy(s),this}copy(e){let t=this.planes;for(let i=0;i<6;i++)t[i].copy(e.planes[i]);return this}setFromProjectionMatrix(e,t=bt){let i=this.planes,r=e.elements,o=r[0],s=r[1],a=r[2],c=r[3],l=r[4],f=r[5],p=r[6],u=r[7],d=r[8],m=r[9],M=r[10],h=r[11],A=r[12],w=r[13],C=r[14],v=r[15];if(i[0].setComponents(c-o,u-l,h-d,v-A).normalize(),i[1].setComponents(c+o,u+l,h+d,v+A).normalize(),i[2].setComponents(c+s,u+f,h+m,v+w).normalize(),i[3].setComponents(c-s,u-f,h-m,v-w).normalize(),i[4].setComponents(c-a,u-p,h-M,v-C).normalize(),t===bt)i[5].setComponents(c+a,u+p,h+M,v+C).normalize();else if(t===Ji)i[5].setComponents(a,p,M,C).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),tn.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{let t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),tn.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(tn)}intersectsSprite(e){return tn.center.set(0,0,0),tn.radius=.7071067811865476,tn.applyMatrix4(e.matrixWorld),this.intersectsSphere(tn)}intersectsSphere(e){let t=this.planes,i=e.center,r=-e.radius;for(let o=0;o<6;o++)if(t[o].distanceToPoint(i)<r)return!1;return!0}intersectsBox(e){let t=this.planes;for(let i=0;i<6;i++){let r=t[i];if(Wo.x=r.normal.x>0?e.max.x:e.min.x,Wo.y=r.normal.y>0?e.max.y:e.min.y,Wo.z=r.normal.z>0?e.max.z:e.min.z,r.distanceToPoint(Wo)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let i=0;i<6;i++)if(t[i].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};function Yo(){let n=null,e=!1,t=null,i=null;function r(o,s){t(o,s),i=n.requestAnimationFrame(r)}return{start:function(){e!==!0&&t!==null&&(i=n.requestAnimationFrame(r),e=!0)},stop:function(){n.cancelAnimationFrame(i),e=!1},setAnimationLoop:function(o){t=o},setContext:function(o){n=o}}}function kc(n){let e=new WeakMap;function t(a,c){let l=a.array,f=a.usage,p=l.byteLength,u=n.createBuffer();n.bindBuffer(c,u),n.bufferData(c,l,f),a.onUploadCallback();let d;if(l instanceof Float32Array)d=n.FLOAT;else if(l instanceof Uint16Array)a.isFloat16BufferAttribute?d=n.HALF_FLOAT:d=n.UNSIGNED_SHORT;else if(l instanceof Int16Array)d=n.SHORT;else if(l instanceof Uint32Array)d=n.UNSIGNED_INT;else if(l instanceof Int32Array)d=n.INT;else if(l instanceof Int8Array)d=n.BYTE;else if(l instanceof Uint8Array)d=n.UNSIGNED_BYTE;else if(l instanceof Uint8ClampedArray)d=n.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+l);return{buffer:u,type:d,bytesPerElement:l.BYTES_PER_ELEMENT,version:a.version,size:p}}function i(a,c,l){let f=c.array,p=c.updateRanges;if(n.bindBuffer(l,a),p.length===0)n.bufferSubData(l,0,f);else{p.sort((d,m)=>d.start-m.start);let u=0;for(let d=1;d<p.length;d++){let m=p[u],M=p[d];M.start<=m.start+m.count+1?m.count=Math.max(m.count,M.start+M.count-m.start):(++u,p[u]=M)}p.length=u+1;for(let d=0,m=p.length;d<m;d++){let M=p[d];n.bufferSubData(l,M.start*f.BYTES_PER_ELEMENT,f,M.start,M.count)}c.clearUpdateRanges()}c.onUploadCallback()}function r(a){return a.isInterleavedBufferAttribute&&(a=a.data),e.get(a)}function o(a){a.isInterleavedBufferAttribute&&(a=a.data);let c=e.get(a);c&&(n.deleteBuffer(c.buffer),e.delete(a))}function s(a,c){if(a.isInterleavedBufferAttribute&&(a=a.data),a.isGLBufferAttribute){let f=e.get(a);(!f||f.version<a.version)&&e.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}let l=e.get(a);if(l===void 0)e.set(a,t(a,c));else if(l.version<a.version){if(l.size!==a.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(l.buffer,a,c),l.version=a.version}}return{get:r,remove:o,update:s}}var Vi=class n extends Mt{constructor(e=1,t=1,i=1,r=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:i,heightSegments:r};let o=e/2,s=t/2,a=Math.floor(i),c=Math.floor(r),l=a+1,f=c+1,p=e/a,u=t/c,d=[],m=[],M=[],h=[];for(let A=0;A<f;A++){let w=A*u-s;for(let C=0;C<l;C++){let v=C*p-o;m.push(v,-w,0),M.push(0,0,1),h.push(C/a),h.push(1-A/c)}}for(let A=0;A<c;A++)for(let w=0;w<a;w++){let C=w+l*A,v=w+l*(A+1),N=w+1+l*(A+1),D=w+1+l*A;d.push(C,v,D),d.push(v,N,D)}this.setIndex(d),this.setAttribute("position",new Xt(m,3)),this.setAttribute("normal",new Xt(M,3)),this.setAttribute("uv",new Xt(h,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new n(e.width,e.height,e.widthSegments,e.heightSegments)}};var zc=`
#ifdef USE_ALPHAHASH

	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;

#endif
`;var Vc=`
#ifdef USE_ALPHAHASH

	/**
	 * See: https://casual-effects.com/research/Wyman2017Hashed/index.html
	 */

	const float ALPHA_HASH_SCALE = 0.05; // Derived from trials only, and may be changed.

	float hash2D( vec2 value ) {

		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );

	}

	float hash3D( vec3 value ) {

		return hash2D( vec2( hash2D( value.xy ), value.z ) );

	}

	float getAlphaHashThreshold( vec3 position ) {

		// Find the discretized derivatives of our coordinates
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );

		// Find two nearest log-discretized noise scales
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);

		// Compute alpha thresholds at our two noise scales
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);

		// Factor to interpolate lerp with
		float lerpFactor = fract( log2( pixScale ) );

		// Interpolate alpha threshold from noise at two scales
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;

		// Pass into CDF to compute uniformly distrib threshold
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);

		// Find our final, uniformly distributed alpha threshold (\u03B1\u03C4)
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;

		// Avoids \u03B1\u03C4 == 0. Could also do \u03B1\u03C4 =1-\u03B1\u03C4
		return clamp( threshold , 1.0e-6, 1.0 );

	}

#endif
`;var Kc=`
#ifdef USE_ALPHAMAP

	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;

#endif
`;var Wc=`
#ifdef USE_ALPHAMAP

	uniform sampler2D alphaMap;

#endif
`;var Yc=`
#ifdef USE_ALPHATEST

	#ifdef ALPHA_TO_COVERAGE

	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;

	#else

	if ( diffuseColor.a < alphaTest ) discard;

	#endif

#endif
`;var Xc=`
#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif
`;var Jc=`
#ifdef USE_AOMAP

	// reads channel R, compatible with a combined OcclusionRoughnessMetallic (RGB) texture
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;

	reflectedLight.indirectDiffuse *= ambientOcclusion;

	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif

	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif

	#if defined( USE_ENVMAP ) && defined( STANDARD )

		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );

		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );

	#endif

#endif
`;var qc=`
#ifdef USE_AOMAP

	uniform sampler2D aoMap;
	uniform float aoMapIntensity;

#endif
`;var Zc=`
#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif

	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {

		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );

	}

	float getIndirectIndex( const in int i ) {

		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );

	}

#endif

#ifdef USE_BATCHING_COLOR

	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {

		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;

	}

#endif
`;var jc=`
#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif
`;var $c=`
vec3 transformed = vec3( position );

#ifdef USE_ALPHAHASH

	vPosition = vec3( position );

#endif
`;var el=`
vec3 objectNormal = vec3( normal );

#ifdef USE_TANGENT

	vec3 objectTangent = vec3( tangent.xyz );

#endif
`;var tl=`

float G_BlinnPhong_Implicit( /* const in float dotNL, const in float dotNV */ ) {

	// geometry term is (n dot l)(n dot v) / 4(n dot l)(n dot v)
	return 0.25;

}

float D_BlinnPhong( const in float shininess, const in float dotNH ) {

	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );

}

vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {

	vec3 halfDir = normalize( lightDir + viewDir );

	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );

	vec3 F = F_Schlick( specularColor, 1.0, dotVH );

	float G = G_BlinnPhong_Implicit( /* dotNL, dotNV */ );

	float D = D_BlinnPhong( shininess, dotNH );

	return F * ( G * D );

} // validated

`;var il=`

#ifdef USE_IRIDESCENCE

	// XYZ to linear-sRGB color space
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);

	// Assume air interface for top
	// Note: We don't handle the case fresnel0 == 1
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {

		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );

	}

	// Conversion FO/IOR
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {

		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );

	}

	// ior is a value between 1.0 and 3.0. 1.0 is air interface
	float IorToFresnel0( float transmittedIor, float incidentIor ) {

		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));

	}

	// Fresnel equations for dielectric/dielectric interfaces.
	// Ref: https://belcour.github.io/blog/research/2017/05/01/brdf-thin-film.html
	// Evaluation XYZ sensitivity curves in Fourier space
	vec3 evalSensitivity( float OPD, vec3 shift ) {

		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );

		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;

		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;

	}

	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {

		vec3 I;

		// Force iridescenceIOR -> outsideIOR when thinFilmThickness -> 0.0
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		// Evaluate the cosTheta on the base layer (Snell law)
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );

		// Handle TIR:
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {

			return vec3( 1.0 );

		}

		float cosTheta2 = sqrt( cosTheta2Sq );

		// First interface
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;

		// Second interface
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) ); // guard against 1.0
		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;

		// Phase shift
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;

		// Compound terms
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );

		// Reflectance term for m = 0 (DC term amplitude)
		vec3 C0 = R12 + Rs;
		I = C0;

		// Reflectance term for m > 0 (pairs of diracs)
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {

			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;

		}

		// Since out of gamut colors might be produced, negative color values are clamped to 0.
		return max( I, vec3( 0.0 ) );

	}

#endif

`;var nl=`
#ifdef USE_BUMPMAP

	uniform sampler2D bumpMap;
	uniform float bumpScale;

	// Bump Mapping Unparametrized Surfaces on the GPU by Morten S. Mikkelsen
	// https://mmikk.github.io/papers3d/mm_sfgrad_bump.pdf

	// Evaluate the derivative of the height w.r.t. screen-space using forward differencing (listing 2)

	vec2 dHdxy_fwd() {

		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );

		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;

		return vec2( dBx, dBy );

	}

	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {

		// normalize is done to ensure that the bump map looks the same regardless of the texture's scale
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm; // normalized

		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );

		float fDet = dot( vSigmaX, R1 ) * faceDirection;

		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );

	}

#endif
`;var rl=`
#if NUM_CLIPPING_PLANES > 0

	vec4 plane;

	#ifdef ALPHA_TO_COVERAGE

		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;

		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {

			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );

			if ( clipOpacity == 0.0 ) discard;

		}
		#pragma unroll_loop_end

		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES

			float unionClipOpacity = 1.0;

			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {

				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );

			}
			#pragma unroll_loop_end

			clipOpacity *= 1.0 - unionClipOpacity;

		#endif

		diffuseColor.a *= clipOpacity;

		if ( diffuseColor.a == 0.0 ) discard;

	#else

		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {

			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;

		}
		#pragma unroll_loop_end

		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES

			bool clipped = true;

			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {

				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;

			}
			#pragma unroll_loop_end

			if ( clipped ) discard;

		#endif

	#endif

#endif
`;var ol=`
#if NUM_CLIPPING_PLANES > 0

	varying vec3 vClipPosition;

	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];

#endif
`;var sl=`
#if NUM_CLIPPING_PLANES > 0

	varying vec3 vClipPosition;

#endif
`;var al=`
#if NUM_CLIPPING_PLANES > 0

	vClipPosition = - mvPosition.xyz;

#endif
`;var cl=`
#if defined( USE_COLOR_ALPHA )

	diffuseColor *= vColor;

#elif defined( USE_COLOR )

	diffuseColor.rgb *= vColor;

#endif
`;var ll=`
#if defined( USE_COLOR_ALPHA )

	varying vec4 vColor;

#elif defined( USE_COLOR )

	varying vec3 vColor;

#endif
`;var Al=`
#if defined( USE_COLOR_ALPHA )

	varying vec4 vColor;

#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )

	varying vec3 vColor;

#endif
`;var fl=`
#if defined( USE_COLOR_ALPHA )

	vColor = vec4( 1.0 );

#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )

	vColor = vec3( 1.0 );

#endif

#ifdef USE_COLOR

	vColor *= color;

#endif

#ifdef USE_INSTANCING_COLOR

	vColor.xyz *= instanceColor.xyz;

#endif

#ifdef USE_BATCHING_COLOR

	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );

	vColor.xyz *= batchingColor.xyz;

#endif
`;var ul=`
#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6

#ifndef saturate
// <tonemapping_pars_fragment> may have defined saturate() already
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )

float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }

// expects values in the range of [0,1]x[0,1], returns values in the [0,1] range.
// do not collapse into a single function per: http://byteblacksmith.com/improvements-to-the-canonical-one-liner-glsl-rand-for-opengl-es-2-0/
highp float rand( const in vec2 uv ) {

	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );

	return fract( sin( sn ) * c );

}

#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif

struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};

struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};

#ifdef USE_ALPHAHASH

	varying vec3 vPosition;

#endif

vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

}

vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {

	// dir can be either a direction vector or a normal vector
	// upper-left 3x3 of matrix is assumed to be orthogonal

	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );

}

mat3 transposeMat3( const in mat3 m ) {

	mat3 tmp;

	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );

	return tmp;

}

bool isPerspectiveMatrix( mat4 m ) {

	return m[ 2 ][ 3 ] == - 1.0;

}

vec2 equirectUv( in vec3 dir ) {

	// dir is assumed to be unit length

	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;

	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;

	return vec2( u, v );

}

vec3 BRDF_Lambert( const in vec3 diffuseColor ) {

	return RECIPROCAL_PI * diffuseColor;

} // validated

vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {

	// Original approximation by Christophe Schlick '94
	// float fresnel = pow( 1.0 - dotVH, 5.0 );

	// Optimized variant (presented by Epic at SIGGRAPH '13)
	// https://cdn2.unrealengine.com/Resources/files/2013SiggraphPresentationsNotes-26915738.pdf
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );

	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );

} // validated

float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {

	// Original approximation by Christophe Schlick '94
	// float fresnel = pow( 1.0 - dotVH, 5.0 );

	// Optimized variant (presented by Epic at SIGGRAPH '13)
	// https://cdn2.unrealengine.com/Resources/files/2013SiggraphPresentationsNotes-26915738.pdf
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );

	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );

} // validated
`;var hl=`
#ifdef ENVMAP_TYPE_CUBE_UV

	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0

	// These shader functions convert between the UV coordinates of a single face of
	// a cubemap, the 0-5 integer index of a cube face, and the direction vector for
	// sampling a textureCube (not generally normalized ).

	float getFace( vec3 direction ) {

		vec3 absDirection = abs( direction );

		float face = - 1.0;

		if ( absDirection.x > absDirection.z ) {

			if ( absDirection.x > absDirection.y )

				face = direction.x > 0.0 ? 0.0 : 3.0;

			else

				face = direction.y > 0.0 ? 1.0 : 4.0;

		} else {

			if ( absDirection.z > absDirection.y )

				face = direction.z > 0.0 ? 2.0 : 5.0;

			else

				face = direction.y > 0.0 ? 1.0 : 4.0;

		}

		return face;

	}

	// RH coordinate system; PMREM face-indexing convention
	vec2 getUV( vec3 direction, float face ) {

		vec2 uv;

		if ( face == 0.0 ) {

			uv = vec2( direction.z, direction.y ) / abs( direction.x ); // pos x

		} else if ( face == 1.0 ) {

			uv = vec2( - direction.x, - direction.z ) / abs( direction.y ); // pos y

		} else if ( face == 2.0 ) {

			uv = vec2( - direction.x, direction.y ) / abs( direction.z ); // pos z

		} else if ( face == 3.0 ) {

			uv = vec2( - direction.z, direction.y ) / abs( direction.x ); // neg x

		} else if ( face == 4.0 ) {

			uv = vec2( - direction.x, direction.z ) / abs( direction.y ); // neg y

		} else {

			uv = vec2( direction.x, direction.y ) / abs( direction.z ); // neg z

		}

		return 0.5 * ( uv + 1.0 );

	}

	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {

		float face = getFace( direction );

		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );

		mipInt = max( mipInt, cubeUV_minMipLevel );

		float faceSize = exp2( mipInt );

		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0; // #25071

		if ( face > 2.0 ) {

			uv.y += faceSize;

			face -= 3.0;

		}

		uv.x += face * faceSize;

		uv.x += filterInt * 3.0 * cubeUV_minTileSize;

		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );

		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;

		#ifdef texture2DGradEXT

			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb; // disable anisotropic filtering

		#else

			return texture2D( envMap, uv ).rgb;

		#endif

	}

	// These defines must match with PMREMGenerator

	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0

	float roughnessToMip( float roughness ) {

		float mip = 0.0;

		if ( roughness >= cubeUV_r1 ) {

			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;

		} else if ( roughness >= cubeUV_r4 ) {

			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;

		} else if ( roughness >= cubeUV_r5 ) {

			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;

		} else if ( roughness >= cubeUV_r6 ) {

			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;

		} else {

			mip = - 2.0 * log2( 1.16 * roughness ); // 1.16 = 1.79^0.25
		}

		return mip;

	}

	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {

		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );

		float mipF = fract( mip );

		float mipInt = floor( mip );

		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );

		if ( mipF == 0.0 ) {

			return vec4( color0, 1.0 );

		} else {

			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );

			return vec4( mix( color0, color1, mipF ), 1.0 );

		}

	}

#endif
`;var dl=`

vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT

	vec3 transformedTangent = objectTangent;

#endif

#ifdef USE_BATCHING

	// this is in lieu of a per-instance normal-matrix
	// shear transforms in the instance matrix are not supported

	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;

	#ifdef USE_TANGENT

		transformedTangent = bm * transformedTangent;

	#endif

#endif

#ifdef USE_INSTANCING

	// this is in lieu of a per-instance normal-matrix
	// shear transforms in the instance matrix are not supported

	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;

	#ifdef USE_TANGENT

		transformedTangent = im * transformedTangent;

	#endif

#endif

transformedNormal = normalMatrix * transformedNormal;

#ifdef FLIP_SIDED

	transformedNormal = - transformedNormal;

#endif

#ifdef USE_TANGENT

	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;

	#ifdef FLIP_SIDED

		transformedTangent = - transformedTangent;

	#endif

#endif
`;var pl=`
#ifdef USE_DISPLACEMENTMAP

	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;

#endif
`;var ml=`
#ifdef USE_DISPLACEMENTMAP

	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );

#endif
`;var gl=`
#ifdef USE_EMISSIVEMAP

	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );

	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE

		// use inline sRGB decode until browsers properly support SRGB8_ALPHA8 with video textures (#26516)

		emissiveColor = sRGBTransferEOTF( emissiveColor );

	#endif

	totalEmissiveRadiance *= emissiveColor.rgb;

#endif
`;var Ml=`
#ifdef USE_EMISSIVEMAP

	uniform sampler2D emissiveMap;

#endif
`;var _l=`
gl_FragColor = linearToOutputTexel( gl_FragColor );
`;var xl=`

vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}

vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}

vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}

`;var vl=`
#ifdef USE_ENVMAP

	#ifdef ENV_WORLDPOS

		vec3 cameraToFrag;

		if ( isOrthographic ) {

			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );

		} else {

			cameraToFrag = normalize( vWorldPosition - cameraPosition );

		}

		// Transforming Normal Vectors with the Inverse Transformation
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );

		#ifdef ENVMAP_MODE_REFLECTION

			vec3 reflectVec = reflect( cameraToFrag, worldNormal );

		#else

			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );

		#endif

	#else

		vec3 reflectVec = vReflect;

	#endif

	#ifdef ENVMAP_TYPE_CUBE

		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );

	#else

		vec4 envColor = vec4( 0.0 );

	#endif

	#ifdef ENVMAP_BLENDING_MULTIPLY

		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );

	#elif defined( ENVMAP_BLENDING_MIX )

		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );

	#elif defined( ENVMAP_BLENDING_ADD )

		outgoingLight += envColor.xyz * specularStrength * reflectivity;

	#endif

#endif
`;var El=`
#ifdef USE_ENVMAP

	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;

	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif
`;var wl=`
#ifdef USE_ENVMAP

	uniform float reflectivity;

	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )

		#define ENV_WORLDPOS

	#endif

	#ifdef ENV_WORLDPOS

		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif

#endif
`;var Cl=`
#ifdef USE_ENVMAP

	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )

		#define ENV_WORLDPOS

	#endif

	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;

	#else

		varying vec3 vReflect;
		uniform float refractionRatio;

	#endif

#endif
`;var Sl=`
#ifdef USE_ENVMAP

	#ifdef ENV_WORLDPOS

		vWorldPosition = worldPosition.xyz;

	#else

		vec3 cameraToVertex;

		if ( isOrthographic ) {

			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );

		} else {

			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );

		}

		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );

		#ifdef ENVMAP_MODE_REFLECTION

			vReflect = reflect( cameraToVertex, worldNormal );

		#else

			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );

		#endif

	#endif

#endif
`;var Pl=`
#ifdef USE_FOG

	vFogDepth = - mvPosition.z;

#endif
`;var Dl=`
#ifdef USE_FOG

	varying float vFogDepth;

#endif
`;var yl=`
#ifdef USE_FOG

	#ifdef FOG_EXP2

		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );

	#else

		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );

	#endif

	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );

#endif
`;var Tl=`
#ifdef USE_FOG

	uniform vec3 fogColor;
	varying float vFogDepth;

	#ifdef FOG_EXP2

		uniform float fogDensity;

	#else

		uniform float fogNear;
		uniform float fogFar;

	#endif

#endif
`;var Bl=`

#ifdef USE_GRADIENTMAP

	uniform sampler2D gradientMap;

#endif

vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {

	// dotNL will be from -1.0 to 1.0
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );

	#ifdef USE_GRADIENTMAP

		return vec3( texture2D( gradientMap, coord ).r );

	#else

		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );

	#endif

}
`;var Il=`
#ifdef USE_LIGHTMAP

	uniform sampler2D lightMap;
	uniform float lightMapIntensity;

#endif
`;var bl=`
LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;
`;var Rl=`
varying vec3 vViewPosition;

struct LambertMaterial {

	vec3 diffuseColor;
	float specularStrength;

};

void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {

	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;

	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );

}

void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {

	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );

}

#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert
`;var Ll=`
uniform bool receiveShadow;
uniform vec3 ambientLightColor;

#if defined( USE_LIGHT_PROBES )

	uniform vec3 lightProbe[ 9 ];

#endif

// get the irradiance (radiance convolved with cosine lobe) at the point 'normal' on the unit sphere
// source: https://graphics.stanford.edu/papers/envmap/envmap.pdf
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {

	// normal is assumed to have unit length

	float x = normal.x, y = normal.y, z = normal.z;

	// band 0
	vec3 result = shCoefficients[ 0 ] * 0.886227;

	// band 1
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;

	// band 2
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );

	return result;

}

vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {

	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );

	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );

	return irradiance;

}

vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {

	vec3 irradiance = ambientLightColor;

	return irradiance;

}

float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {

	// based upon Frostbite 3 Moving to Physically-based Rendering
	// page 32, equation 26: E[window1]
	// https://seblagarde.files.wordpress.com/2015/07/course_notes_moving_frostbite_to_pbr_v32.pdf
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );

	if ( cutoffDistance > 0.0 ) {

		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );

	}

	return distanceFalloff;

}

float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {

	return smoothstep( coneCosine, penumbraCosine, angleCosine );

}

#if NUM_DIR_LIGHTS > 0

	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};

	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];

	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {

		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;

	}

#endif


#if NUM_POINT_LIGHTS > 0

	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};

	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];

	// light is an out parameter as having it as a return value caused compiler errors on some devices
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {

		vec3 lVector = pointLight.position - geometryPosition;

		light.direction = normalize( lVector );

		float lightDistance = length( lVector );

		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );

	}

#endif


#if NUM_SPOT_LIGHTS > 0

	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};

	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];

	// light is an out parameter as having it as a return value caused compiler errors on some devices
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {

		vec3 lVector = spotLight.position - geometryPosition;

		light.direction = normalize( lVector );

		float angleCos = dot( light.direction, spotLight.direction );

		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );

		if ( spotAttenuation > 0.0 ) {

			float lightDistance = length( lVector );

			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );

		} else {

			light.color = vec3( 0.0 );
			light.visible = false;

		}

	}

#endif


#if NUM_RECT_AREA_LIGHTS > 0

	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};

	// Pre-computed values of LinearTransformedCosine approximation of BRDF
	// BRDF approximation Texture is 64x64
	uniform sampler2D ltc_1; // RGBA Float
	uniform sampler2D ltc_2; // RGBA Float

	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];

#endif


#if NUM_HEMI_LIGHTS > 0

	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};

	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];

	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {

		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;

		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );

		return irradiance;

	}

#endif
`;var Ol=`
#ifdef USE_ENVMAP

	vec3 getIBLIrradiance( const in vec3 normal ) {

		#ifdef ENVMAP_TYPE_CUBE_UV

			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );

			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );

			return PI * envMapColor.rgb * envMapIntensity;

		#else

			return vec3( 0.0 );

		#endif

	}

	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {

		#ifdef ENVMAP_TYPE_CUBE_UV

			vec3 reflectVec = reflect( - viewDir, normal );

			// Mixing the reflection with the normal is more accurate and keeps rough objects from gathering light from behind their tangent plane.
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );

			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );

			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );

			return envMapColor.rgb * envMapIntensity;

		#else

			return vec3( 0.0 );

		#endif

	}

	#ifdef USE_ANISOTROPY

		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {

			#ifdef ENVMAP_TYPE_CUBE_UV

			  // https://google.github.io/filament/Filament.md.html#lighting/imagebasedlights/anisotropy
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );

				return getIBLRadiance( viewDir, bentNormal, roughness );

			#else

				return vec3( 0.0 );

			#endif

		}

	#endif

#endif
`;var Ul=`
ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;
`;var Nl=`
varying vec3 vViewPosition;

struct ToonMaterial {

	vec3 diffuseColor;

};

void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {

	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;

	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );

}

void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {

	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );

}

#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon
`;var Fl=`
BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;
`;var Ql=`
varying vec3 vViewPosition;

struct BlinnPhongMaterial {

	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;

};

void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {

	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;

	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );

	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;

}

void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {

	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );

}

#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong
`;var Gl=`
PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );

vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );

material.roughness = max( roughnessFactor, 0.0525 );// 0.0525 corresponds to the base mip of a 256 cubemap.
material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );

#ifdef IOR

	material.ior = ior;

	#ifdef USE_SPECULAR

		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;

		#ifdef USE_SPECULAR_COLORMAP

			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;

		#endif

		#ifdef USE_SPECULAR_INTENSITYMAP

			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;

		#endif

		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );

	#else

		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;

	#endif

	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );

#else

	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;

#endif

#ifdef USE_CLEARCOAT

	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;

	#ifdef USE_CLEARCOATMAP

		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;

	#endif

	#ifdef USE_CLEARCOAT_ROUGHNESSMAP

		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;

	#endif

	material.clearcoat = saturate( material.clearcoat ); // Burley clearcoat model
	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );

#endif

#ifdef USE_DISPERSION

	material.dispersion = dispersion;

#endif

#ifdef USE_IRIDESCENCE

	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;

	#ifdef USE_IRIDESCENCEMAP

		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;

	#endif

	#ifdef USE_IRIDESCENCE_THICKNESSMAP

		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;

	#else

		material.iridescenceThickness = iridescenceThicknessMaximum;

	#endif

#endif

#ifdef USE_SHEEN

	material.sheenColor = sheenColor;

	#ifdef USE_SHEEN_COLORMAP

		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;

	#endif

	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );

	#ifdef USE_SHEEN_ROUGHNESSMAP

		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;

	#endif

#endif

#ifdef USE_ANISOTROPY

	#ifdef USE_ANISOTROPYMAP

		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;

	#else

		vec2 anisotropyV = anisotropyVector;

	#endif

	material.anisotropy = length( anisotropyV );

	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}

	// Roughness along the anisotropy bitangent is the material roughness, while the tangent roughness increases with anisotropy.
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );

	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;

#endif
`;var Hl=`

struct PhysicalMaterial {

	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;

	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif

	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif

	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif

	#ifdef IOR
		float ior;
	#endif

	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif

	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif

};

// temporary
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );

vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );

    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}

// Moving Frostbite to Physically Based Rendering 3.0 - page 12, listing 2
// https://seblagarde.files.wordpress.com/2015/07/course_notes_moving_frostbite_to_pbr_v32.pdf
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {

	float a2 = pow2( alpha );

	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );

	return 0.5 / max( gv + gl, EPSILON );

}

// Microfacet Models for Refraction through Rough Surfaces - equation (33)
// http://graphicrants.blogspot.com/2013/08/specular-brdf-reference.html
// alpha is "roughness squared" in Disney\u2019s reparameterization
float D_GGX( const in float alpha, const in float dotNH ) {

	float a2 = pow2( alpha );

	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0; // avoid alpha = 0 with dotNH = 1

	return RECIPROCAL_PI * a2 / pow2( denom );

}

// https://google.github.io/filament/Filament.md.html#materialsystem/anisotropicmodel/anisotropicspecularbrdf
#ifdef USE_ANISOTROPY

	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {

		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );

		return saturate(v);

	}

	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {

		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;

		return RECIPROCAL_PI * a2 * pow2 ( w2 );

	}

#endif

#ifdef USE_CLEARCOAT

	// GGX Distribution, Schlick Fresnel, GGX_SmithCorrelated Visibility
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {

		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;

		float alpha = pow2( roughness ); // UE4's roughness

		vec3 halfDir = normalize( lightDir + viewDir );

		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );

		vec3 F = F_Schlick( f0, f90, dotVH );

		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );

		float D = D_GGX( alpha, dotNH );

		return F * ( V * D );

	}

#endif

vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {

	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;

	float alpha = pow2( roughness ); // UE4's roughness

	vec3 halfDir = normalize( lightDir + viewDir );

	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );

	vec3 F = F_Schlick( f0, f90, dotVH );

	#ifdef USE_IRIDESCENCE

		F = mix( F, material.iridescenceFresnel, material.iridescence );

	#endif

	#ifdef USE_ANISOTROPY

		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );

		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );

		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );

	#else

		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );

		float D = D_GGX( alpha, dotNH );

	#endif

	return F * ( V * D );

}

// Rect Area Light

// Real-Time Polygonal-Light Shading with Linearly Transformed Cosines
// by Eric Heitz, Jonathan Dupuy, Stephen Hill and David Neubelt
// code: https://github.com/selfshadow/ltc_code/

vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {

	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;

	float dotNV = saturate( dot( N, V ) );

	// texture parameterized by sqrt( GGX alpha ) and sqrt( 1 - cos( theta ) )
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );

	uv = uv * LUT_SCALE + LUT_BIAS;

	return uv;

}

float LTC_ClippedSphereFormFactor( const in vec3 f ) {

	// Real-Time Area Lighting: a Journey from Research to Production (p.102)
	// An approximation of the form factor of a horizon-clipped rectangle.

	float l = length( f );

	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );

}

vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {

	float x = dot( v1, v2 );

	float y = abs( x );

	// rational polynomial approximation to theta / sin( theta ) / 2PI
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;

	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;

	return cross( v1, v2 ) * theta_sintheta;

}

vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {

	// bail if point is on back side of plane of light
	// assumes ccw winding order of light vertices
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );

	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );

	// construct orthonormal basis around N
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 ); // negated from paper; possibly due to a different handedness of world coordinate system

	// compute transform
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );

	// transform rect
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );

	// project rect onto sphere
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );

	// calculate vector form factor
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );

	// adjust for horizon clipping
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );

/*
	// alternate method of adjusting for horizon clipping (see referece)
	// refactoring required
	float len = length( vectorFormFactor );
	float z = vectorFormFactor.z / len;

	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;

	// tabulated horizon-clipped sphere, apparently...
	vec2 uv = vec2( z * 0.5 + 0.5, len );
	uv = uv * LUT_SCALE + LUT_BIAS;

	float scale = texture2D( ltc_2, uv ).w;

	float result = len * scale;
*/

	return vec3( result );

}

// End Rect Area Light

#if defined( USE_SHEEN )

// https://github.com/google/filament/blob/master/shaders/src/brdf.fs
float D_Charlie( float roughness, float dotNH ) {

	float alpha = pow2( roughness );

	// Estevez and Kulla 2017, "Production Friendly Microfacet Sheen BRDF"
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 ); // 2^(-14/2), so sin2h^2 > 0 in fp16

	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );

}

// https://github.com/google/filament/blob/master/shaders/src/brdf.fs
float V_Neubelt( float dotNV, float dotNL ) {

	// Neubelt and Pettineo 2013, "Crafting a Next-gen Material Pipeline for The Order: 1886"
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );

}

vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {

	vec3 halfDir = normalize( lightDir + viewDir );

	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );

	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );

	return sheenColor * ( D * V );

}

#endif

// This is a curve-fit approxmation to the "Charlie sheen" BRDF integrated over the hemisphere from 
// Estevez and Kulla 2017, "Production Friendly Microfacet Sheen BRDF". The analysis can be found
// in the Sheen section of https://drive.google.com/file/d/1T0D1VSyR4AllqIJTQAraEIzjlb5h4FKH/view?usp=sharing
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {

	float dotNV = saturate( dot( normal, viewDir ) );

	float r2 = roughness * roughness;

	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;

	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;

	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );

	return saturate( DG * RECIPROCAL_PI );

}

// Analytical approximation of the DFG LUT, one half of the
// split-sum approximation used in indirect specular lighting.
// via 'environmentBRDF' from "Physically Based Shading on Mobile"
// https://www.unrealengine.com/blog/physically-based-shading-on-mobile
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {

	float dotNV = saturate( dot( normal, viewDir ) );

	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );

	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );

	vec4 r = roughness * c0 + c1;

	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;

	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;

	return fab;

}

vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {

	vec2 fab = DFGApprox( normal, viewDir, roughness );

	return specularColor * fab.x + specularF90 * fab.y;

}

// Fdez-Ag\xFCera's "Multiple-Scattering Microfacet Model for Real-Time Image Based Lighting"
// Approximates multiscattering in order to preserve energy.
// http://www.jcgt.org/published/0008/01/03/
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif

	vec2 fab = DFGApprox( normal, viewDir, roughness );

	#ifdef USE_IRIDESCENCE

		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );

	#else

		vec3 Fr = specularColor;

	#endif

	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;

	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;

	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619; // 1/21
	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );

	singleScatter += FssEss;
	multiScatter += Fms * Ems;

}

#if NUM_RECT_AREA_LIGHTS > 0

	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {

		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;

		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight; // counterclockwise; light shines in local neg z direction
		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;

		vec2 uv = LTC_Uv( normal, viewDir, roughness );

		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );

		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);

		// LTC Fresnel Approximation by Stephen Hill
		// http://blog.selfshadow.com/publications/s2016-advances/s2016_ltc_fresnel.pdf
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );

		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );

		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );

	}

#endif

void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {

	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );

	vec3 irradiance = dotNL * directLight.color;

	#ifdef USE_CLEARCOAT

		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );

		vec3 ccIrradiance = dotNLcc * directLight.color;

		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );

	#endif

	#ifdef USE_SHEEN

		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );

	#endif

	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );

	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}

void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {

	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );

}

void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {

	#ifdef USE_CLEARCOAT

		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );

	#endif

	#ifdef USE_SHEEN

		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );

	#endif

	// Both indirect specular and indirect diffuse light accumulate here

	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;

	#ifdef USE_IRIDESCENCE

		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );

	#else

		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );

	#endif

	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );

	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;

	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;

}

#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical

// ref: https://seblagarde.files.wordpress.com/2015/07/course_notes_moving_frostbite_to_pbr_v32.pdf
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {

	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );

}
`;var kl=`
/**
 * This is a template that can be used to light a material, it uses pluggable
 * RenderEquations (RE)for specific lighting scenarios.
 *
 * Instructions for use:
 * - Ensure that both RE_Direct, RE_IndirectDiffuse and RE_IndirectSpecular are defined
 * - Create a material parameter that is to be passed as the third parameter to your lighting functions.
 *
 * TODO:
 * - Add area light support.
 * - Add sphere light support.
 * - Add diffuse light probe (irradiance cubemap) support.
 */

vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );

vec3 geometryClearcoatNormal = vec3( 0.0 );

#ifdef USE_CLEARCOAT

	geometryClearcoatNormal = clearcoatNormal;

#endif

#ifdef USE_IRIDESCENCE

	float dotNVi = saturate( dot( normal, geometryViewDir ) );

	if ( material.iridescenceThickness == 0.0 ) {

		material.iridescence = 0.0;

	} else {

		material.iridescence = saturate( material.iridescence );

	}

	if ( material.iridescence > 0.0 ) {

		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );

		// Iridescence F0 approximation
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );

	}

#endif

IncidentLight directLight;

#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )

	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif

	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {

		pointLight = pointLights[ i ];

		getPointLightInfo( pointLight, geometryPosition, directLight );

		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif

		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );

	}
	#pragma unroll_loop_end

#endif

#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )

	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;

	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif

	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {

		spotLight = spotLights[ i ];

		getSpotLightInfo( spotLight, geometryPosition, directLight );

		// spot lights are ordered [shadows with maps, shadows without maps, maps without shadows, none]
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif

		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif

		#undef SPOT_LIGHT_MAP_INDEX

		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif

		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );

	}
	#pragma unroll_loop_end

#endif

#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )

	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif

	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {

		directionalLight = directionalLights[ i ];

		getDirectionalLightInfo( directionalLight, directLight );

		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif

		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );

	}
	#pragma unroll_loop_end

#endif

#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )

	RectAreaLight rectAreaLight;

	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {

		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );

	}
	#pragma unroll_loop_end

#endif

#if defined( RE_IndirectDiffuse )

	vec3 iblIrradiance = vec3( 0.0 );

	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );

	#if defined( USE_LIGHT_PROBES )

		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );

	#endif

	#if ( NUM_HEMI_LIGHTS > 0 )

		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {

			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );

		}
		#pragma unroll_loop_end

	#endif

#endif

#if defined( RE_IndirectSpecular )

	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );

#endif
`;var zl=`
#if defined( RE_IndirectDiffuse )

	#ifdef USE_LIGHTMAP

		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;

		irradiance += lightMapIrradiance;

	#endif

	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )

		iblIrradiance += getIBLIrradiance( geometryNormal );

	#endif

#endif

#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )

	#ifdef USE_ANISOTROPY

		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );

	#else

		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );

	#endif

	#ifdef USE_CLEARCOAT

		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );

	#endif

#endif
`;var Vl=`
#if defined( RE_IndirectDiffuse )

	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );

#endif

#if defined( RE_IndirectSpecular )

	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );

#endif
`;var Kl=`
#if defined( USE_LOGDEPTHBUF )

	// Doing a strict comparison with == 1.0 can cause noise artifacts
	// on some platforms. See issue #17623.
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;

#endif
`;var Wl=`
#if defined( USE_LOGDEPTHBUF )

	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;

#endif
`;var Yl=`
#ifdef USE_LOGDEPTHBUF

	varying float vFragDepth;
	varying float vIsPerspective;

#endif
`;var Xl=`
#ifdef USE_LOGDEPTHBUF

	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );

#endif
`;var Jl=`
#ifdef USE_MAP

	vec4 sampledDiffuseColor = texture2D( map, vMapUv );

	#ifdef DECODE_VIDEO_TEXTURE

		// use inline sRGB decode until browsers properly support SRGB8_ALPHA8 with video textures (#26516)

		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );

	#endif

	diffuseColor *= sampledDiffuseColor;

#endif
`;var ql=`
#ifdef USE_MAP

	uniform sampler2D map;

#endif
`;var Zl=`
#if defined( USE_MAP ) || defined( USE_ALPHAMAP )

	#if defined( USE_POINTS_UV )

		vec2 uv = vUv;

	#else

		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;

	#endif

#endif

#ifdef USE_MAP

	diffuseColor *= texture2D( map, uv );

#endif

#ifdef USE_ALPHAMAP

	diffuseColor.a *= texture2D( alphaMap, uv ).g;

#endif
`;var jl=`
#if defined( USE_POINTS_UV )

	varying vec2 vUv;

#else

	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )

		uniform mat3 uvTransform;

	#endif

#endif

#ifdef USE_MAP

	uniform sampler2D map;

#endif

#ifdef USE_ALPHAMAP

	uniform sampler2D alphaMap;

#endif
`;var $l=`
float metalnessFactor = metalness;

#ifdef USE_METALNESSMAP

	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );

	// reads channel B, compatible with a combined OcclusionRoughnessMetallic (RGB) texture
	metalnessFactor *= texelMetalness.b;

#endif
`;var eA=`
#ifdef USE_METALNESSMAP

	uniform sampler2D metalnessMap;

#endif
`;var tA=`
#ifdef USE_INSTANCING_MORPH

	float morphTargetInfluences[ MORPHTARGETS_COUNT ];

	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;

	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {

		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;

	}
#endif
`;var iA=`
#if defined( USE_MORPHCOLORS )

	// morphTargetBaseInfluence is set based on BufferGeometry.morphTargetsRelative value:
	// When morphTargetsRelative is false, this is set to 1 - sum(influences); this results in normal = sum((target - base) * influence)
	// When morphTargetsRelative is true, this is set to 1; as a result, all morph targets are simply added to the base after weighting
	vColor *= morphTargetBaseInfluence;

	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {

		#if defined( USE_COLOR_ALPHA )

			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];

		#elif defined( USE_COLOR )

			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];

		#endif

	}

#endif
`;var nA=`
#ifdef USE_MORPHNORMALS

	// morphTargetBaseInfluence is set based on BufferGeometry.morphTargetsRelative value:
	// When morphTargetsRelative is false, this is set to 1 - sum(influences); this results in normal = sum((target - base) * influence)
	// When morphTargetsRelative is true, this is set to 1; as a result, all morph targets are simply added to the base after weighting
	objectNormal *= morphTargetBaseInfluence;

	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {

		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];

	}

#endif
`;var rA=`
#ifdef USE_MORPHTARGETS

	#ifndef USE_INSTANCING_MORPH

		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];

	#endif

	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;

	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {

		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;

		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );

	}

#endif
`;var oA=`
#ifdef USE_MORPHTARGETS

	// morphTargetBaseInfluence is set based on BufferGeometry.morphTargetsRelative value:
	// When morphTargetsRelative is false, this is set to 1 - sum(influences); this results in position = sum((target - base) * influence)
	// When morphTargetsRelative is true, this is set to 1; as a result, all morph targets are simply added to the base after weighting
	transformed *= morphTargetBaseInfluence;

	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {

		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];

	}

#endif
`;var sA=`
float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;

#ifdef FLAT_SHADED

	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );

#else

	vec3 normal = normalize( vNormal );

	#ifdef DOUBLE_SIDED

		normal *= faceDirection;

	#endif

#endif

#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )

	#ifdef USE_TANGENT

		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );

	#else

		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);

	#endif

	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )

		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;

	#endif

#endif

#ifdef USE_CLEARCOAT_NORMALMAP

	#ifdef USE_TANGENT

		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );

	#else

		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );

	#endif

	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )

		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;

	#endif

#endif

// non perturbed normal for clearcoat among others

vec3 nonPerturbedNormal = normal;

`;var aA=`

#ifdef USE_NORMALMAP_OBJECTSPACE

	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0; // overrides both flatShading and attribute normals

	#ifdef FLIP_SIDED

		normal = - normal;

	#endif

	#ifdef DOUBLE_SIDED

		normal = normal * faceDirection;

	#endif

	normal = normalize( normalMatrix * normal );

#elif defined( USE_NORMALMAP_TANGENTSPACE )

	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;

	normal = normalize( tbn * mapN );

#elif defined( USE_BUMPMAP )

	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );

#endif
`;var cA=`
#ifndef FLAT_SHADED

	varying vec3 vNormal;

	#ifdef USE_TANGENT

		varying vec3 vTangent;
		varying vec3 vBitangent;

	#endif

#endif
`;var lA=`
#ifndef FLAT_SHADED

	varying vec3 vNormal;

	#ifdef USE_TANGENT

		varying vec3 vTangent;
		varying vec3 vBitangent;

	#endif

#endif
`;var AA=`
#ifndef FLAT_SHADED // normal is computed with derivatives when FLAT_SHADED

	vNormal = normalize( transformedNormal );

	#ifdef USE_TANGENT

		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );

	#endif

#endif
`;var fA=`
#ifdef USE_NORMALMAP

	uniform sampler2D normalMap;
	uniform vec2 normalScale;

#endif

#ifdef USE_NORMALMAP_OBJECTSPACE

	uniform mat3 normalMatrix;

#endif

#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )

	// Normal Mapping Without Precomputed Tangents
	// http://www.thetenthplanet.de/archives/1180

	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {

		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );

		vec3 N = surf_norm; // normalized

		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );

		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;

		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );

		return mat3( T * scale, B * scale, N );

	}

#endif
`;var uA=`
#ifdef USE_CLEARCOAT

	vec3 clearcoatNormal = nonPerturbedNormal;

#endif
`;var hA=`
#ifdef USE_CLEARCOAT_NORMALMAP

	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;

	clearcoatNormal = normalize( tbn2 * clearcoatMapN );

#endif
`;var dA=`

#ifdef USE_CLEARCOATMAP

	uniform sampler2D clearcoatMap;

#endif

#ifdef USE_CLEARCOAT_NORMALMAP

	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;

#endif

#ifdef USE_CLEARCOAT_ROUGHNESSMAP

	uniform sampler2D clearcoatRoughnessMap;

#endif
`;var pA=`

#ifdef USE_IRIDESCENCEMAP

	uniform sampler2D iridescenceMap;

#endif

#ifdef USE_IRIDESCENCE_THICKNESSMAP

	uniform sampler2D iridescenceThicknessMap;

#endif
`;var mA=`
#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif

#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif

gl_FragColor = vec4( outgoingLight, diffuseColor.a );
`;var gA=`
vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}

vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}

const float PackUpscale = 256. / 255.; // fraction -> 0..1 (including 1)
const float UnpackDownscale = 255. / 256.; // 0..1 -> fraction (excluding 1)
const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;

const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );

const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );

vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}

vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	// the 0.9999 tweak is unimportant, very tiny empirical improvement
	// return vec3( vuf * Inv255, gf * PackUpscale, bf * 0.9999 );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}

vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}

float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}

float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}

float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}

vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}

vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}

// NOTE: viewZ, the z-coordinate in camera space, is negative for points in front of the camera

float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	// -near maps to 0; -far maps to 1
	return ( viewZ + near ) / ( near - far );
}

float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	// maps orthographic depth in [ 0, 1 ] to viewZ
	return depth * ( near - far ) - near;
}

// NOTE: https://twitter.com/gonnavis/status/1377183786949959682

float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	// -near maps to 0; -far maps to 1
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}

float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	// maps perspective depth in [ 0, 1 ] to viewZ
	return ( near * far ) / ( ( far - near ) * depth - far );
}
`;var MA=`
#ifdef PREMULTIPLIED_ALPHA

	// Get get normal blending with premultipled, use with CustomBlending, OneFactor, OneMinusSrcAlphaFactor, AddEquation.
	gl_FragColor.rgb *= gl_FragColor.a;

#endif
`;var _A=`
vec4 mvPosition = vec4( transformed, 1.0 );

#ifdef USE_BATCHING

	mvPosition = batchingMatrix * mvPosition;

#endif

#ifdef USE_INSTANCING

	mvPosition = instanceMatrix * mvPosition;

#endif

mvPosition = modelViewMatrix * mvPosition;

gl_Position = projectionMatrix * mvPosition;
`;var xA=`
#ifdef DITHERING

	gl_FragColor.rgb = dithering( gl_FragColor.rgb );

#endif
`;var vA=`
#ifdef DITHERING

	// based on https://www.shadertoy.com/view/MslGR8
	vec3 dithering( vec3 color ) {
		//Calculate grid position
		float grid_position = rand( gl_FragCoord.xy );

		//Shift the individual colors differently, thus making it even harder to see the dithering pattern
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );

		//modify shift according to grid position.
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );

		//shift the color by dither_shift
		return color + dither_shift_RGB;
	}

#endif
`;var EA=`
float roughnessFactor = roughness;

#ifdef USE_ROUGHNESSMAP

	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );

	// reads channel G, compatible with a combined OcclusionRoughnessMetallic (RGB) texture
	roughnessFactor *= texelRoughness.g;

#endif
`;var wA=`
#ifdef USE_ROUGHNESSMAP

	uniform sampler2D roughnessMap;

#endif
`;var CA=`
#if NUM_SPOT_LIGHT_COORDS > 0

	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];

#endif

#if NUM_SPOT_LIGHT_MAPS > 0

	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];

#endif

#ifdef USE_SHADOWMAP

	#if NUM_DIR_LIGHT_SHADOWS > 0

		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];

		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};

		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];

	#endif

	#if NUM_SPOT_LIGHT_SHADOWS > 0

		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];

		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};

		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];

	#endif

	#if NUM_POINT_LIGHT_SHADOWS > 0

		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];

		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};

		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];

	#endif

	/*
	#if NUM_RECT_AREA_LIGHTS > 0

		// TODO (abelnation): create uniforms for area light shadows

	#endif
	*/

	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {

		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );

	}

	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {

		return unpackRGBATo2Half( texture2D( shadow, uv ) );

	}

	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){

		float occlusion = 1.0;

		vec2 distribution = texture2DDistribution( shadow, uv );

		float hard_shadow = step( compare , distribution.x ); // Hard Shadow

		if (hard_shadow != 1.0 ) {

			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance ); // Chebeyshevs inequality
			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 ); // 0.3 reduces light bleed
			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );

		}
		return occlusion;

	}

	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {

		float shadow = 1.0;

		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;

		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;

		if ( frustumTest ) {

		#if defined( SHADOWMAP_TYPE_PCF )

			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;

			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;

			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );

		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )

			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;

			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;

			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );

		#elif defined( SHADOWMAP_TYPE_VSM )

			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );

		#else // no percentage-closer filtering:

			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );

		#endif

		}

		return mix( 1.0, shadow, shadowIntensity );

	}

	// cubeToUV() maps a 3D direction vector suitable for cube texture mapping to a 2D
	// vector suitable for 2D texture mapping. This code uses the following layout for the
	// 2D texture:
	//
	// xzXZ
	//  y Y
	//
	// Y - Positive y direction
	// y - Negative y direction
	// X - Positive x direction
	// x - Negative x direction
	// Z - Positive z direction
	// z - Negative z direction
	//
	// Source and test bed:
	// https://gist.github.com/tschw/da10c43c467ce8afd0c4

	vec2 cubeToUV( vec3 v, float texelSizeY ) {

		// Number of texels to avoid at the edge of each square

		vec3 absV = abs( v );

		// Intersect unit cube

		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;

		// Apply scale to avoid seams

		// two texels less per square (one texel will do for NEAREST)
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );

		// Unwrap

		// space: -1 ... 1 range for each square
		//
		// #X##		dim    := ( 4 , 2 )
		//  # #		center := ( 1 , 1 )

		vec2 planar = v.xy;

		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;

		if ( absV.z >= almostOne ) {

			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;

		} else if ( absV.x >= almostOne ) {

			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;

		} else if ( absV.y >= almostOne ) {

			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;

		}

		// Transform to UV space

		// scale := 0.5 / dim
		// translate := ( center + 0.5 ) / dim
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );

	}

	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {

		float shadow = 1.0;

		// for point lights, the uniform @vShadowCoord is re-purposed to hold
		// the vector from the light to the world-space position of the fragment.
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );

		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {

			// dp = normalized distance from light to fragment position
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear ); // need to clamp?
			dp += shadowBias;

			// bd3D = base direction 3D
			vec3 bd3D = normalize( lightToPosition );

			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );

			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )

				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;

				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );

			#else // no percentage-closer filtering

				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );

			#endif

		}

		return mix( 1.0, shadow, shadowIntensity );

	}

#endif
`;var SA=`

#if NUM_SPOT_LIGHT_COORDS > 0

	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];

#endif

#ifdef USE_SHADOWMAP

	#if NUM_DIR_LIGHT_SHADOWS > 0

		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];

		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};

		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];

	#endif

	#if NUM_SPOT_LIGHT_SHADOWS > 0

		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};

		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];

	#endif

	#if NUM_POINT_LIGHT_SHADOWS > 0

		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];

		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};

		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];

	#endif

	/*
	#if NUM_RECT_AREA_LIGHTS > 0

		// TODO (abelnation): uniforms for area light shadows

	#endif
	*/

#endif
`;var PA=`

#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )

	// Offsetting the position used for querying occlusion along the world normal can be used to reduce shadow acne.
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;

#endif

#if defined( USE_SHADOWMAP )

	#if NUM_DIR_LIGHT_SHADOWS > 0

		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {

			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;

		}
		#pragma unroll_loop_end

	#endif

	#if NUM_POINT_LIGHT_SHADOWS > 0

		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {

			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;

		}
		#pragma unroll_loop_end

	#endif

	/*
	#if NUM_RECT_AREA_LIGHTS > 0

		// TODO (abelnation): update vAreaShadowCoord with area light info

	#endif
	*/

#endif

// spot lights can be evaluated without active shadow mapping (when SpotLight.map is used)

#if NUM_SPOT_LIGHT_COORDS > 0

	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {

		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;

	}
	#pragma unroll_loop_end

#endif


`;var DA=`
float getShadowMask() {

	float shadow = 1.0;

	#ifdef USE_SHADOWMAP

	#if NUM_DIR_LIGHT_SHADOWS > 0

	DirectionalLightShadow directionalLight;

	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {

		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;

	}
	#pragma unroll_loop_end

	#endif

	#if NUM_SPOT_LIGHT_SHADOWS > 0

	SpotLightShadow spotLight;

	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {

		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;

	}
	#pragma unroll_loop_end

	#endif

	#if NUM_POINT_LIGHT_SHADOWS > 0

	PointLightShadow pointLight;

	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {

		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;

	}
	#pragma unroll_loop_end

	#endif

	/*
	#if NUM_RECT_AREA_LIGHTS > 0

		// TODO (abelnation): update shadow for Area light

	#endif
	*/

	#endif

	return shadow;

}
`;var yA=`
#ifdef USE_SKINNING

	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );

#endif
`;var TA=`
#ifdef USE_SKINNING

	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;

	uniform highp sampler2D boneTexture;

	mat4 getBoneMatrix( const in float i ) {

		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );

		return mat4( v1, v2, v3, v4 );

	}

#endif
`;var BA=`
#ifdef USE_SKINNING

	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );

	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;

	transformed = ( bindMatrixInverse * skinned ).xyz;

#endif
`;var IA=`
#ifdef USE_SKINNING

	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;

	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;

	#ifdef USE_TANGENT

		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;

	#endif

#endif
`;var bA=`
float specularStrength;

#ifdef USE_SPECULARMAP

	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;

#else

	specularStrength = 1.0;

#endif
`;var RA=`
#ifdef USE_SPECULARMAP

	uniform sampler2D specularMap;

#endif
`;var LA=`
#if defined( TONE_MAPPING )

	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );

#endif
`;var OA=`
#ifndef saturate
// <common> may have defined saturate() already
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif

uniform float toneMappingExposure;

// exposure only
vec3 LinearToneMapping( vec3 color ) {

	return saturate( toneMappingExposure * color );

}

// source: https://www.cs.utah.edu/docs/techreports/2002/pdf/UUCS-02-001.pdf
vec3 ReinhardToneMapping( vec3 color ) {

	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );

}

// source: http://filmicworlds.com/blog/filmic-tonemapping-operators/
vec3 CineonToneMapping( vec3 color ) {

	// filmic operator by Jim Hejl and Richard Burgess-Dawson
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );

}

// source: https://github.com/selfshadow/ltc_code/blob/master/webgl/shaders/ltc/ltc_blit.fs
vec3 RRTAndODTFit( vec3 v ) {

	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;

}

// this implementation of ACES is modified to accommodate a brighter viewing environment.
// the scale factor of 1/0.6 is subjective. see discussion in #19621.

vec3 ACESFilmicToneMapping( vec3 color ) {

	// sRGB => XYZ => D65_2_D60 => AP1 => RRT_SAT
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ), // transposed from source
		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);

	// ODT_SAT => XYZ => D60_2_D65 => sRGB
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ), // transposed from source
		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);

	color *= toneMappingExposure / 0.6;

	color = ACESInputMat * color;

	// Apply RRT and ODT
	color = RRTAndODTFit( color );

	color = ACESOutputMat * color;

	// Clamp to [0, 1]
	return saturate( color );

}

// Matrices for rec 2020 <> rec 709 color space conversion
// matrix provided in row-major order so it has been transposed
// https://www.itu.int/pub/R-REP-BT.2407-2017
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);

const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);

// https://iolite-engine.com/blog_posts/minimal_agx_implementation
// Mean error^2: 3.6705141e-06
vec3 agxDefaultContrastApprox( vec3 x ) {

	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;

	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;

}

// AgX Tone Mapping implementation based on Filament, which in turn is based
// on Blender's implementation using rec 2020 primaries
// https://github.com/google/filament/pull/7236
// Inputs and outputs are encoded as Linear-sRGB.

vec3 AgXToneMapping( vec3 color ) {

	// AgX constants
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);

	// explicit AgXOutsetMatrix generated from Filaments AgXOutsetMatrixInv
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);

	// LOG2_MIN      = -10.0
	// LOG2_MAX      =  +6.5
	// MIDDLE_GRAY   =  0.18
	const float AgxMinEv = - 12.47393;  // log2( pow( 2, LOG2_MIN ) * MIDDLE_GRAY )
	const float AgxMaxEv = 4.026069;    // log2( pow( 2, LOG2_MAX ) * MIDDLE_GRAY )

	color *= toneMappingExposure;

	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;

	color = AgXInsetMatrix * color;

	// Log2 encoding
	color = max( color, 1e-10 ); // avoid 0 or negative numbers for log2
	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );

	color = clamp( color, 0.0, 1.0 );

	// Apply sigmoid
	color = agxDefaultContrastApprox( color );

	// Apply AgX look
	// v = agxLook(v, look);

	color = AgXOutsetMatrix * color;

	// Linearize
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );

	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;

	// Gamut mapping. Simple clamp for now.
	color = clamp( color, 0.0, 1.0 );

	return color;

}

// https://modelviewer.dev/examples/tone-mapping

vec3 NeutralToneMapping( vec3 color ) {

	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;

	color *= toneMappingExposure;

	float x = min( color.r, min( color.g, color.b ) );

	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;

	color -= offset;

	float peak = max( color.r, max( color.g, color.b ) );

	if ( peak < StartCompression ) return color;

	float d = 1. - StartCompression;

	float newPeak = 1. - d * d / ( peak + d - StartCompression );

	color *= newPeak / peak;

	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );

	return mix( color, vec3( newPeak ), g );

}

vec3 CustomToneMapping( vec3 color ) { return color; }
`;var UA=`
#ifdef USE_TRANSMISSION

	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;

	#ifdef USE_TRANSMISSIONMAP

		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;

	#endif

	#ifdef USE_THICKNESSMAP

		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;

	#endif

	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );

	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );

	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );

	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );

#endif
`;var NA=`
#ifdef USE_TRANSMISSION

	// Transmission code is based on glTF-Sampler-Viewer
	// https://github.com/KhronosGroup/glTF-Sample-Viewer

	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;

	#ifdef USE_TRANSMISSIONMAP

		uniform sampler2D transmissionMap;

	#endif

	#ifdef USE_THICKNESSMAP

		uniform sampler2D thicknessMap;

	#endif

	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;

	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;

	varying vec3 vWorldPosition;

	// Mipped Bicubic Texture Filtering by N8
	// https://www.shadertoy.com/view/Dl2SDW

	float w0( float a ) {

		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );

	}

	float w1( float a ) {

		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );

	}

	float w2( float a ){

		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );

	}

	float w3( float a ) {

		return ( 1.0 / 6.0 ) * ( a * a * a );

	}

	// g0 and g1 are the two amplitude functions
	float g0( float a ) {

		return w0( a ) + w1( a );

	}

	float g1( float a ) {

		return w2( a ) + w3( a );

	}

	// h0 and h1 are the two offset functions
	float h0( float a ) {

		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );

	}

	float h1( float a ) {

		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );

	}

	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {

		uv = uv * texelSize.zw + 0.5;

		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );

		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );

		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;

		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );

	}

	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {

		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );

	}

	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {

		// Direction of refracted light.
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );

		// Compute rotation-independant scaling of the model matrix.
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );

		// The thickness is specified in local space.
		return normalize( refractionVector ) * thickness * modelScale;

	}

	float applyIorToRoughness( const in float roughness, const in float ior ) {

		// Scale roughness with IOR so that an IOR of 1.0 results in no microfacet refraction and
		// an IOR of 1.5 results in the default amount of microfacet refraction.
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );

	}

	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {

		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );

	}

	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {

		if ( isinf( attenuationDistance ) ) {

			// Attenuation distance is +\u221E, i.e. the transmitted color is not attenuated at all.
			return vec3( 1.0 );

		} else {

			// Compute light attenuation using Beer's law.
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance ); // Beer's law
			return transmittance;

		}

	}

	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {

		vec4 transmittedLight;
		vec3 transmittance;

		#ifdef USE_DISPERSION

			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );

			for ( int i = 0; i < 3; i ++ ) {

				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
		
				// Project refracted vector on the framebuffer, while mapping to normalized device coordinates.
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
		
				// Sample framebuffer to get pixel the refracted ray hits.
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;

				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];

			}

			transmittedLight.a /= 3.0;
		
		#else
		
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;

			// Project refracted vector on the framebuffer, while mapping to normalized device coordinates.
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;

			// Sample framebuffer to get pixel the refracted ray hits.
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		
		#endif

		vec3 attenuatedColor = transmittance * transmittedLight.rgb;

		// Get the specular component.
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );

		// As less light is transmitted, the opacity should be increased. This simple approximation does a decent job 
		// of modulating a CSS background, and has no effect when the buffer is opaque, due to a solid object or clear color.
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;

		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );

	}
#endif
`;var FA=`
#if defined( USE_UV ) || defined( USE_ANISOTROPY )

	varying vec2 vUv;

#endif
#ifdef USE_MAP

	varying vec2 vMapUv;

#endif
#ifdef USE_ALPHAMAP

	varying vec2 vAlphaMapUv;

#endif
#ifdef USE_LIGHTMAP

	varying vec2 vLightMapUv;

#endif
#ifdef USE_AOMAP

	varying vec2 vAoMapUv;

#endif
#ifdef USE_BUMPMAP

	varying vec2 vBumpMapUv;

#endif
#ifdef USE_NORMALMAP

	varying vec2 vNormalMapUv;

#endif
#ifdef USE_EMISSIVEMAP

	varying vec2 vEmissiveMapUv;

#endif
#ifdef USE_METALNESSMAP

	varying vec2 vMetalnessMapUv;

#endif
#ifdef USE_ROUGHNESSMAP

	varying vec2 vRoughnessMapUv;

#endif
#ifdef USE_ANISOTROPYMAP

	varying vec2 vAnisotropyMapUv;

#endif
#ifdef USE_CLEARCOATMAP

	varying vec2 vClearcoatMapUv;

#endif
#ifdef USE_CLEARCOAT_NORMALMAP

	varying vec2 vClearcoatNormalMapUv;

#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP

	varying vec2 vClearcoatRoughnessMapUv;

#endif
#ifdef USE_IRIDESCENCEMAP

	varying vec2 vIridescenceMapUv;

#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP

	varying vec2 vIridescenceThicknessMapUv;

#endif
#ifdef USE_SHEEN_COLORMAP

	varying vec2 vSheenColorMapUv;

#endif
#ifdef USE_SHEEN_ROUGHNESSMAP

	varying vec2 vSheenRoughnessMapUv;

#endif
#ifdef USE_SPECULARMAP

	varying vec2 vSpecularMapUv;

#endif
#ifdef USE_SPECULAR_COLORMAP

	varying vec2 vSpecularColorMapUv;

#endif
#ifdef USE_SPECULAR_INTENSITYMAP

	varying vec2 vSpecularIntensityMapUv;

#endif
#ifdef USE_TRANSMISSIONMAP

	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;

#endif
#ifdef USE_THICKNESSMAP

	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;

#endif
`;var QA=`
#if defined( USE_UV ) || defined( USE_ANISOTROPY )

	varying vec2 vUv;

#endif
#ifdef USE_MAP

	uniform mat3 mapTransform;
	varying vec2 vMapUv;

#endif
#ifdef USE_ALPHAMAP

	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;

#endif
#ifdef USE_LIGHTMAP

	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;

#endif
#ifdef USE_AOMAP

	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;

#endif
#ifdef USE_BUMPMAP

	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;

#endif
#ifdef USE_NORMALMAP

	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;

#endif
#ifdef USE_DISPLACEMENTMAP

	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;

#endif
#ifdef USE_EMISSIVEMAP

	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;

#endif
#ifdef USE_METALNESSMAP

	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;

#endif
#ifdef USE_ROUGHNESSMAP

	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;

#endif
#ifdef USE_ANISOTROPYMAP

	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;

#endif
#ifdef USE_CLEARCOATMAP

	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;

#endif
#ifdef USE_CLEARCOAT_NORMALMAP

	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;

#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP

	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;

#endif
#ifdef USE_SHEEN_COLORMAP

	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;

#endif
#ifdef USE_SHEEN_ROUGHNESSMAP

	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;

#endif
#ifdef USE_IRIDESCENCEMAP

	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;

#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP

	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;

#endif
#ifdef USE_SPECULARMAP

	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;

#endif
#ifdef USE_SPECULAR_COLORMAP

	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;

#endif
#ifdef USE_SPECULAR_INTENSITYMAP

	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;

#endif
#ifdef USE_TRANSMISSIONMAP

	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;

#endif
#ifdef USE_THICKNESSMAP

	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;

#endif
`;var GA=`
#if defined( USE_UV ) || defined( USE_ANISOTROPY )

	vUv = vec3( uv, 1 ).xy;

#endif
#ifdef USE_MAP

	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;

#endif
#ifdef USE_ALPHAMAP

	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_LIGHTMAP

	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_AOMAP

	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_BUMPMAP

	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_NORMALMAP

	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_DISPLACEMENTMAP

	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_EMISSIVEMAP

	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_METALNESSMAP

	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_ROUGHNESSMAP

	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_ANISOTROPYMAP

	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_CLEARCOATMAP

	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_CLEARCOAT_NORMALMAP

	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP

	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_IRIDESCENCEMAP

	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP

	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_SHEEN_COLORMAP

	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_SHEEN_ROUGHNESSMAP

	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_SPECULARMAP

	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_SPECULAR_COLORMAP

	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_SPECULAR_INTENSITYMAP

	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_TRANSMISSIONMAP

	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_THICKNESSMAP

	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;

#endif
`;var HA=`
#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0

	vec4 worldPosition = vec4( transformed, 1.0 );

	#ifdef USE_BATCHING

		worldPosition = batchingMatrix * worldPosition;

	#endif

	#ifdef USE_INSTANCING

		worldPosition = instanceMatrix * worldPosition;

	#endif

	worldPosition = modelMatrix * worldPosition;

#endif
`;var kA=`
varying vec2 vUv;
uniform mat3 uvTransform;

void main() {

	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;

	gl_Position = vec4( position.xy, 1.0, 1.0 );

}
`,zA=`
uniform sampler2D t2D;
uniform float backgroundIntensity;

varying vec2 vUv;

void main() {

	vec4 texColor = texture2D( t2D, vUv );

	#ifdef DECODE_VIDEO_TEXTURE

		// use inline sRGB decode until browsers properly support SRGB8_APLHA8 with video textures

		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );

	#endif

	texColor.rgb *= backgroundIntensity;

	gl_FragColor = texColor;

	#include <tonemapping_fragment>
	#include <colorspace_fragment>

}
`;var VA=`
varying vec3 vWorldDirection;

#include <common>

void main() {

	vWorldDirection = transformDirection( position, modelMatrix );

	#include <begin_vertex>
	#include <project_vertex>

	gl_Position.z = gl_Position.w; // set z to camera.far

}
`,KA=`

#ifdef ENVMAP_TYPE_CUBE

	uniform samplerCube envMap;

#elif defined( ENVMAP_TYPE_CUBE_UV )

	uniform sampler2D envMap;

#endif

uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;

varying vec3 vWorldDirection;

#include <cube_uv_reflection_fragment>

void main() {

	#ifdef ENVMAP_TYPE_CUBE

		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );

	#elif defined( ENVMAP_TYPE_CUBE_UV )

		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );

	#else

		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );

	#endif

	texColor.rgb *= backgroundIntensity;

	gl_FragColor = texColor;

	#include <tonemapping_fragment>
	#include <colorspace_fragment>

}
`;var WA=`
varying vec3 vWorldDirection;

#include <common>

void main() {

	vWorldDirection = transformDirection( position, modelMatrix );

	#include <begin_vertex>
	#include <project_vertex>

	gl_Position.z = gl_Position.w; // set z to camera.far

}
`,YA=`
uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;

varying vec3 vWorldDirection;

void main() {

	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );

	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;

	#include <tonemapping_fragment>
	#include <colorspace_fragment>

}
`;var XA=`
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

// This is used for computing an equivalent of gl_FragCoord.z that is as high precision as possible.
// Some platforms compute gl_FragCoord at a lower precision which makes the manually computed value better for
// depth-based postprocessing effects. Reproduced on iPad with A10 processor / iPadOS 13.3.1.
varying vec2 vHighPrecisionZW;

void main() {

	#include <uv_vertex>

	#include <batching_vertex>
	#include <skinbase_vertex>

	#include <morphinstance_vertex>

	#ifdef USE_DISPLACEMENTMAP

		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>

	#endif

	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>

	vHighPrecisionZW = gl_Position.zw;

}
`,JA=`
#if DEPTH_PACKING == 3200

	uniform float opacity;

#endif

#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

varying vec2 vHighPrecisionZW;

void main() {

	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>

	#if DEPTH_PACKING == 3200

		diffuseColor.a = opacity;

	#endif

	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>

	#include <logdepthbuf_fragment>

	// Higher precision equivalent of gl_FragCoord.z. This assumes depthRange has been left to its default values.
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;

	#if DEPTH_PACKING == 3200

		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );

	#elif DEPTH_PACKING == 3201

		gl_FragColor = packDepthToRGBA( fragCoordZ );

	#elif DEPTH_PACKING == 3202

		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );

	#elif DEPTH_PACKING == 3203

		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );

	#endif

}
`;var qA=`
#define DISTANCE

varying vec3 vWorldPosition;

#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>

void main() {

	#include <uv_vertex>

	#include <batching_vertex>
	#include <skinbase_vertex>

	#include <morphinstance_vertex>

	#ifdef USE_DISPLACEMENTMAP

		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>

	#endif

	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>

	vWorldPosition = worldPosition.xyz;

}
`,ZA=`
#define DISTANCE

uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;

#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>

void main () {

	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>

	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>

	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist ); // clamp to [ 0, 1 ]

	gl_FragColor = packDepthToRGBA( dist );

}
`;var jA=`
varying vec3 vWorldDirection;

#include <common>

void main() {

	vWorldDirection = transformDirection( position, modelMatrix );

	#include <begin_vertex>
	#include <project_vertex>

}
`,$A=`
uniform sampler2D tEquirect;

varying vec3 vWorldDirection;

#include <common>

void main() {

	vec3 direction = normalize( vWorldDirection );

	vec2 sampleUV = equirectUv( direction );

	gl_FragColor = texture2D( tEquirect, sampleUV );

	#include <tonemapping_fragment>
	#include <colorspace_fragment>

}
`;var ef=`
uniform float scale;
attribute float lineDistance;

varying float vLineDistance;

#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

void main() {

	vLineDistance = scale * lineDistance;

	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>

}
`,tf=`
uniform vec3 diffuse;
uniform float opacity;

uniform float dashSize;
uniform float totalSize;

varying float vLineDistance;

#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

void main() {

	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>

	if ( mod( vLineDistance, totalSize ) > dashSize ) {

		discard;

	}

	vec3 outgoingLight = vec3( 0.0 );

	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>

	outgoingLight = diffuseColor.rgb; // simple shader

	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>

}
`;var nf=`
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

void main() {

	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>

	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )

		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>

	#endif

	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>

	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>

}
`,rf=`
uniform vec3 diffuse;
uniform float opacity;

#ifndef FLAT_SHADED

	varying vec3 vNormal;

#endif

#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

void main() {

	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>

	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>

	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );

	// accumulation (baked indirect lighting only)
	#ifdef USE_LIGHTMAP

		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;

	#else

		reflectedLight.indirectDiffuse += vec3( 1.0 );

	#endif

	// modulation
	#include <aomap_fragment>

	reflectedLight.indirectDiffuse *= diffuseColor.rgb;

	vec3 outgoingLight = reflectedLight.indirectDiffuse;

	#include <envmap_fragment>

	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>

}
`;var of=`
#define LAMBERT

varying vec3 vViewPosition;

#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

void main() {

	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>

	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>

	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>

	vViewPosition = - mvPosition.xyz;

	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>

}
`,sf=`
#define LAMBERT

uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;

#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

void main() {

	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>

	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;

	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>

	// accumulation
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>

	// modulation
	#include <aomap_fragment>

	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;

	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>

}
`;var af=`
#define MATCAP

varying vec3 vViewPosition;

#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>

#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

void main() {

	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>

	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>

	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>

	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>

	vViewPosition = - mvPosition.xyz;

}
`,cf=`
#define MATCAP

uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;

varying vec3 vViewPosition;

#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

void main() {

	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>

	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>

	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5; // 0.495 to remove artifacts caused by undersized matcap disks

	#ifdef USE_MATCAP

		vec4 matcapColor = texture2D( matcap, uv );

	#else

		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 ); // default if matcap is missing

	#endif

	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;

	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>

}
`;var lf=`
#define NORMAL

#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )

	varying vec3 vViewPosition;

#endif

#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

void main() {

	#include <uv_vertex>
	#include <batching_vertex>

	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>

	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>

#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )

	vViewPosition = - mvPosition.xyz;

#endif

}
`,Af=`
#define NORMAL

uniform float opacity;

#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )

	varying vec3 vViewPosition;

#endif

#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

void main() {

	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );

	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>

	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );

	#ifdef OPAQUE

		gl_FragColor.a = 1.0;

	#endif

}
`;var ff=`
#define PHONG

varying vec3 vViewPosition;

#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

void main() {

	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>

	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>

	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>

	vViewPosition = - mvPosition.xyz;

	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>

}
`,uf=`
#define PHONG

uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;

#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

void main() {

	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>

	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;

	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>

	// accumulation
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>

	// modulation
	#include <aomap_fragment>

	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;

	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>

}
`;var hf=`
#define STANDARD

varying vec3 vViewPosition;

#ifdef USE_TRANSMISSION

	varying vec3 vWorldPosition;

#endif

#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

void main() {

	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>

	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>

	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>

	vViewPosition = - mvPosition.xyz;

	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>

#ifdef USE_TRANSMISSION

	vWorldPosition = worldPosition.xyz;

#endif
}
`,df=`
#define STANDARD

#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif

uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;

#ifdef IOR
	uniform float ior;
#endif

#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;

	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif

	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif

#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif

#ifdef USE_DISPERSION
	uniform float dispersion;
#endif

#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif

#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;

	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif

	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif

#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;

	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif

varying vec3 vViewPosition;

#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

void main() {

	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>

	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;

	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>

	// accumulation
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>

	// modulation
	#include <aomap_fragment>

	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;

	#include <transmission_fragment>

	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;

	#ifdef USE_SHEEN

		// Sheen energy compensation approximation calculation can be found at the end of
		// https://drive.google.com/file/d/1T0D1VSyR4AllqIJTQAraEIzjlb5h4FKH/view?usp=sharing
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );

		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;

	#endif

	#ifdef USE_CLEARCOAT

		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );

		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );

		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;

	#endif

	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>

}
`;var pf=`
#define TOON

varying vec3 vViewPosition;

#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

void main() {

	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>

	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>

	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>

	vViewPosition = - mvPosition.xyz;

	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>

}
`,mf=`
#define TOON

uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;

#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

void main() {

	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>

	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;

	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>

	// accumulation
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>

	// modulation
	#include <aomap_fragment>

	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;

	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>

}
`;var gf=`
uniform float size;
uniform float scale;

#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

#ifdef USE_POINTS_UV

	varying vec2 vUv;
	uniform mat3 uvTransform;

#endif

void main() {

	#ifdef USE_POINTS_UV

		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;

	#endif

	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>

	gl_PointSize = size;

	#ifdef USE_SIZEATTENUATION

		bool isPerspective = isPerspectiveMatrix( projectionMatrix );

		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );

	#endif

	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>

}
`,Mf=`
uniform vec3 diffuse;
uniform float opacity;

#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

void main() {

	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>

	vec3 outgoingLight = vec3( 0.0 );

	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>

	outgoingLight = diffuseColor.rgb;

	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>

}
`;var _f=`
#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>

void main() {

	#include <batching_vertex>

	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>

	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>

	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>

}
`,xf=`
uniform vec3 color;
uniform float opacity;

#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>

void main() {

	#include <logdepthbuf_fragment>

	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );

	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>

}
`;var vf=`
uniform float rotation;
uniform vec2 center;

#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

void main() {

	#include <uv_vertex>

	vec4 mvPosition = modelViewMatrix[ 3 ];

	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );

	#ifndef USE_SIZEATTENUATION

		bool isPerspective = isPerspectiveMatrix( projectionMatrix );

		if ( isPerspective ) scale *= - mvPosition.z;

	#endif

	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;

	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;

	mvPosition.xy += rotatedPosition;

	gl_Position = projectionMatrix * mvPosition;

	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>

}
`,Ef=`
uniform vec3 diffuse;
uniform float opacity;

#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

void main() {

	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>

	vec3 outgoingLight = vec3( 0.0 );

	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>

	outgoingLight = diffuseColor.rgb;

	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>

}
`;var Re={alphahash_fragment:zc,alphahash_pars_fragment:Vc,alphamap_fragment:Kc,alphamap_pars_fragment:Wc,alphatest_fragment:Yc,alphatest_pars_fragment:Xc,aomap_fragment:Jc,aomap_pars_fragment:qc,batching_pars_vertex:Zc,batching_vertex:jc,begin_vertex:$c,beginnormal_vertex:el,bsdfs:tl,iridescence_fragment:il,bumpmap_pars_fragment:nl,clipping_planes_fragment:rl,clipping_planes_pars_fragment:ol,clipping_planes_pars_vertex:sl,clipping_planes_vertex:al,color_fragment:cl,color_pars_fragment:ll,color_pars_vertex:Al,color_vertex:fl,common:ul,cube_uv_reflection_fragment:hl,defaultnormal_vertex:dl,displacementmap_pars_vertex:pl,displacementmap_vertex:ml,emissivemap_fragment:gl,emissivemap_pars_fragment:Ml,colorspace_fragment:_l,colorspace_pars_fragment:xl,envmap_fragment:vl,envmap_common_pars_fragment:El,envmap_pars_fragment:wl,envmap_pars_vertex:Cl,envmap_physical_pars_fragment:Ol,envmap_vertex:Sl,fog_vertex:Pl,fog_pars_vertex:Dl,fog_fragment:yl,fog_pars_fragment:Tl,gradientmap_pars_fragment:Bl,lightmap_pars_fragment:Il,lights_lambert_fragment:bl,lights_lambert_pars_fragment:Rl,lights_pars_begin:Ll,lights_toon_fragment:Ul,lights_toon_pars_fragment:Nl,lights_phong_fragment:Fl,lights_phong_pars_fragment:Ql,lights_physical_fragment:Gl,lights_physical_pars_fragment:Hl,lights_fragment_begin:kl,lights_fragment_maps:zl,lights_fragment_end:Vl,logdepthbuf_fragment:Kl,logdepthbuf_pars_fragment:Wl,logdepthbuf_pars_vertex:Yl,logdepthbuf_vertex:Xl,map_fragment:Jl,map_pars_fragment:ql,map_particle_fragment:Zl,map_particle_pars_fragment:jl,metalnessmap_fragment:$l,metalnessmap_pars_fragment:eA,morphinstance_vertex:tA,morphcolor_vertex:iA,morphnormal_vertex:nA,morphtarget_pars_vertex:rA,morphtarget_vertex:oA,normal_fragment_begin:sA,normal_fragment_maps:aA,normal_pars_fragment:cA,normal_pars_vertex:lA,normal_vertex:AA,normalmap_pars_fragment:fA,clearcoat_normal_fragment_begin:uA,clearcoat_normal_fragment_maps:hA,clearcoat_pars_fragment:dA,iridescence_pars_fragment:pA,opaque_fragment:mA,packing:gA,premultiplied_alpha_fragment:MA,project_vertex:_A,dithering_fragment:xA,dithering_pars_fragment:vA,roughnessmap_fragment:EA,roughnessmap_pars_fragment:wA,shadowmap_pars_fragment:CA,shadowmap_pars_vertex:SA,shadowmap_vertex:PA,shadowmask_pars_fragment:DA,skinbase_vertex:yA,skinning_pars_vertex:TA,skinning_vertex:BA,skinnormal_vertex:IA,specularmap_fragment:bA,specularmap_pars_fragment:RA,tonemapping_fragment:LA,tonemapping_pars_fragment:OA,transmission_fragment:UA,transmission_pars_fragment:NA,uv_pars_fragment:FA,uv_pars_vertex:QA,uv_vertex:GA,worldpos_vertex:HA,background_vert:kA,background_frag:zA,backgroundCube_vert:VA,backgroundCube_frag:KA,cube_vert:WA,cube_frag:YA,depth_vert:XA,depth_frag:JA,distanceRGBA_vert:qA,distanceRGBA_frag:ZA,equirect_vert:jA,equirect_frag:$A,linedashed_vert:ef,linedashed_frag:tf,meshbasic_vert:nf,meshbasic_frag:rf,meshlambert_vert:of,meshlambert_frag:sf,meshmatcap_vert:af,meshmatcap_frag:cf,meshnormal_vert:lf,meshnormal_frag:Af,meshphong_vert:ff,meshphong_frag:uf,meshphysical_vert:hf,meshphysical_frag:df,meshtoon_vert:pf,meshtoon_frag:mf,points_vert:gf,points_frag:Mf,shadow_vert:_f,shadow_frag:xf,sprite_vert:vf,sprite_frag:Ef};var re={common:{diffuse:{value:new Ge(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new ye},alphaMap:{value:null},alphaMapTransform:{value:new ye},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new ye}},envmap:{envMap:{value:null},envMapRotation:{value:new ye},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new ye}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new ye}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new ye},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new ye},normalScale:{value:new Qe(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new ye},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new ye}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new ye}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new ye}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Ge(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new Ge(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new ye},alphaTest:{value:0},uvTransform:{value:new ye}},sprite:{diffuse:{value:new Ge(16777215)},opacity:{value:1},center:{value:new Qe(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new ye},alphaMap:{value:null},alphaMapTransform:{value:new ye},alphaTest:{value:0}}};var qt={basic:{uniforms:Pt([re.common,re.specularmap,re.envmap,re.aomap,re.lightmap,re.fog]),vertexShader:Re.meshbasic_vert,fragmentShader:Re.meshbasic_frag},lambert:{uniforms:Pt([re.common,re.specularmap,re.envmap,re.aomap,re.lightmap,re.emissivemap,re.bumpmap,re.normalmap,re.displacementmap,re.fog,re.lights,{emissive:{value:new Ge(0)}}]),vertexShader:Re.meshlambert_vert,fragmentShader:Re.meshlambert_frag},phong:{uniforms:Pt([re.common,re.specularmap,re.envmap,re.aomap,re.lightmap,re.emissivemap,re.bumpmap,re.normalmap,re.displacementmap,re.fog,re.lights,{emissive:{value:new Ge(0)},specular:{value:new Ge(1118481)},shininess:{value:30}}]),vertexShader:Re.meshphong_vert,fragmentShader:Re.meshphong_frag},standard:{uniforms:Pt([re.common,re.envmap,re.aomap,re.lightmap,re.emissivemap,re.bumpmap,re.normalmap,re.displacementmap,re.roughnessmap,re.metalnessmap,re.fog,re.lights,{emissive:{value:new Ge(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Re.meshphysical_vert,fragmentShader:Re.meshphysical_frag},toon:{uniforms:Pt([re.common,re.aomap,re.lightmap,re.emissivemap,re.bumpmap,re.normalmap,re.displacementmap,re.gradientmap,re.fog,re.lights,{emissive:{value:new Ge(0)}}]),vertexShader:Re.meshtoon_vert,fragmentShader:Re.meshtoon_frag},matcap:{uniforms:Pt([re.common,re.bumpmap,re.normalmap,re.displacementmap,re.fog,{matcap:{value:null}}]),vertexShader:Re.meshmatcap_vert,fragmentShader:Re.meshmatcap_frag},points:{uniforms:Pt([re.points,re.fog]),vertexShader:Re.points_vert,fragmentShader:Re.points_frag},dashed:{uniforms:Pt([re.common,re.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Re.linedashed_vert,fragmentShader:Re.linedashed_frag},depth:{uniforms:Pt([re.common,re.displacementmap]),vertexShader:Re.depth_vert,fragmentShader:Re.depth_frag},normal:{uniforms:Pt([re.common,re.bumpmap,re.normalmap,re.displacementmap,{opacity:{value:1}}]),vertexShader:Re.meshnormal_vert,fragmentShader:Re.meshnormal_frag},sprite:{uniforms:Pt([re.sprite,re.fog]),vertexShader:Re.sprite_vert,fragmentShader:Re.sprite_frag},background:{uniforms:{uvTransform:{value:new ye},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Re.background_vert,fragmentShader:Re.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new ye}},vertexShader:Re.backgroundCube_vert,fragmentShader:Re.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Re.cube_vert,fragmentShader:Re.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Re.equirect_vert,fragmentShader:Re.equirect_frag},distanceRGBA:{uniforms:Pt([re.common,re.displacementmap,{referencePosition:{value:new R},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Re.distanceRGBA_vert,fragmentShader:Re.distanceRGBA_frag},shadow:{uniforms:Pt([re.lights,re.fog,{color:{value:new Ge(0)},opacity:{value:1}}]),vertexShader:Re.shadow_vert,fragmentShader:Re.shadow_frag}};qt.physical={uniforms:Pt([qt.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new ye},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new ye},clearcoatNormalScale:{value:new Qe(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new ye},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new ye},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new ye},sheen:{value:0},sheenColor:{value:new Ge(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new ye},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new ye},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new ye},transmissionSamplerSize:{value:new Qe},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new ye},attenuationDistance:{value:0},attenuationColor:{value:new Ge(0)},specularColor:{value:new Ge(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new ye},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new ye},anisotropyVector:{value:new Qe},anisotropyMap:{value:null},anisotropyMapTransform:{value:new ye}}]),vertexShader:Re.meshphysical_vert,fragmentShader:Re.meshphysical_frag};var Xo={r:0,b:0,g:0},nn=new Ot,Dh=new We;function wf(n,e,t,i,r,o,s){let a=new Ge(0),c=o===!0?0:1,l,f,p=null,u=0,d=null;function m(w){let C=w.isScene===!0?w.background:null;return C&&C.isTexture&&(C=(w.backgroundBlurriness>0?t:e).get(C)),C}function M(w){let C=!1,v=m(w);v===null?A(a,c):v&&v.isColor&&(A(v,1),C=!0);let N=n.xr.getEnvironmentBlendMode();N==="additive"?i.buffers.color.setClear(0,0,0,1,s):N==="alpha-blend"&&i.buffers.color.setClear(0,0,0,0,s),(n.autoClear||C)&&(i.buffers.depth.setTest(!0),i.buffers.depth.setMask(!0),i.buffers.color.setMask(!0),n.clear(n.autoClearColor,n.autoClearDepth,n.autoClearStencil))}function h(w,C){let v=m(C);v&&(v.isCubeTexture||v.mapping===Oi)?(f===void 0&&(f=new ct(new ki(1,1,1),new Bt({name:"BackgroundCubeMaterial",uniforms:Ti(qt.backgroundCube.uniforms),vertexShader:qt.backgroundCube.vertexShader,fragmentShader:qt.backgroundCube.fragmentShader,side:ot,depthTest:!1,depthWrite:!1,fog:!1})),f.geometry.deleteAttribute("normal"),f.geometry.deleteAttribute("uv"),f.onBeforeRender=function(N,D,y){this.matrixWorld.copyPosition(y.matrixWorld)},Object.defineProperty(f.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),r.update(f)),nn.copy(C.backgroundRotation),nn.x*=-1,nn.y*=-1,nn.z*=-1,v.isCubeTexture&&v.isRenderTargetTexture===!1&&(nn.y*=-1,nn.z*=-1),f.material.uniforms.envMap.value=v,f.material.uniforms.flipEnvMap.value=v.isCubeTexture&&v.isRenderTargetTexture===!1?-1:1,f.material.uniforms.backgroundBlurriness.value=C.backgroundBlurriness,f.material.uniforms.backgroundIntensity.value=C.backgroundIntensity,f.material.uniforms.backgroundRotation.value.setFromMatrix4(Dh.makeRotationFromEuler(nn)),f.material.toneMapped=Ne.getTransfer(v.colorSpace)!==Ve,(p!==v||u!==v.version||d!==n.toneMapping)&&(f.material.needsUpdate=!0,p=v,u=v.version,d=n.toneMapping),f.layers.enableAll(),w.unshift(f,f.geometry,f.material,0,0,null)):v&&v.isTexture&&(l===void 0&&(l=new ct(new Vi(2,2),new Bt({name:"BackgroundMaterial",uniforms:Ti(qt.background.uniforms),vertexShader:qt.background.vertexShader,fragmentShader:qt.background.fragmentShader,side:Nt,depthTest:!1,depthWrite:!1,fog:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),r.update(l)),l.material.uniforms.t2D.value=v,l.material.uniforms.backgroundIntensity.value=C.backgroundIntensity,l.material.toneMapped=Ne.getTransfer(v.colorSpace)!==Ve,v.matrixAutoUpdate===!0&&v.updateMatrix(),l.material.uniforms.uvTransform.value.copy(v.matrix),(p!==v||u!==v.version||d!==n.toneMapping)&&(l.material.needsUpdate=!0,p=v,u=v.version,d=n.toneMapping),l.layers.enableAll(),w.unshift(l,l.geometry,l.material,0,0,null))}function A(w,C){w.getRGB(Xo,zo(n)),i.buffers.color.setClear(Xo.r,Xo.g,Xo.b,C,s)}return{getClearColor:function(){return a},setClearColor:function(w,C=1){a.set(w),c=C,A(a,c)},getClearAlpha:function(){return c},setClearAlpha:function(w){c=w,A(a,c)},render:M,addToRenderList:h}}function Cf(n,e){let t=n.getParameter(n.MAX_VERTEX_ATTRIBS),i={},r=u(null),o=r,s=!1;function a(x,P,G,O,z){let W=!1,Q=p(O,G,P);o!==Q&&(o=Q,l(o.object)),W=d(x,O,G,z),W&&m(x,O,G,z),z!==null&&e.update(z,n.ELEMENT_ARRAY_BUFFER),(W||s)&&(s=!1,v(x,P,G,O),z!==null&&n.bindBuffer(n.ELEMENT_ARRAY_BUFFER,e.get(z).buffer))}function c(){return n.createVertexArray()}function l(x){return n.bindVertexArray(x)}function f(x){return n.deleteVertexArray(x)}function p(x,P,G){let O=G.wireframe===!0,z=i[x.id];z===void 0&&(z={},i[x.id]=z);let W=z[P.id];W===void 0&&(W={},z[P.id]=W);let Q=W[O];return Q===void 0&&(Q=u(c()),W[O]=Q),Q}function u(x){let P=[],G=[],O=[];for(let z=0;z<t;z++)P[z]=0,G[z]=0,O[z]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:P,enabledAttributes:G,attributeDivisors:O,object:x,attributes:{},index:null}}function d(x,P,G,O){let z=o.attributes,W=P.attributes,Q=0,J=G.getAttributes();for(let F in J)if(J[F].location>=0){let se=z[F],oe=W[F];if(oe===void 0&&(F==="instanceMatrix"&&x.instanceMatrix&&(oe=x.instanceMatrix),F==="instanceColor"&&x.instanceColor&&(oe=x.instanceColor)),se===void 0||se.attribute!==oe||oe&&se.data!==oe.data)return!0;Q++}return o.attributesNum!==Q||o.index!==O}function m(x,P,G,O){let z={},W=P.attributes,Q=0,J=G.getAttributes();for(let F in J)if(J[F].location>=0){let se=W[F];se===void 0&&(F==="instanceMatrix"&&x.instanceMatrix&&(se=x.instanceMatrix),F==="instanceColor"&&x.instanceColor&&(se=x.instanceColor));let oe={};oe.attribute=se,se&&se.data&&(oe.data=se.data),z[F]=oe,Q++}o.attributes=z,o.attributesNum=Q,o.index=O}function M(){let x=o.newAttributes;for(let P=0,G=x.length;P<G;P++)x[P]=0}function h(x){A(x,0)}function A(x,P){let G=o.newAttributes,O=o.enabledAttributes,z=o.attributeDivisors;G[x]=1,O[x]===0&&(n.enableVertexAttribArray(x),O[x]=1),z[x]!==P&&(n.vertexAttribDivisor(x,P),z[x]=P)}function w(){let x=o.newAttributes,P=o.enabledAttributes;for(let G=0,O=P.length;G<O;G++)P[G]!==x[G]&&(n.disableVertexAttribArray(G),P[G]=0)}function C(x,P,G,O,z,W,Q){Q===!0?n.vertexAttribIPointer(x,P,G,z,W):n.vertexAttribPointer(x,P,G,O,z,W)}function v(x,P,G,O){M();let z=O.attributes,W=G.getAttributes(),Q=P.defaultAttributeValues;for(let J in W){let F=W[J];if(F.location>=0){let ee=z[J];if(ee===void 0&&(J==="instanceMatrix"&&x.instanceMatrix&&(ee=x.instanceMatrix),J==="instanceColor"&&x.instanceColor&&(ee=x.instanceColor)),ee!==void 0){let se=ee.normalized,oe=ee.itemSize,me=e.get(ee);if(me===void 0)continue;let Be=me.buffer,V=me.type,j=me.bytesPerElement,fe=V===n.INT||V===n.UNSIGNED_INT||ee.gpuType===fn;if(ee.isInterleavedBufferAttribute){let ie=ee.data,Ee=ie.stride,Se=ee.offset;if(ie.isInstancedInterleavedBuffer){for(let Pe=0;Pe<F.locationSize;Pe++)A(F.location+Pe,ie.meshPerAttribute);x.isInstancedMesh!==!0&&O._maxInstanceCount===void 0&&(O._maxInstanceCount=ie.meshPerAttribute*ie.count)}else for(let Pe=0;Pe<F.locationSize;Pe++)h(F.location+Pe);n.bindBuffer(n.ARRAY_BUFFER,Be);for(let Pe=0;Pe<F.locationSize;Pe++)C(F.location+Pe,oe/F.locationSize,V,se,Ee*j,(Se+oe/F.locationSize*Pe)*j,fe)}else{if(ee.isInstancedBufferAttribute){for(let ie=0;ie<F.locationSize;ie++)A(F.location+ie,ee.meshPerAttribute);x.isInstancedMesh!==!0&&O._maxInstanceCount===void 0&&(O._maxInstanceCount=ee.meshPerAttribute*ee.count)}else for(let ie=0;ie<F.locationSize;ie++)h(F.location+ie);n.bindBuffer(n.ARRAY_BUFFER,Be);for(let ie=0;ie<F.locationSize;ie++)C(F.location+ie,oe/F.locationSize,V,se,oe*j,oe/F.locationSize*ie*j,fe)}}else if(Q!==void 0){let se=Q[J];if(se!==void 0)switch(se.length){case 2:n.vertexAttrib2fv(F.location,se);break;case 3:n.vertexAttrib3fv(F.location,se);break;case 4:n.vertexAttrib4fv(F.location,se);break;default:n.vertexAttrib1fv(F.location,se)}}}}w()}function N(){L();for(let x in i){let P=i[x];for(let G in P){let O=P[G];for(let z in O)f(O[z].object),delete O[z];delete P[G]}delete i[x]}}function D(x){if(i[x.id]===void 0)return;let P=i[x.id];for(let G in P){let O=P[G];for(let z in O)f(O[z].object),delete O[z];delete P[G]}delete i[x.id]}function y(x){for(let P in i){let G=i[P];if(G[x.id]===void 0)continue;let O=G[x.id];for(let z in O)f(O[z].object),delete O[z];delete G[x.id]}}function L(){E(),s=!0,o!==r&&(o=r,l(o.object))}function E(){r.geometry=null,r.program=null,r.wireframe=!1}return{setup:a,reset:L,resetDefaultState:E,dispose:N,releaseStatesOfGeometry:D,releaseStatesOfProgram:y,initAttributes:M,enableAttribute:h,disableUnusedAttributes:w}}function Sf(n,e,t){let i;function r(l){i=l}function o(l,f){n.drawArrays(i,l,f),t.update(f,i,1)}function s(l,f,p){p!==0&&(n.drawArraysInstanced(i,l,f,p),t.update(f,i,p))}function a(l,f,p){if(p===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,l,0,f,0,p);let d=0;for(let m=0;m<p;m++)d+=f[m];t.update(d,i,1)}function c(l,f,p,u){if(p===0)return;let d=e.get("WEBGL_multi_draw");if(d===null)for(let m=0;m<l.length;m++)s(l[m],f[m],u[m]);else{d.multiDrawArraysInstancedWEBGL(i,l,0,f,0,u,0,p);let m=0;for(let M=0;M<p;M++)m+=f[M]*u[M];t.update(m,i,1)}}this.setMode=r,this.render=o,this.renderInstances=s,this.renderMultiDraw=a,this.renderMultiDrawInstances=c}function Pf(n,e,t,i){let r;function o(){if(r!==void 0)return r;if(e.has("EXT_texture_filter_anisotropic")===!0){let y=e.get("EXT_texture_filter_anisotropic");r=n.getParameter(y.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else r=0;return r}function s(y){return!(y!==mt&&i.convert(y)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_FORMAT))}function a(y){let L=y===hi&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(y!==Et&&i.convert(y)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_TYPE)&&y!==xt&&!L)}function c(y){if(y==="highp"){if(n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.HIGH_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.HIGH_FLOAT).precision>0)return"highp";y="mediump"}return y==="mediump"&&n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.MEDIUM_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let l=t.precision!==void 0?t.precision:"highp",f=c(l);f!==l&&(console.warn("THREE.WebGLRenderer:",l,"not supported, using",f,"instead."),l=f);let p=t.logarithmicDepthBuffer===!0,u=t.reverseDepthBuffer===!0&&e.has("EXT_clip_control"),d=n.getParameter(n.MAX_TEXTURE_IMAGE_UNITS),m=n.getParameter(n.MAX_VERTEX_TEXTURE_IMAGE_UNITS),M=n.getParameter(n.MAX_TEXTURE_SIZE),h=n.getParameter(n.MAX_CUBE_MAP_TEXTURE_SIZE),A=n.getParameter(n.MAX_VERTEX_ATTRIBS),w=n.getParameter(n.MAX_VERTEX_UNIFORM_VECTORS),C=n.getParameter(n.MAX_VARYING_VECTORS),v=n.getParameter(n.MAX_FRAGMENT_UNIFORM_VECTORS),N=m>0,D=n.getParameter(n.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:o,getMaxPrecision:c,textureFormatReadable:s,textureTypeReadable:a,precision:l,logarithmicDepthBuffer:p,reverseDepthBuffer:u,maxTextures:d,maxVertexTextures:m,maxTextureSize:M,maxCubemapSize:h,maxAttributes:A,maxVertexUniforms:w,maxVaryings:C,maxFragmentUniforms:v,vertexTextures:N,maxSamples:D}}function Df(n){let e=this,t=null,i=0,r=!1,o=!1,s=new Ai,a=new ye,c={value:null,needsUpdate:!1};this.uniform=c,this.numPlanes=0,this.numIntersection=0,this.init=function(p,u){let d=p.length!==0||u||i!==0||r;return r=u,i=p.length,d},this.beginShadows=function(){o=!0,f(null)},this.endShadows=function(){o=!1},this.setGlobalState=function(p,u){t=f(p,u,0)},this.setState=function(p,u,d){let m=p.clippingPlanes,M=p.clipIntersection,h=p.clipShadows,A=n.get(p);if(!r||m===null||m.length===0||o&&!h)o?f(null):l();else{let w=o?0:i,C=w*4,v=A.clippingState||null;c.value=v,v=f(m,u,C,d);for(let N=0;N!==C;++N)v[N]=t[N];A.clippingState=v,this.numIntersection=M?this.numPlanes:0,this.numPlanes+=w}};function l(){c.value!==t&&(c.value=t,c.needsUpdate=i>0),e.numPlanes=i,e.numIntersection=0}function f(p,u,d,m){let M=p!==null?p.length:0,h=null;if(M!==0){if(h=c.value,m!==!0||h===null){let A=d+M*4,w=u.matrixWorldInverse;a.getNormalMatrix(w),(h===null||h.length<A)&&(h=new Float32Array(A));for(let C=0,v=d;C!==M;++C,v+=4)s.copy(p[C]).applyMatrix4(w,a),s.normal.toArray(h,v),h[v+3]=s.constant}c.value=h,c.needsUpdate=!0}return e.numPlanes=M,e.numIntersection=0,h}}function yf(n){let e=new WeakMap;function t(s,a){return a===or?s.mapping=ei:a===sr&&(s.mapping=ui),s}function i(s){if(s&&s.isTexture){let a=s.mapping;if(a===or||a===sr)if(e.has(s)){let c=e.get(s).texture;return t(c,s.mapping)}else{let c=s.image;if(c&&c.height>0){let l=new Ko(c.height);return l.fromEquirectangularTexture(n,s),e.set(s,l),s.addEventListener("dispose",r),t(l.texture,s.mapping)}else return null}}return s}function r(s){let a=s.target;a.removeEventListener("dispose",r);let c=e.get(a);c!==void 0&&(e.delete(a),c.dispose())}function o(){e=new WeakMap}return{get:i,dispose:o}}var Jo=class extends Bi{constructor(e=-1,t=1,i=1,r=-1,o=.1,s=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=i,this.bottom=r,this.near=o,this.far=s,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,i,r,o,s){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=r,this.view.width=o,this.view.height=s,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),i=(this.right+this.left)/2,r=(this.top+this.bottom)/2,o=i-e,s=i+e,a=r+t,c=r-t;if(this.view!==null&&this.view.enabled){let l=(this.right-this.left)/this.view.fullWidth/this.zoom,f=(this.top-this.bottom)/this.view.fullHeight/this.zoom;o+=l*this.view.offsetX,s=o+l*this.view.width,a-=f*this.view.offsetY,c=a-f*this.view.height}this.projectionMatrix.makeOrthographic(o,s,a,c,this.near,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}};var Kn=4,Tf=[.125,.215,.35,.446,.526,.582],on=20,Ks=new Jo,Bf=new Ge,Ws=null,Ys=0,Xs=0,Js=!1,rn=(1+Math.sqrt(5))/2,Vn=1/rn,If=[new R(-rn,Vn,0),new R(rn,Vn,0),new R(-Vn,0,rn),new R(Vn,0,rn),new R(0,rn,-Vn),new R(0,rn,Vn),new R(-1,1,-1),new R(1,1,-1),new R(-1,1,1),new R(1,1,1)],Hr=class{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(e,t=0,i=.1,r=100){Ws=this._renderer.getRenderTarget(),Ys=this._renderer.getActiveCubeFace(),Xs=this._renderer.getActiveMipmapLevel(),Js=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(256);let o=this._allocateTargets();return o.depthBuffer=!0,this._sceneToCubeUV(e,i,r,o),t>0&&this._blur(o,0,0,t),this._applyPMREM(o),this._cleanup(o),o}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Lf(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Rf(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodPlanes.length;e++)this._lodPlanes[e].dispose()}_cleanup(e){this._renderer.setRenderTarget(Ws,Ys,Xs),this._renderer.xr.enabled=Js,e.scissorTest=!1,qo(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===ei||e.mapping===ui?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),Ws=this._renderer.getRenderTarget(),Ys=this._renderer.getActiveCubeFace(),Xs=this._renderer.getActiveMipmapLevel(),Js=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let i=t||this._allocateTargets();return this._textureToCubeUV(e,i),this._applyPMREM(i),this._cleanup(i),i}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,i={magFilter:Dt,minFilter:Dt,generateMipmaps:!1,type:hi,format:mt,colorSpace:ri,depthBuffer:!1},r=bf(e,t,i);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=bf(e,t,i);let{_lodMax:o}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=yh(o)),this._blurMaterial=Th(o,e,t)}return r}_compileMaterial(e){let t=new ct(this._lodPlanes[0],e);this._renderer.compile(t,Ks)}_sceneToCubeUV(e,t,i,r){let a=new ft(90,1,t,i),c=[1,-1,1,1,1,1],l=[1,1,1,-1,-1,-1],f=this._renderer,p=f.autoClear,u=f.toneMapping;f.getClearColor(Bf),f.toneMapping=Vt,f.autoClear=!1;let d=new Yt({name:"PMREM.Background",side:ot,depthWrite:!1,depthTest:!1}),m=new ct(new ki,d),M=!1,h=e.background;h?h.isColor&&(d.color.copy(h),e.background=null,M=!0):(d.color.copy(Bf),M=!0);for(let A=0;A<6;A++){let w=A%3;w===0?(a.up.set(0,c[A],0),a.lookAt(l[A],0,0)):w===1?(a.up.set(0,0,c[A]),a.lookAt(0,l[A],0)):(a.up.set(0,c[A],0),a.lookAt(0,0,l[A]));let C=this._cubeSize;qo(r,w*C,A>2?C:0,C,C),f.setRenderTarget(r),M&&f.render(m,a),f.render(e,a)}m.geometry.dispose(),m.material.dispose(),f.toneMapping=u,f.autoClear=p,e.background=h}_textureToCubeUV(e,t){let i=this._renderer,r=e.mapping===ei||e.mapping===ui;r?(this._cubemapMaterial===null&&(this._cubemapMaterial=Lf()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Rf());let o=r?this._cubemapMaterial:this._equirectMaterial,s=new ct(this._lodPlanes[0],o),a=o.uniforms;a.envMap.value=e;let c=this._cubeSize;qo(t,0,0,3*c,2*c),i.setRenderTarget(t),i.render(s,Ks)}_applyPMREM(e){let t=this._renderer,i=t.autoClear;t.autoClear=!1;let r=this._lodPlanes.length;for(let o=1;o<r;o++){let s=Math.sqrt(this._sigmas[o]*this._sigmas[o]-this._sigmas[o-1]*this._sigmas[o-1]),a=If[(r-o-1)%If.length];this._blur(e,o-1,o,s,a)}t.autoClear=i}_blur(e,t,i,r,o){let s=this._pingPongRenderTarget;this._halfBlur(e,s,t,i,r,"latitudinal",o),this._halfBlur(s,e,i,i,r,"longitudinal",o)}_halfBlur(e,t,i,r,o,s,a){let c=this._renderer,l=this._blurMaterial;s!=="latitudinal"&&s!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");let f=3,p=new ct(this._lodPlanes[r],l),u=l.uniforms,d=this._sizeLods[i]-1,m=isFinite(o)?Math.PI/(2*d):2*Math.PI/(2*on-1),M=o/m,h=isFinite(o)?1+Math.floor(f*M):on;h>on&&console.warn(`sigmaRadians, ${o}, is too large and will clip, as it requested ${h} samples when the maximum is set to ${on}`);let A=[],w=0;for(let y=0;y<on;++y){let L=y/M,E=Math.exp(-L*L/2);A.push(E),y===0?w+=E:y<h&&(w+=2*E)}for(let y=0;y<A.length;y++)A[y]=A[y]/w;u.envMap.value=e.texture,u.samples.value=h,u.weights.value=A,u.latitudinal.value=s==="latitudinal",a&&(u.poleAxis.value=a);let{_lodMax:C}=this;u.dTheta.value=m,u.mipInt.value=C-i;let v=this._sizeLods[r],N=3*v*(r>C-Kn?r-C+Kn:0),D=4*(this._cubeSize-v);qo(t,N,D,3*v,2*v),c.setRenderTarget(t),c.render(p,Ks)}};function yh(n){let e=[],t=[],i=[],r=n,o=n-Kn+1+Tf.length;for(let s=0;s<o;s++){let a=Math.pow(2,r);t.push(a);let c=1/a;s>n-Kn?c=Tf[s-n+Kn-1]:s===0&&(c=0),i.push(c);let l=1/(a-2),f=-l,p=1+l,u=[f,f,p,f,p,p,f,f,p,p,f,p],d=6,m=6,M=3,h=2,A=1,w=new Float32Array(M*m*d),C=new Float32Array(h*m*d),v=new Float32Array(A*m*d);for(let D=0;D<d;D++){let y=D%3*2/3-1,L=D>2?0:-1,E=[y,L,0,y+2/3,L,0,y+2/3,L+1,0,y,L,0,y+2/3,L+1,0,y,L+1,0];w.set(E,M*m*D),C.set(u,h*m*D);let x=[D,D,D,D,D,D];v.set(x,A*m*D)}let N=new Mt;N.setAttribute("position",new rt(w,M)),N.setAttribute("uv",new rt(C,h)),N.setAttribute("faceIndex",new rt(v,A)),e.push(N),r>Kn&&r--}return{lodPlanes:e,sizeLods:t,sigmas:i}}function bf(n,e,t){let i=new Lt(n,e,t);return i.texture.mapping=Oi,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function qo(n,e,t,i,r){n.viewport.set(e,t,i,r),n.scissor.set(e,t,i,r)}function Th(n,e,t){let i=new Float32Array(on),r=new R(0,1,0);return new Bt({name:"SphericalGaussianBlur",defines:{n:on,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${n}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:i},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:r}},vertexShader:qs(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:zt,depthTest:!1,depthWrite:!1})}function Rf(){return new Bt({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:qs(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:zt,depthTest:!1,depthWrite:!1})}function Lf(){return new Bt({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:qs(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:zt,depthTest:!1,depthWrite:!1})}function qs(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function Of(n){let e=new WeakMap,t=null;function i(a){if(a&&a.isTexture){let c=a.mapping,l=c===or||c===sr,f=c===ei||c===ui;if(l||f){let p=e.get(a),u=p!==void 0?p.texture.pmremVersion:0;if(a.isRenderTargetTexture&&a.pmremVersion!==u)return t===null&&(t=new Hr(n)),p=l?t.fromEquirectangular(a,p):t.fromCubemap(a,p),p.texture.pmremVersion=a.pmremVersion,e.set(a,p),p.texture;if(p!==void 0)return p.texture;{let d=a.image;return l&&d&&d.height>0||f&&d&&r(d)?(t===null&&(t=new Hr(n)),p=l?t.fromEquirectangular(a):t.fromCubemap(a),p.texture.pmremVersion=a.pmremVersion,e.set(a,p),a.addEventListener("dispose",o),p.texture):null}}}return a}function r(a){let c=0,l=6;for(let f=0;f<l;f++)a[f]!==void 0&&c++;return c===l}function o(a){let c=a.target;c.removeEventListener("dispose",o);let l=e.get(c);l!==void 0&&(e.delete(c),l.dispose())}function s(){e=new WeakMap,t!==null&&(t.dispose(),t=null)}return{get:i,dispose:s}}function Uf(n){let e={};function t(i){if(e[i]!==void 0)return e[i];let r;switch(i){case"WEBGL_depth_texture":r=n.getExtension("WEBGL_depth_texture")||n.getExtension("MOZ_WEBGL_depth_texture")||n.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":r=n.getExtension("EXT_texture_filter_anisotropic")||n.getExtension("MOZ_EXT_texture_filter_anisotropic")||n.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":r=n.getExtension("WEBGL_compressed_texture_s3tc")||n.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||n.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":r=n.getExtension("WEBGL_compressed_texture_pvrtc")||n.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:r=n.getExtension(i)}return e[i]=r,r}return{has:function(i){return t(i)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(i){let r=t(i);return r===null&&qi("THREE.WebGLRenderer: "+i+" extension not supported."),r}}}function Nf(n,e,t,i){let r={},o=new WeakMap;function s(p){let u=p.target;u.index!==null&&e.remove(u.index);for(let m in u.attributes)e.remove(u.attributes[m]);for(let m in u.morphAttributes){let M=u.morphAttributes[m];for(let h=0,A=M.length;h<A;h++)e.remove(M[h])}u.removeEventListener("dispose",s),delete r[u.id];let d=o.get(u);d&&(e.remove(d),o.delete(u)),i.releaseStatesOfGeometry(u),u.isInstancedBufferGeometry===!0&&delete u._maxInstanceCount,t.memory.geometries--}function a(p,u){return r[u.id]===!0||(u.addEventListener("dispose",s),r[u.id]=!0,t.memory.geometries++),u}function c(p){let u=p.attributes;for(let m in u)e.update(u[m],n.ARRAY_BUFFER);let d=p.morphAttributes;for(let m in d){let M=d[m];for(let h=0,A=M.length;h<A;h++)e.update(M[h],n.ARRAY_BUFFER)}}function l(p){let u=[],d=p.index,m=p.attributes.position,M=0;if(d!==null){let w=d.array;M=d.version;for(let C=0,v=w.length;C<v;C+=3){let N=w[C+0],D=w[C+1],y=w[C+2];u.push(N,D,D,y,y,N)}}else if(m!==void 0){let w=m.array;M=m.version;for(let C=0,v=w.length/3-1;C<v;C+=3){let N=C+0,D=C+1,y=C+2;u.push(N,D,D,y,y,N)}}else return;let h=new(Eo(u)?Fn:Nn)(u,1);h.version=M;let A=o.get(p);A&&e.remove(A),o.set(p,h)}function f(p){let u=o.get(p);if(u){let d=p.index;d!==null&&u.version<d.version&&l(p)}else l(p);return o.get(p)}return{get:a,update:c,getWireframeAttribute:f}}function Ff(n,e,t){let i;function r(u){i=u}let o,s;function a(u){o=u.type,s=u.bytesPerElement}function c(u,d){n.drawElements(i,d,o,u*s),t.update(d,i,1)}function l(u,d,m){m!==0&&(n.drawElementsInstanced(i,d,o,u*s,m),t.update(d,i,m))}function f(u,d,m){if(m===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,d,0,o,u,0,m);let h=0;for(let A=0;A<m;A++)h+=d[A];t.update(h,i,1)}function p(u,d,m,M){if(m===0)return;let h=e.get("WEBGL_multi_draw");if(h===null)for(let A=0;A<u.length;A++)l(u[A]/s,d[A],M[A]);else{h.multiDrawElementsInstancedWEBGL(i,d,0,o,u,0,M,0,m);let A=0;for(let w=0;w<m;w++)A+=d[w]*M[w];t.update(A,i,1)}}this.setMode=r,this.setIndex=a,this.render=c,this.renderInstances=l,this.renderMultiDraw=f,this.renderMultiDrawInstances=p}function Qf(n){let e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function i(o,s,a){switch(t.calls++,s){case n.TRIANGLES:t.triangles+=a*(o/3);break;case n.LINES:t.lines+=a*(o/2);break;case n.LINE_STRIP:t.lines+=a*(o-1);break;case n.LINE_LOOP:t.lines+=a*o;break;case n.POINTS:t.points+=a*o;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",s);break}}function r(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:r,update:i}}function Gf(n,e,t){let i=new WeakMap,r=new et;function o(s,a,c){let l=s.morphTargetInfluences,f=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,p=f!==void 0?f.length:0,u=i.get(a);if(u===void 0||u.count!==p){let E=function(){y.dispose(),i.delete(a),a.removeEventListener("dispose",E)};u!==void 0&&u.texture.dispose();let d=a.morphAttributes.position!==void 0,m=a.morphAttributes.normal!==void 0,M=a.morphAttributes.color!==void 0,h=a.morphAttributes.position||[],A=a.morphAttributes.normal||[],w=a.morphAttributes.color||[],C=0;d===!0&&(C=1),m===!0&&(C=2),M===!0&&(C=3);let v=a.attributes.position.count*C,N=1;v>e.maxTextureSize&&(N=Math.ceil(v/e.maxTextureSize),v=e.maxTextureSize);let D=new Float32Array(v*N*4*p),y=new Dn(D,v,N,p);y.type=xt,y.needsUpdate=!0;let L=C*4;for(let x=0;x<p;x++){let P=h[x],G=A[x],O=w[x],z=v*N*4*x;for(let W=0;W<P.count;W++){let Q=W*L;d===!0&&(r.fromBufferAttribute(P,W),D[z+Q+0]=r.x,D[z+Q+1]=r.y,D[z+Q+2]=r.z,D[z+Q+3]=0),m===!0&&(r.fromBufferAttribute(G,W),D[z+Q+4]=r.x,D[z+Q+5]=r.y,D[z+Q+6]=r.z,D[z+Q+7]=0),M===!0&&(r.fromBufferAttribute(O,W),D[z+Q+8]=r.x,D[z+Q+9]=r.y,D[z+Q+10]=r.z,D[z+Q+11]=O.itemSize===4?r.w:1)}}u={count:p,texture:y,size:new Qe(v,N)},i.set(a,u),a.addEventListener("dispose",E)}if(s.isInstancedMesh===!0&&s.morphTexture!==null)c.getUniforms().setValue(n,"morphTexture",s.morphTexture,t);else{let d=0;for(let M=0;M<l.length;M++)d+=l[M];let m=a.morphTargetsRelative?1:1-d;c.getUniforms().setValue(n,"morphTargetBaseInfluence",m),c.getUniforms().setValue(n,"morphTargetInfluences",l)}c.getUniforms().setValue(n,"morphTargetsTexture",u.texture,t),c.getUniforms().setValue(n,"morphTargetsTextureSize",u.size)}return{update:o}}function Hf(n,e,t,i){let r=new WeakMap;function o(c){let l=i.render.frame,f=c.geometry,p=e.get(c,f);if(r.get(p)!==l&&(e.update(p),r.set(p,l)),c.isInstancedMesh&&(c.hasEventListener("dispose",a)===!1&&c.addEventListener("dispose",a),r.get(c)!==l&&(t.update(c.instanceMatrix,n.ARRAY_BUFFER),c.instanceColor!==null&&t.update(c.instanceColor,n.ARRAY_BUFFER),r.set(c,l))),c.isSkinnedMesh){let u=c.skeleton;r.get(u)!==l&&(u.update(),r.set(u,l))}return p}function s(){r=new WeakMap}function a(c){let l=c.target;l.removeEventListener("dispose",a),t.remove(l.instanceMatrix),l.instanceColor!==null&&t.remove(l.instanceColor)}return{update:o,dispose:s}}var Wn=class extends st{constructor(e,t,i,r,o,s,a,c,l,f=di){if(f!==di&&f!==pi)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");i===void 0&&f===di&&(i=Ft),i===void 0&&f===pi&&(i=ni),super(null,r,o,s,a,c,f,i,l),this.isDepthTexture=!0,this.image={width:e,height:t},this.magFilter=a!==void 0?a:ut,this.minFilter=c!==void 0?c:ut,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}};var Jf=new st,kf=new Wn(1,1),qf=new Dn,Zf=new So,jf=new kn,zf=[],Vf=[],Kf=new Float32Array(16),Wf=new Float32Array(9),Yf=new Float32Array(4);function Yn(n,e,t){let i=n[0];if(i<=0||i>0)return n;let r=e*t,o=zf[r];if(o===void 0&&(o=new Float32Array(r),zf[r]=o),e!==0){i.toArray(o,0);for(let s=1,a=0;s!==e;++s)a+=t,n[s].toArray(o,a)}return o}function dt(n,e){if(n.length!==e.length)return!1;for(let t=0,i=n.length;t<i;t++)if(n[t]!==e[t])return!1;return!0}function pt(n,e){for(let t=0,i=e.length;t<i;t++)n[t]=e[t]}function Zo(n,e){let t=Vf[e];t===void 0&&(t=new Int32Array(e),Vf[e]=t);for(let i=0;i!==e;++i)t[i]=n.allocateTextureUnit();return t}function Bh(n,e){let t=this.cache;t[0]!==e&&(n.uniform1f(this.addr,e),t[0]=e)}function Ih(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(dt(t,e))return;n.uniform2fv(this.addr,e),pt(t,e)}}function bh(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(n.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(dt(t,e))return;n.uniform3fv(this.addr,e),pt(t,e)}}function Rh(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(dt(t,e))return;n.uniform4fv(this.addr,e),pt(t,e)}}function Lh(n,e){let t=this.cache,i=e.elements;if(i===void 0){if(dt(t,e))return;n.uniformMatrix2fv(this.addr,!1,e),pt(t,e)}else{if(dt(t,i))return;Yf.set(i),n.uniformMatrix2fv(this.addr,!1,Yf),pt(t,i)}}function Oh(n,e){let t=this.cache,i=e.elements;if(i===void 0){if(dt(t,e))return;n.uniformMatrix3fv(this.addr,!1,e),pt(t,e)}else{if(dt(t,i))return;Wf.set(i),n.uniformMatrix3fv(this.addr,!1,Wf),pt(t,i)}}function Uh(n,e){let t=this.cache,i=e.elements;if(i===void 0){if(dt(t,e))return;n.uniformMatrix4fv(this.addr,!1,e),pt(t,e)}else{if(dt(t,i))return;Kf.set(i),n.uniformMatrix4fv(this.addr,!1,Kf),pt(t,i)}}function Nh(n,e){let t=this.cache;t[0]!==e&&(n.uniform1i(this.addr,e),t[0]=e)}function Fh(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(dt(t,e))return;n.uniform2iv(this.addr,e),pt(t,e)}}function Qh(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(dt(t,e))return;n.uniform3iv(this.addr,e),pt(t,e)}}function Gh(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(dt(t,e))return;n.uniform4iv(this.addr,e),pt(t,e)}}function Hh(n,e){let t=this.cache;t[0]!==e&&(n.uniform1ui(this.addr,e),t[0]=e)}function kh(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(dt(t,e))return;n.uniform2uiv(this.addr,e),pt(t,e)}}function zh(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(dt(t,e))return;n.uniform3uiv(this.addr,e),pt(t,e)}}function Vh(n,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(dt(t,e))return;n.uniform4uiv(this.addr,e),pt(t,e)}}function Kh(n,e,t){let i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r);let o;this.type===n.SAMPLER_2D_SHADOW?(kf.compareFunction=_o,o=kf):o=Jf,t.setTexture2D(e||o,r)}function Wh(n,e,t){let i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTexture3D(e||Zf,r)}function Yh(n,e,t){let i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTextureCube(e||jf,r)}function Xh(n,e,t){let i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTexture2DArray(e||qf,r)}function Jh(n){switch(n){case 5126:return Bh;case 35664:return Ih;case 35665:return bh;case 35666:return Rh;case 35674:return Lh;case 35675:return Oh;case 35676:return Uh;case 5124:case 35670:return Nh;case 35667:case 35671:return Fh;case 35668:case 35672:return Qh;case 35669:case 35673:return Gh;case 5125:return Hh;case 36294:return kh;case 36295:return zh;case 36296:return Vh;case 35678:case 36198:case 36298:case 36306:case 35682:return Kh;case 35679:case 36299:case 36307:return Wh;case 35680:case 36300:case 36308:case 36293:return Yh;case 36289:case 36303:case 36311:case 36292:return Xh}}function qh(n,e){n.uniform1fv(this.addr,e)}function Zh(n,e){let t=Yn(e,this.size,2);n.uniform2fv(this.addr,t)}function jh(n,e){let t=Yn(e,this.size,3);n.uniform3fv(this.addr,t)}function $h(n,e){let t=Yn(e,this.size,4);n.uniform4fv(this.addr,t)}function ed(n,e){let t=Yn(e,this.size,4);n.uniformMatrix2fv(this.addr,!1,t)}function td(n,e){let t=Yn(e,this.size,9);n.uniformMatrix3fv(this.addr,!1,t)}function id(n,e){let t=Yn(e,this.size,16);n.uniformMatrix4fv(this.addr,!1,t)}function nd(n,e){n.uniform1iv(this.addr,e)}function rd(n,e){n.uniform2iv(this.addr,e)}function od(n,e){n.uniform3iv(this.addr,e)}function sd(n,e){n.uniform4iv(this.addr,e)}function ad(n,e){n.uniform1uiv(this.addr,e)}function cd(n,e){n.uniform2uiv(this.addr,e)}function ld(n,e){n.uniform3uiv(this.addr,e)}function Ad(n,e){n.uniform4uiv(this.addr,e)}function fd(n,e,t){let i=this.cache,r=e.length,o=Zo(t,r);dt(i,o)||(n.uniform1iv(this.addr,o),pt(i,o));for(let s=0;s!==r;++s)t.setTexture2D(e[s]||Jf,o[s])}function ud(n,e,t){let i=this.cache,r=e.length,o=Zo(t,r);dt(i,o)||(n.uniform1iv(this.addr,o),pt(i,o));for(let s=0;s!==r;++s)t.setTexture3D(e[s]||Zf,o[s])}function hd(n,e,t){let i=this.cache,r=e.length,o=Zo(t,r);dt(i,o)||(n.uniform1iv(this.addr,o),pt(i,o));for(let s=0;s!==r;++s)t.setTextureCube(e[s]||jf,o[s])}function dd(n,e,t){let i=this.cache,r=e.length,o=Zo(t,r);dt(i,o)||(n.uniform1iv(this.addr,o),pt(i,o));for(let s=0;s!==r;++s)t.setTexture2DArray(e[s]||qf,o[s])}function pd(n){switch(n){case 5126:return qh;case 35664:return Zh;case 35665:return jh;case 35666:return $h;case 35674:return ed;case 35675:return td;case 35676:return id;case 5124:case 35670:return nd;case 35667:case 35671:return rd;case 35668:case 35672:return od;case 35669:case 35673:return sd;case 5125:return ad;case 36294:return cd;case 36295:return ld;case 36296:return Ad;case 35678:case 36198:case 36298:case 36306:case 35682:return fd;case 35679:case 36299:case 36307:return ud;case 35680:case 36300:case 36308:case 36293:return hd;case 36289:case 36303:case 36311:case 36292:return dd}}var js=class{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.setValue=Jh(t.type)}},$s=class{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=pd(t.type)}},ea=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,i){let r=this.seq;for(let o=0,s=r.length;o!==s;++o){let a=r[o];a.setValue(e,t[a.id],i)}}},Zs=/(\w+)(\])?(\[|\.)?/g;function Xf(n,e){n.seq.push(e),n.map[e.id]=e}function md(n,e,t){let i=n.name,r=i.length;for(Zs.lastIndex=0;;){let o=Zs.exec(i),s=Zs.lastIndex,a=o[1],c=o[2]==="]",l=o[3];if(c&&(a=a|0),l===void 0||l==="["&&s+2===r){Xf(t,l===void 0?new js(a,n,e):new $s(a,n,e));break}else{let p=t.map[a];p===void 0&&(p=new ea(a),Xf(t,p)),t=p}}}var Ki=class{constructor(e,t){this.seq=[],this.map={};let i=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let r=0;r<i;++r){let o=e.getActiveUniform(t,r),s=e.getUniformLocation(t,o.name);md(o,s,this)}}setValue(e,t,i,r){let o=this.map[t];o!==void 0&&o.setValue(e,i,r)}setOptional(e,t,i){let r=t[i];r!==void 0&&this.setValue(e,i,r)}static upload(e,t,i,r){for(let o=0,s=t.length;o!==s;++o){let a=t[o],c=i[a.id];c.needsUpdate!==!1&&a.setValue(e,c.value,r)}}static seqWithValue(e,t){let i=[];for(let r=0,o=e.length;r!==o;++r){let s=e[r];s.id in t&&i.push(s)}return i}};function ta(n,e,t){let i=n.createShader(e);return n.shaderSource(i,t),n.compileShader(i),i}var gd=37297,Md=0;function _d(n,e){let t=n.split(`
`),i=[],r=Math.max(e-6,0),o=Math.min(e+6,t.length);for(let s=r;s<o;s++){let a=s+1;i.push(`${a===e?">":" "} ${a}: ${t[s]}`)}return i.join(`
`)}var $f=new ye;function xd(n){Ne._getMatrix($f,Ne.workingColorSpace,n);let e=`mat3( ${$f.elements.map(t=>t.toFixed(4))} )`;switch(Ne.getTransfer(n)){case Yi:return[e,"LinearTransferOETF"];case Ve:return[e,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space: ",n),[e,"LinearTransferOETF"]}}function eu(n,e,t){let i=n.getShaderParameter(e,n.COMPILE_STATUS),r=n.getShaderInfoLog(e).trim();if(i&&r==="")return"";let o=/ERROR: 0:(\d+)/.exec(r);if(o){let s=parseInt(o[1]);return t.toUpperCase()+`

`+r+`

`+_d(n.getShaderSource(e),s)}else return r}function vd(n,e){let t=xd(e);return[`vec4 ${n}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}function Ed(n,e){let t;switch(e){case Wa:t="Linear";break;case Ya:t="Reinhard";break;case Xa:t="Cineon";break;case Ja:t="ACESFilmic";break;case Za:t="AgX";break;case ja:t="Neutral";break;case qa:t="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",e),t="Linear"}return"vec3 "+n+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}var jo=new R;function wd(){Ne.getLuminanceCoefficients(jo);let n=jo.x.toFixed(4),e=jo.y.toFixed(4),t=jo.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${n}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function Cd(n){return[n.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",n.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(kr).join(`
`)}function Sd(n){let e=[];for(let t in n){let i=n[t];i!==!1&&e.push("#define "+t+" "+i)}return e.join(`
`)}function Pd(n,e){let t={},i=n.getProgramParameter(e,n.ACTIVE_ATTRIBUTES);for(let r=0;r<i;r++){let o=n.getActiveAttrib(e,r),s=o.name,a=1;o.type===n.FLOAT_MAT2&&(a=2),o.type===n.FLOAT_MAT3&&(a=3),o.type===n.FLOAT_MAT4&&(a=4),t[s]={type:o.type,location:n.getAttribLocation(e,s),locationSize:a}}return t}function kr(n){return n!==""}function tu(n,e){let t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return n.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function iu(n,e){return n.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}var Dd=/^[ \t]*#include +<([\w\d./]+)>/gm;function ia(n){return n.replace(Dd,Td)}var yd=new Map;function Td(n,e){let t=Re[e];if(t===void 0){let i=yd.get(e);if(i!==void 0)t=Re[i],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,i);else throw new Error("Can not resolve #include <"+e+">")}return ia(t)}var Bd=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function nu(n){return n.replace(Bd,Id)}function Id(n,e,t,i){let r="";for(let o=parseInt(e);o<parseInt(t);o++)r+=i.replace(/\[\s*i\s*\]/g,"[ "+o+" ]").replace(/UNROLLED_LOOP_INDEX/g,o);return r}function ru(n){let e=`precision ${n.precision} float;
	precision ${n.precision} int;
	precision ${n.precision} sampler2D;
	precision ${n.precision} samplerCube;
	precision ${n.precision} sampler3D;
	precision ${n.precision} sampler2DArray;
	precision ${n.precision} sampler2DShadow;
	precision ${n.precision} samplerCubeShadow;
	precision ${n.precision} sampler2DArrayShadow;
	precision ${n.precision} isampler2D;
	precision ${n.precision} isampler3D;
	precision ${n.precision} isamplerCube;
	precision ${n.precision} isampler2DArray;
	precision ${n.precision} usampler2D;
	precision ${n.precision} usampler3D;
	precision ${n.precision} usamplerCube;
	precision ${n.precision} usampler2DArray;
	`;return n.precision==="highp"?e+=`
#define HIGH_PRECISION`:n.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:n.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}function bd(n){let e="SHADOWMAP_TYPE_BASIC";return n.shadowMapType===$r?e="SHADOWMAP_TYPE_PCF":n.shadowMapType===Sa?e="SHADOWMAP_TYPE_PCF_SOFT":n.shadowMapType===$t&&(e="SHADOWMAP_TYPE_VSM"),e}function Rd(n){let e="ENVMAP_TYPE_CUBE";if(n.envMap)switch(n.envMapMode){case ei:case ui:e="ENVMAP_TYPE_CUBE";break;case Oi:e="ENVMAP_TYPE_CUBE_UV";break}return e}function Ld(n){let e="ENVMAP_MODE_REFLECTION";return n.envMap&&n.envMapMode===ui&&(e="ENVMAP_MODE_REFRACTION"),e}function Od(n){let e="ENVMAP_BLENDING_NONE";if(n.envMap)switch(n.combine){case ao:e="ENVMAP_BLENDING_MULTIPLY";break;case Va:e="ENVMAP_BLENDING_MIX";break;case Ka:e="ENVMAP_BLENDING_ADD";break}return e}function Ud(n){let e=n.envMapCubeUVHeight;if(e===null)return null;let t=Math.log2(e)-2,i=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:i,maxMip:t}}function ou(n,e,t,i){let r=n.getContext(),o=t.defines,s=t.vertexShader,a=t.fragmentShader,c=bd(t),l=Rd(t),f=Ld(t),p=Od(t),u=Ud(t),d=Cd(t),m=Sd(o),M=r.createProgram(),h,A,w=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(h=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,m].filter(kr).join(`
`),h.length>0&&(h+=`
`),A=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,m].filter(kr).join(`
`),A.length>0&&(A+=`
`)):(h=[ru(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,m,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+f:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+c:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",t.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(kr).join(`
`),A=[ru(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,m,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+l:"",t.envMap?"#define "+f:"",t.envMap?"#define "+p:"",u?"#define CUBEUV_TEXEL_WIDTH "+u.texelWidth:"",u?"#define CUBEUV_TEXEL_HEIGHT "+u.texelHeight:"",u?"#define CUBEUV_MAX_MIP "+u.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor||t.batchingColor?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+c:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",t.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==Vt?"#define TONE_MAPPING":"",t.toneMapping!==Vt?Re.tonemapping_pars_fragment:"",t.toneMapping!==Vt?Ed("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",Re.colorspace_pars_fragment,vd("linearToOutputTexel",t.outputColorSpace),wd(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(kr).join(`
`)),s=ia(s),s=tu(s,t),s=iu(s,t),a=ia(a),a=tu(a,t),a=iu(a,t),s=nu(s),a=nu(a),t.isRawShaderMaterial!==!0&&(w=`#version 300 es
`,h=[d,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+h,A=["#define varying in",t.glslVersion===Cs?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===Cs?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+A);let C=w+h+s,v=w+A+a,N=ta(r,r.VERTEX_SHADER,C),D=ta(r,r.FRAGMENT_SHADER,v);r.attachShader(M,N),r.attachShader(M,D),t.index0AttributeName!==void 0?r.bindAttribLocation(M,0,t.index0AttributeName):t.morphTargets===!0&&r.bindAttribLocation(M,0,"position"),r.linkProgram(M);function y(P){if(n.debug.checkShaderErrors){let G=r.getProgramInfoLog(M).trim(),O=r.getShaderInfoLog(N).trim(),z=r.getShaderInfoLog(D).trim(),W=!0,Q=!0;if(r.getProgramParameter(M,r.LINK_STATUS)===!1)if(W=!1,typeof n.debug.onShaderError=="function")n.debug.onShaderError(r,M,N,D);else{let J=eu(r,N,"vertex"),F=eu(r,D,"fragment");console.error("THREE.WebGLProgram: Shader Error "+r.getError()+" - VALIDATE_STATUS "+r.getProgramParameter(M,r.VALIDATE_STATUS)+`

Material Name: `+P.name+`
Material Type: `+P.type+`

Program Info Log: `+G+`
`+J+`
`+F)}else G!==""?console.warn("THREE.WebGLProgram: Program Info Log:",G):(O===""||z==="")&&(Q=!1);Q&&(P.diagnostics={runnable:W,programLog:G,vertexShader:{log:O,prefix:h},fragmentShader:{log:z,prefix:A}})}r.deleteShader(N),r.deleteShader(D),L=new Ki(r,M),E=Pd(r,M)}let L;this.getUniforms=function(){return L===void 0&&y(this),L};let E;this.getAttributes=function(){return E===void 0&&y(this),E};let x=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return x===!1&&(x=r.getProgramParameter(M,gd)),x},this.destroy=function(){i.releaseStatesOfProgram(this),r.deleteProgram(M),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=Md++,this.cacheKey=e,this.usedTimes=1,this.program=M,this.vertexShader=N,this.fragmentShader=D,this}var Nd=0,$o=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e){let t=e.vertexShader,i=e.fragmentShader,r=this._getShaderStage(t),o=this._getShaderStage(i),s=this._getShaderCacheForMaterial(e);return s.has(r)===!1&&(s.add(r),r.usedTimes++),s.has(o)===!1&&(s.add(o),o.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let i of t)i.usedTimes--,i.usedTimes===0&&this.shaderCache.delete(i.code);return this.materialCache.delete(e),this}getVertexShaderID(e){return this._getShaderStage(e.vertexShader).id}getFragmentShaderID(e){return this._getShaderStage(e.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,i=t.get(e);return i===void 0&&(i=new Set,t.set(e,i)),i}_getShaderStage(e){let t=this.shaderCache,i=t.get(e);return i===void 0&&(i=new na(e),t.set(e,i)),i}},na=class{constructor(e){this.id=Nd++,this.code=e,this.usedTimes=0}};function su(n,e,t,i,r,o,s){let a=new bn,c=new $o,l=new Set,f=[],p=r.logarithmicDepthBuffer,u=r.vertexTextures,d=r.precision,m={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function M(E){return l.add(E),E===0?"uv":`uv${E}`}function h(E,x,P,G,O){let z=G.fog,W=O.geometry,Q=E.isMeshStandardMaterial?G.environment:null,J=(E.isMeshStandardMaterial?t:e).get(E.envMap||Q),F=J&&J.mapping===Oi?J.image.height:null,ee=m[E.type];E.precision!==null&&(d=r.getMaxPrecision(E.precision),d!==E.precision&&console.warn("THREE.WebGLProgram.getParameters:",E.precision,"not supported, using",d,"instead."));let se=W.morphAttributes.position||W.morphAttributes.normal||W.morphAttributes.color,oe=se!==void 0?se.length:0,me=0;W.morphAttributes.position!==void 0&&(me=1),W.morphAttributes.normal!==void 0&&(me=2),W.morphAttributes.color!==void 0&&(me=3);let Be,V,j,fe;if(ee){let $e=qt[ee];Be=$e.vertexShader,V=$e.fragmentShader}else Be=E.vertexShader,V=E.fragmentShader,c.update(E),j=c.getVertexShaderID(E),fe=c.getFragmentShaderID(E);let ie=n.getRenderTarget(),Ee=n.state.buffers.depth.getReversed(),Se=O.isInstancedMesh===!0,Pe=O.isBatchedMesh===!0,Ye=!!E.map,Te=!!E.matcap,ze=!!J,B=!!E.aoMap,Xe=!!E.lightMap,Fe=!!E.bumpMap,Le=!!E.normalMap,ge=!!E.displacementMap,je=!!E.emissiveMap,we=!!E.metalnessMap,S=!!E.roughnessMap,g=E.anisotropy>0,U=E.clearcoat>0,X=E.dispersion>0,Z=E.iridescence>0,Y=E.sheen>0,pe=E.transmission>0,ne=g&&!!E.anisotropyMap,ce=U&&!!E.clearcoatMap,He=U&&!!E.clearcoatNormalMap,$=U&&!!E.clearcoatRoughnessMap,de=Z&&!!E.iridescenceMap,Ce=Z&&!!E.iridescenceThicknessMap,De=Y&&!!E.sheenColorMap,he=Y&&!!E.sheenRoughnessMap,ke=!!E.specularMap,be=!!E.specularColorMap,Je=!!E.specularIntensityMap,T=pe&&!!E.transmissionMap,ae=pe&&!!E.thicknessMap,K=!!E.gradientMap,q=!!E.alphaMap,ue=E.alphaTest>0,le=!!E.alphaHash,Oe=!!E.extensions,at=Vt;E.toneMapped&&(ie===null||ie.isXRRenderTarget===!0)&&(at=n.toneMapping);let vt={shaderID:ee,shaderType:E.type,shaderName:E.name,vertexShader:Be,fragmentShader:V,defines:E.defines,customVertexShaderID:j,customFragmentShaderID:fe,isRawShaderMaterial:E.isRawShaderMaterial===!0,glslVersion:E.glslVersion,precision:d,batching:Pe,batchingColor:Pe&&O._colorsTexture!==null,instancing:Se,instancingColor:Se&&O.instanceColor!==null,instancingMorph:Se&&O.morphTexture!==null,supportsVertexTextures:u,outputColorSpace:ie===null?n.outputColorSpace:ie.isXRRenderTarget===!0?ie.texture.colorSpace:ri,alphaToCoverage:!!E.alphaToCoverage,map:Ye,matcap:Te,envMap:ze,envMapMode:ze&&J.mapping,envMapCubeUVHeight:F,aoMap:B,lightMap:Xe,bumpMap:Fe,normalMap:Le,displacementMap:u&&ge,emissiveMap:je,normalMapObjectSpace:Le&&E.normalMapType===nc,normalMapTangentSpace:Le&&E.normalMapType===ic,metalnessMap:we,roughnessMap:S,anisotropy:g,anisotropyMap:ne,clearcoat:U,clearcoatMap:ce,clearcoatNormalMap:He,clearcoatRoughnessMap:$,dispersion:X,iridescence:Z,iridescenceMap:de,iridescenceThicknessMap:Ce,sheen:Y,sheenColorMap:De,sheenRoughnessMap:he,specularMap:ke,specularColorMap:be,specularIntensityMap:Je,transmission:pe,transmissionMap:T,thicknessMap:ae,gradientMap:K,opaque:E.transparent===!1&&E.blending===xi&&E.alphaToCoverage===!1,alphaMap:q,alphaTest:ue,alphaHash:le,combine:E.combine,mapUv:Ye&&M(E.map.channel),aoMapUv:B&&M(E.aoMap.channel),lightMapUv:Xe&&M(E.lightMap.channel),bumpMapUv:Fe&&M(E.bumpMap.channel),normalMapUv:Le&&M(E.normalMap.channel),displacementMapUv:ge&&M(E.displacementMap.channel),emissiveMapUv:je&&M(E.emissiveMap.channel),metalnessMapUv:we&&M(E.metalnessMap.channel),roughnessMapUv:S&&M(E.roughnessMap.channel),anisotropyMapUv:ne&&M(E.anisotropyMap.channel),clearcoatMapUv:ce&&M(E.clearcoatMap.channel),clearcoatNormalMapUv:He&&M(E.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:$&&M(E.clearcoatRoughnessMap.channel),iridescenceMapUv:de&&M(E.iridescenceMap.channel),iridescenceThicknessMapUv:Ce&&M(E.iridescenceThicknessMap.channel),sheenColorMapUv:De&&M(E.sheenColorMap.channel),sheenRoughnessMapUv:he&&M(E.sheenRoughnessMap.channel),specularMapUv:ke&&M(E.specularMap.channel),specularColorMapUv:be&&M(E.specularColorMap.channel),specularIntensityMapUv:Je&&M(E.specularIntensityMap.channel),transmissionMapUv:T&&M(E.transmissionMap.channel),thicknessMapUv:ae&&M(E.thicknessMap.channel),alphaMapUv:q&&M(E.alphaMap.channel),vertexTangents:!!W.attributes.tangent&&(Le||g),vertexColors:E.vertexColors,vertexAlphas:E.vertexColors===!0&&!!W.attributes.color&&W.attributes.color.itemSize===4,pointsUvs:O.isPoints===!0&&!!W.attributes.uv&&(Ye||q),fog:!!z,useFog:E.fog===!0,fogExp2:!!z&&z.isFogExp2,flatShading:E.flatShading===!0,sizeAttenuation:E.sizeAttenuation===!0,logarithmicDepthBuffer:p,reverseDepthBuffer:Ee,skinning:O.isSkinnedMesh===!0,morphTargets:W.morphAttributes.position!==void 0,morphNormals:W.morphAttributes.normal!==void 0,morphColors:W.morphAttributes.color!==void 0,morphTargetsCount:oe,morphTextureStride:me,numDirLights:x.directional.length,numPointLights:x.point.length,numSpotLights:x.spot.length,numSpotLightMaps:x.spotLightMap.length,numRectAreaLights:x.rectArea.length,numHemiLights:x.hemi.length,numDirLightShadows:x.directionalShadowMap.length,numPointLightShadows:x.pointShadowMap.length,numSpotLightShadows:x.spotShadowMap.length,numSpotLightShadowsWithMaps:x.numSpotLightShadowsWithMaps,numLightProbes:x.numLightProbes,numClippingPlanes:s.numPlanes,numClipIntersection:s.numIntersection,dithering:E.dithering,shadowMapEnabled:n.shadowMap.enabled&&P.length>0,shadowMapType:n.shadowMap.type,toneMapping:at,decodeVideoTexture:Ye&&E.map.isVideoTexture===!0&&Ne.getTransfer(E.map.colorSpace)===Ve,decodeVideoTextureEmissive:je&&E.emissiveMap.isVideoTexture===!0&&Ne.getTransfer(E.emissiveMap.colorSpace)===Ve,premultipliedAlpha:E.premultipliedAlpha,doubleSided:E.side===_t,flipSided:E.side===ot,useDepthPacking:E.depthPacking>=0,depthPacking:E.depthPacking||0,index0AttributeName:E.index0AttributeName,extensionClipCullDistance:Oe&&E.extensions.clipCullDistance===!0&&i.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(Oe&&E.extensions.multiDraw===!0||Pe)&&i.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:i.has("KHR_parallel_shader_compile"),customProgramCacheKey:E.customProgramCacheKey()};return vt.vertexUv1s=l.has(1),vt.vertexUv2s=l.has(2),vt.vertexUv3s=l.has(3),l.clear(),vt}function A(E){let x=[];if(E.shaderID?x.push(E.shaderID):(x.push(E.customVertexShaderID),x.push(E.customFragmentShaderID)),E.defines!==void 0)for(let P in E.defines)x.push(P),x.push(E.defines[P]);return E.isRawShaderMaterial===!1&&(w(x,E),C(x,E),x.push(n.outputColorSpace)),x.push(E.customProgramCacheKey),x.join()}function w(E,x){E.push(x.precision),E.push(x.outputColorSpace),E.push(x.envMapMode),E.push(x.envMapCubeUVHeight),E.push(x.mapUv),E.push(x.alphaMapUv),E.push(x.lightMapUv),E.push(x.aoMapUv),E.push(x.bumpMapUv),E.push(x.normalMapUv),E.push(x.displacementMapUv),E.push(x.emissiveMapUv),E.push(x.metalnessMapUv),E.push(x.roughnessMapUv),E.push(x.anisotropyMapUv),E.push(x.clearcoatMapUv),E.push(x.clearcoatNormalMapUv),E.push(x.clearcoatRoughnessMapUv),E.push(x.iridescenceMapUv),E.push(x.iridescenceThicknessMapUv),E.push(x.sheenColorMapUv),E.push(x.sheenRoughnessMapUv),E.push(x.specularMapUv),E.push(x.specularColorMapUv),E.push(x.specularIntensityMapUv),E.push(x.transmissionMapUv),E.push(x.thicknessMapUv),E.push(x.combine),E.push(x.fogExp2),E.push(x.sizeAttenuation),E.push(x.morphTargetsCount),E.push(x.morphAttributeCount),E.push(x.numDirLights),E.push(x.numPointLights),E.push(x.numSpotLights),E.push(x.numSpotLightMaps),E.push(x.numHemiLights),E.push(x.numRectAreaLights),E.push(x.numDirLightShadows),E.push(x.numPointLightShadows),E.push(x.numSpotLightShadows),E.push(x.numSpotLightShadowsWithMaps),E.push(x.numLightProbes),E.push(x.shadowMapType),E.push(x.toneMapping),E.push(x.numClippingPlanes),E.push(x.numClipIntersection),E.push(x.depthPacking)}function C(E,x){a.disableAll(),x.supportsVertexTextures&&a.enable(0),x.instancing&&a.enable(1),x.instancingColor&&a.enable(2),x.instancingMorph&&a.enable(3),x.matcap&&a.enable(4),x.envMap&&a.enable(5),x.normalMapObjectSpace&&a.enable(6),x.normalMapTangentSpace&&a.enable(7),x.clearcoat&&a.enable(8),x.iridescence&&a.enable(9),x.alphaTest&&a.enable(10),x.vertexColors&&a.enable(11),x.vertexAlphas&&a.enable(12),x.vertexUv1s&&a.enable(13),x.vertexUv2s&&a.enable(14),x.vertexUv3s&&a.enable(15),x.vertexTangents&&a.enable(16),x.anisotropy&&a.enable(17),x.alphaHash&&a.enable(18),x.batching&&a.enable(19),x.dispersion&&a.enable(20),x.batchingColor&&a.enable(21),E.push(a.mask),a.disableAll(),x.fog&&a.enable(0),x.useFog&&a.enable(1),x.flatShading&&a.enable(2),x.logarithmicDepthBuffer&&a.enable(3),x.reverseDepthBuffer&&a.enable(4),x.skinning&&a.enable(5),x.morphTargets&&a.enable(6),x.morphNormals&&a.enable(7),x.morphColors&&a.enable(8),x.premultipliedAlpha&&a.enable(9),x.shadowMapEnabled&&a.enable(10),x.doubleSided&&a.enable(11),x.flipSided&&a.enable(12),x.useDepthPacking&&a.enable(13),x.dithering&&a.enable(14),x.transmission&&a.enable(15),x.sheen&&a.enable(16),x.opaque&&a.enable(17),x.pointsUvs&&a.enable(18),x.decodeVideoTexture&&a.enable(19),x.decodeVideoTextureEmissive&&a.enable(20),x.alphaToCoverage&&a.enable(21),E.push(a.mask)}function v(E){let x=m[E.type],P;if(x){let G=qt[x];P=Nc.clone(G.uniforms)}else P=E.uniforms;return P}function N(E,x){let P;for(let G=0,O=f.length;G<O;G++){let z=f[G];if(z.cacheKey===x){P=z,++P.usedTimes;break}}return P===void 0&&(P=new ou(n,x,E,o),f.push(P)),P}function D(E){if(--E.usedTimes===0){let x=f.indexOf(E);f[x]=f[f.length-1],f.pop(),E.destroy()}}function y(E){c.remove(E)}function L(){c.dispose()}return{getParameters:h,getProgramCacheKey:A,getUniforms:v,acquireProgram:N,releaseProgram:D,releaseShaderCache:y,programs:f,dispose:L}}function au(){let n=new WeakMap;function e(s){return n.has(s)}function t(s){let a=n.get(s);return a===void 0&&(a={},n.set(s,a)),a}function i(s){n.delete(s)}function r(s,a,c){n.get(s)[a]=c}function o(){n=new WeakMap}return{has:e,get:t,remove:i,update:r,dispose:o}}function Fd(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.material.id!==e.material.id?n.material.id-e.material.id:n.z!==e.z?n.z-e.z:n.id-e.id}function cu(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.z!==e.z?e.z-n.z:n.id-e.id}function lu(){let n=[],e=0,t=[],i=[],r=[];function o(){e=0,t.length=0,i.length=0,r.length=0}function s(p,u,d,m,M,h){let A=n[e];return A===void 0?(A={id:p.id,object:p,geometry:u,material:d,groupOrder:m,renderOrder:p.renderOrder,z:M,group:h},n[e]=A):(A.id=p.id,A.object=p,A.geometry=u,A.material=d,A.groupOrder=m,A.renderOrder=p.renderOrder,A.z=M,A.group=h),e++,A}function a(p,u,d,m,M,h){let A=s(p,u,d,m,M,h);d.transmission>0?i.push(A):d.transparent===!0?r.push(A):t.push(A)}function c(p,u,d,m,M,h){let A=s(p,u,d,m,M,h);d.transmission>0?i.unshift(A):d.transparent===!0?r.unshift(A):t.unshift(A)}function l(p,u){t.length>1&&t.sort(p||Fd),i.length>1&&i.sort(u||cu),r.length>1&&r.sort(u||cu)}function f(){for(let p=e,u=n.length;p<u;p++){let d=n[p];if(d.id===null)break;d.id=null,d.object=null,d.geometry=null,d.material=null,d.group=null}}return{opaque:t,transmissive:i,transparent:r,init:o,push:a,unshift:c,finish:f,sort:l}}function Au(){let n=new WeakMap;function e(i,r){let o=n.get(i),s;return o===void 0?(s=new lu,n.set(i,[s])):r>=o.length?(s=new lu,o.push(s)):s=o[r],s}function t(){n=new WeakMap}return{get:e,dispose:t}}function Qd(){let n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new R,color:new Ge};break;case"SpotLight":t={position:new R,direction:new R,color:new Ge,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new R,color:new Ge,distance:0,decay:0};break;case"HemisphereLight":t={direction:new R,skyColor:new Ge,groundColor:new Ge};break;case"RectAreaLight":t={color:new Ge,position:new R,halfWidth:new R,halfHeight:new R};break}return n[e.id]=t,t}}}function Gd(){let n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Qe};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Qe};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Qe,shadowCameraNear:1,shadowCameraFar:1e3};break}return n[e.id]=t,t}}}var Hd=0;function kd(n,e){return(e.castShadow?2:0)-(n.castShadow?2:0)+(e.map?1:0)-(n.map?1:0)}function fu(n){let e=new Qd,t=Gd(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let l=0;l<9;l++)i.probe.push(new R);let r=new R,o=new We,s=new We;function a(l){let f=0,p=0,u=0;for(let E=0;E<9;E++)i.probe[E].set(0,0,0);let d=0,m=0,M=0,h=0,A=0,w=0,C=0,v=0,N=0,D=0,y=0;l.sort(kd);for(let E=0,x=l.length;E<x;E++){let P=l[E],G=P.color,O=P.intensity,z=P.distance,W=P.shadow&&P.shadow.map?P.shadow.map.texture:null;if(P.isAmbientLight)f+=G.r*O,p+=G.g*O,u+=G.b*O;else if(P.isLightProbe){for(let Q=0;Q<9;Q++)i.probe[Q].addScaledVector(P.sh.coefficients[Q],O);y++}else if(P.isDirectionalLight){let Q=e.get(P);if(Q.color.copy(P.color).multiplyScalar(P.intensity),P.castShadow){let J=P.shadow,F=t.get(P);F.shadowIntensity=J.intensity,F.shadowBias=J.bias,F.shadowNormalBias=J.normalBias,F.shadowRadius=J.radius,F.shadowMapSize=J.mapSize,i.directionalShadow[d]=F,i.directionalShadowMap[d]=W,i.directionalShadowMatrix[d]=P.shadow.matrix,w++}i.directional[d]=Q,d++}else if(P.isSpotLight){let Q=e.get(P);Q.position.setFromMatrixPosition(P.matrixWorld),Q.color.copy(G).multiplyScalar(O),Q.distance=z,Q.coneCos=Math.cos(P.angle),Q.penumbraCos=Math.cos(P.angle*(1-P.penumbra)),Q.decay=P.decay,i.spot[M]=Q;let J=P.shadow;if(P.map&&(i.spotLightMap[N]=P.map,N++,J.updateMatrices(P),P.castShadow&&D++),i.spotLightMatrix[M]=J.matrix,P.castShadow){let F=t.get(P);F.shadowIntensity=J.intensity,F.shadowBias=J.bias,F.shadowNormalBias=J.normalBias,F.shadowRadius=J.radius,F.shadowMapSize=J.mapSize,i.spotShadow[M]=F,i.spotShadowMap[M]=W,v++}M++}else if(P.isRectAreaLight){let Q=e.get(P);Q.color.copy(G).multiplyScalar(O),Q.halfWidth.set(P.width*.5,0,0),Q.halfHeight.set(0,P.height*.5,0),i.rectArea[h]=Q,h++}else if(P.isPointLight){let Q=e.get(P);if(Q.color.copy(P.color).multiplyScalar(P.intensity),Q.distance=P.distance,Q.decay=P.decay,P.castShadow){let J=P.shadow,F=t.get(P);F.shadowIntensity=J.intensity,F.shadowBias=J.bias,F.shadowNormalBias=J.normalBias,F.shadowRadius=J.radius,F.shadowMapSize=J.mapSize,F.shadowCameraNear=J.camera.near,F.shadowCameraFar=J.camera.far,i.pointShadow[m]=F,i.pointShadowMap[m]=W,i.pointShadowMatrix[m]=P.shadow.matrix,C++}i.point[m]=Q,m++}else if(P.isHemisphereLight){let Q=e.get(P);Q.skyColor.copy(P.color).multiplyScalar(O),Q.groundColor.copy(P.groundColor).multiplyScalar(O),i.hemi[A]=Q,A++}}h>0&&(n.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=re.LTC_FLOAT_1,i.rectAreaLTC2=re.LTC_FLOAT_2):(i.rectAreaLTC1=re.LTC_HALF_1,i.rectAreaLTC2=re.LTC_HALF_2)),i.ambient[0]=f,i.ambient[1]=p,i.ambient[2]=u;let L=i.hash;(L.directionalLength!==d||L.pointLength!==m||L.spotLength!==M||L.rectAreaLength!==h||L.hemiLength!==A||L.numDirectionalShadows!==w||L.numPointShadows!==C||L.numSpotShadows!==v||L.numSpotMaps!==N||L.numLightProbes!==y)&&(i.directional.length=d,i.spot.length=M,i.rectArea.length=h,i.point.length=m,i.hemi.length=A,i.directionalShadow.length=w,i.directionalShadowMap.length=w,i.pointShadow.length=C,i.pointShadowMap.length=C,i.spotShadow.length=v,i.spotShadowMap.length=v,i.directionalShadowMatrix.length=w,i.pointShadowMatrix.length=C,i.spotLightMatrix.length=v+N-D,i.spotLightMap.length=N,i.numSpotLightShadowsWithMaps=D,i.numLightProbes=y,L.directionalLength=d,L.pointLength=m,L.spotLength=M,L.rectAreaLength=h,L.hemiLength=A,L.numDirectionalShadows=w,L.numPointShadows=C,L.numSpotShadows=v,L.numSpotMaps=N,L.numLightProbes=y,i.version=Hd++)}function c(l,f){let p=0,u=0,d=0,m=0,M=0,h=f.matrixWorldInverse;for(let A=0,w=l.length;A<w;A++){let C=l[A];if(C.isDirectionalLight){let v=i.directional[p];v.direction.setFromMatrixPosition(C.matrixWorld),r.setFromMatrixPosition(C.target.matrixWorld),v.direction.sub(r),v.direction.transformDirection(h),p++}else if(C.isSpotLight){let v=i.spot[d];v.position.setFromMatrixPosition(C.matrixWorld),v.position.applyMatrix4(h),v.direction.setFromMatrixPosition(C.matrixWorld),r.setFromMatrixPosition(C.target.matrixWorld),v.direction.sub(r),v.direction.transformDirection(h),d++}else if(C.isRectAreaLight){let v=i.rectArea[m];v.position.setFromMatrixPosition(C.matrixWorld),v.position.applyMatrix4(h),s.identity(),o.copy(C.matrixWorld),o.premultiply(h),s.extractRotation(o),v.halfWidth.set(C.width*.5,0,0),v.halfHeight.set(0,C.height*.5,0),v.halfWidth.applyMatrix4(s),v.halfHeight.applyMatrix4(s),m++}else if(C.isPointLight){let v=i.point[u];v.position.setFromMatrixPosition(C.matrixWorld),v.position.applyMatrix4(h),u++}else if(C.isHemisphereLight){let v=i.hemi[M];v.direction.setFromMatrixPosition(C.matrixWorld),v.direction.transformDirection(h),M++}}}return{setup:a,setupView:c,state:i}}function uu(n){let e=new fu(n),t=[],i=[];function r(f){l.camera=f,t.length=0,i.length=0}function o(f){t.push(f)}function s(f){i.push(f)}function a(){e.setup(t)}function c(f){e.setupView(t,f)}let l={lightsArray:t,shadowsArray:i,camera:null,lights:e,transmissionRenderTarget:{}};return{init:r,state:l,setupLights:a,setupLightsView:c,pushLight:o,pushShadow:s}}function hu(n){let e=new WeakMap;function t(r,o=0){let s=e.get(r),a;return s===void 0?(a=new uu(n),e.set(r,[a])):o>=s.length?(a=new uu(n),s.push(a)):a=s[o],a}function i(){e=new WeakMap}return{get:t,dispose:i}}var es=class extends gi{static get type(){return"MeshDepthMaterial"}constructor(e){super(),this.isMeshDepthMaterial=!0,this.depthPacking=ec,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}};var ts=class extends gi{static get type(){return"MeshDistanceMaterial"}constructor(e){super(),this.isMeshDistanceMaterial=!0,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}};var du=`
void main() {

	gl_Position = vec4( position, 1.0 );

}
`,pu=`
uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;

#include <packing>

void main() {

	const float samples = float( VSM_SAMPLES );

	float mean = 0.0;
	float squared_mean = 0.0;

	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {

		float uvOffset = uvStart + i * uvStride;

		#ifdef HORIZONTAL_PASS

			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;

		#else

			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;

		#endif

	}

	mean = mean / samples;
	squared_mean = squared_mean / samples;

	float std_dev = sqrt( squared_mean - mean * mean );

	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );

}
`;function mu(n,e,t){let i=new zn,r=new Qe,o=new Qe,s=new et,a=new es({depthPacking:tc}),c=new ts,l={},f=t.maxTextureSize,p={[Nt]:ot,[ot]:Nt,[_t]:_t},u=new Bt({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Qe},radius:{value:4}},vertexShader:du,fragmentShader:pu}),d=u.clone();d.defines.HORIZONTAL_PASS=1;let m=new Mt;m.setAttribute("position",new rt(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let M=new ct(m,u),h=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=$r;let A=this.type;this.render=function(D,y,L){if(h.enabled===!1||h.autoUpdate===!1&&h.needsUpdate===!1||D.length===0)return;let E=n.getRenderTarget(),x=n.getActiveCubeFace(),P=n.getActiveMipmapLevel(),G=n.state;G.setBlending(zt),G.buffers.color.setClear(1,1,1,1),G.buffers.depth.setTest(!0),G.setScissorTest(!1);let O=A!==$t&&this.type===$t,z=A===$t&&this.type!==$t;for(let W=0,Q=D.length;W<Q;W++){let J=D[W],F=J.shadow;if(F===void 0){console.warn("THREE.WebGLShadowMap:",J,"has no shadow.");continue}if(F.autoUpdate===!1&&F.needsUpdate===!1)continue;r.copy(F.mapSize);let ee=F.getFrameExtents();if(r.multiply(ee),o.copy(F.mapSize),(r.x>f||r.y>f)&&(r.x>f&&(o.x=Math.floor(f/ee.x),r.x=o.x*ee.x,F.mapSize.x=o.x),r.y>f&&(o.y=Math.floor(f/ee.y),r.y=o.y*ee.y,F.mapSize.y=o.y)),F.map===null||O===!0||z===!0){let oe=this.type!==$t?{minFilter:ut,magFilter:ut}:{};F.map!==null&&F.map.dispose(),F.map=new Lt(r.x,r.y,oe),F.map.texture.name=J.name+".shadowMap",F.camera.updateProjectionMatrix()}n.setRenderTarget(F.map),n.clear();let se=F.getViewportCount();for(let oe=0;oe<se;oe++){let me=F.getViewport(oe);s.set(o.x*me.x,o.y*me.y,o.x*me.z,o.y*me.w),G.viewport(s),F.updateMatrices(J,oe),i=F.getFrustum(),v(y,L,F.camera,J,this.type)}F.isPointLightShadow!==!0&&this.type===$t&&w(F,L),F.needsUpdate=!1}A=this.type,h.needsUpdate=!1,n.setRenderTarget(E,x,P)};function w(D,y){let L=e.update(M);u.defines.VSM_SAMPLES!==D.blurSamples&&(u.defines.VSM_SAMPLES=D.blurSamples,d.defines.VSM_SAMPLES=D.blurSamples,u.needsUpdate=!0,d.needsUpdate=!0),D.mapPass===null&&(D.mapPass=new Lt(r.x,r.y)),u.uniforms.shadow_pass.value=D.map.texture,u.uniforms.resolution.value=D.mapSize,u.uniforms.radius.value=D.radius,n.setRenderTarget(D.mapPass),n.clear(),n.renderBufferDirect(y,null,L,u,M,null),d.uniforms.shadow_pass.value=D.mapPass.texture,d.uniforms.resolution.value=D.mapSize,d.uniforms.radius.value=D.radius,n.setRenderTarget(D.map),n.clear(),n.renderBufferDirect(y,null,L,d,M,null)}function C(D,y,L,E){let x=null,P=L.isPointLight===!0?D.customDistanceMaterial:D.customDepthMaterial;if(P!==void 0)x=P;else if(x=L.isPointLight===!0?c:a,n.localClippingEnabled&&y.clipShadows===!0&&Array.isArray(y.clippingPlanes)&&y.clippingPlanes.length!==0||y.displacementMap&&y.displacementScale!==0||y.alphaMap&&y.alphaTest>0||y.map&&y.alphaTest>0){let G=x.uuid,O=y.uuid,z=l[G];z===void 0&&(z={},l[G]=z);let W=z[O];W===void 0&&(W=x.clone(),z[O]=W,y.addEventListener("dispose",N)),x=W}if(x.visible=y.visible,x.wireframe=y.wireframe,E===$t?x.side=y.shadowSide!==null?y.shadowSide:y.side:x.side=y.shadowSide!==null?y.shadowSide:p[y.side],x.alphaMap=y.alphaMap,x.alphaTest=y.alphaTest,x.map=y.map,x.clipShadows=y.clipShadows,x.clippingPlanes=y.clippingPlanes,x.clipIntersection=y.clipIntersection,x.displacementMap=y.displacementMap,x.displacementScale=y.displacementScale,x.displacementBias=y.displacementBias,x.wireframeLinewidth=y.wireframeLinewidth,x.linewidth=y.linewidth,L.isPointLight===!0&&x.isMeshDistanceMaterial===!0){let G=n.properties.get(x);G.light=L}return x}function v(D,y,L,E,x){if(D.visible===!1)return;if(D.layers.test(y.layers)&&(D.isMesh||D.isLine||D.isPoints)&&(D.castShadow||D.receiveShadow&&x===$t)&&(!D.frustumCulled||i.intersectsObject(D))){D.modelViewMatrix.multiplyMatrices(L.matrixWorldInverse,D.matrixWorld);let O=e.update(D),z=D.material;if(Array.isArray(z)){let W=O.groups;for(let Q=0,J=W.length;Q<J;Q++){let F=W[Q],ee=z[F.materialIndex];if(ee&&ee.visible){let se=C(D,ee,E,x);D.onBeforeShadow(n,D,y,L,O,se,F),n.renderBufferDirect(L,null,O,se,D,F),D.onAfterShadow(n,D,y,L,O,se,F)}}}else if(z.visible){let W=C(D,z,E,x);D.onBeforeShadow(n,D,y,L,O,W,null),n.renderBufferDirect(L,null,O,W,D,null),D.onAfterShadow(n,D,y,L,O,W,null)}}let G=D.children;for(let O=0,z=G.length;O<z;O++)v(G[O],y,L,E,x)}function N(D){D.target.removeEventListener("dispose",N);for(let L in l){let E=l[L],x=D.target.uuid;x in E&&(E[x].dispose(),delete E[x])}}}var Vd={[eo]:to,[io]:oo,[no]:so,[Li]:ro,[to]:eo,[oo]:io,[so]:no,[ro]:Li};function gu(n,e){function t(){let T=!1,ae=new et,K=null,q=new et(0,0,0,0);return{setMask:function(ue){K!==ue&&!T&&(n.colorMask(ue,ue,ue,ue),K=ue)},setLocked:function(ue){T=ue},setClear:function(ue,le,Oe,at,vt){vt===!0&&(ue*=at,le*=at,Oe*=at),ae.set(ue,le,Oe,at),q.equals(ae)===!1&&(n.clearColor(ue,le,Oe,at),q.copy(ae))},reset:function(){T=!1,K=null,q.set(-1,0,0,0)}}}function i(){let T=!1,ae=!1,K=null,q=null,ue=null;return{setReversed:function(le){if(ae!==le){let Oe=e.get("EXT_clip_control");ae?Oe.clipControlEXT(Oe.LOWER_LEFT_EXT,Oe.ZERO_TO_ONE_EXT):Oe.clipControlEXT(Oe.LOWER_LEFT_EXT,Oe.NEGATIVE_ONE_TO_ONE_EXT);let at=ue;ue=null,this.setClear(at)}ae=le},getReversed:function(){return ae},setTest:function(le){le?ie(n.DEPTH_TEST):Ee(n.DEPTH_TEST)},setMask:function(le){K!==le&&!T&&(n.depthMask(le),K=le)},setFunc:function(le){if(ae&&(le=Vd[le]),q!==le){switch(le){case eo:n.depthFunc(n.NEVER);break;case to:n.depthFunc(n.ALWAYS);break;case io:n.depthFunc(n.LESS);break;case Li:n.depthFunc(n.LEQUAL);break;case no:n.depthFunc(n.EQUAL);break;case ro:n.depthFunc(n.GEQUAL);break;case oo:n.depthFunc(n.GREATER);break;case so:n.depthFunc(n.NOTEQUAL);break;default:n.depthFunc(n.LEQUAL)}q=le}},setLocked:function(le){T=le},setClear:function(le){ue!==le&&(ae&&(le=1-le),n.clearDepth(le),ue=le)},reset:function(){T=!1,K=null,q=null,ue=null,ae=!1}}}function r(){let T=!1,ae=null,K=null,q=null,ue=null,le=null,Oe=null,at=null,vt=null;return{setTest:function($e){T||($e?ie(n.STENCIL_TEST):Ee(n.STENCIL_TEST))},setMask:function($e){ae!==$e&&!T&&(n.stencilMask($e),ae=$e)},setFunc:function($e,Zt,Mi){(K!==$e||q!==Zt||ue!==Mi)&&(n.stencilFunc($e,Zt,Mi),K=$e,q=Zt,ue=Mi)},setOp:function($e,Zt,Mi){(le!==$e||Oe!==Zt||at!==Mi)&&(n.stencilOp($e,Zt,Mi),le=$e,Oe=Zt,at=Mi)},setLocked:function($e){T=$e},setClear:function($e){vt!==$e&&(n.clearStencil($e),vt=$e)},reset:function(){T=!1,ae=null,K=null,q=null,ue=null,le=null,Oe=null,at=null,vt=null}}}let o=new t,s=new i,a=new r,c=new WeakMap,l=new WeakMap,f={},p={},u=new WeakMap,d=[],m=null,M=!1,h=null,A=null,w=null,C=null,v=null,N=null,D=null,y=new Ge(0,0,0),L=0,E=!1,x=null,P=null,G=null,O=null,z=null,W=n.getParameter(n.MAX_COMBINED_TEXTURE_IMAGE_UNITS),Q=!1,J=0,F=n.getParameter(n.VERSION);F.indexOf("WebGL")!==-1?(J=parseFloat(/^WebGL (\d)/.exec(F)[1]),Q=J>=1):F.indexOf("OpenGL ES")!==-1&&(J=parseFloat(/^OpenGL ES (\d)/.exec(F)[1]),Q=J>=2);let ee=null,se={},oe=n.getParameter(n.SCISSOR_BOX),me=n.getParameter(n.VIEWPORT),Be=new et().fromArray(oe),V=new et().fromArray(me);function j(T,ae,K,q){let ue=new Uint8Array(4),le=n.createTexture();n.bindTexture(T,le),n.texParameteri(T,n.TEXTURE_MIN_FILTER,n.NEAREST),n.texParameteri(T,n.TEXTURE_MAG_FILTER,n.NEAREST);for(let Oe=0;Oe<K;Oe++)T===n.TEXTURE_3D||T===n.TEXTURE_2D_ARRAY?n.texImage3D(ae,0,n.RGBA,1,1,q,0,n.RGBA,n.UNSIGNED_BYTE,ue):n.texImage2D(ae+Oe,0,n.RGBA,1,1,0,n.RGBA,n.UNSIGNED_BYTE,ue);return le}let fe={};fe[n.TEXTURE_2D]=j(n.TEXTURE_2D,n.TEXTURE_2D,1),fe[n.TEXTURE_CUBE_MAP]=j(n.TEXTURE_CUBE_MAP,n.TEXTURE_CUBE_MAP_POSITIVE_X,6),fe[n.TEXTURE_2D_ARRAY]=j(n.TEXTURE_2D_ARRAY,n.TEXTURE_2D_ARRAY,1,1),fe[n.TEXTURE_3D]=j(n.TEXTURE_3D,n.TEXTURE_3D,1,1),o.setClear(0,0,0,1),s.setClear(1),a.setClear(0),ie(n.DEPTH_TEST),s.setFunc(Li),Fe(!1),Le(gs),ie(n.CULL_FACE),B(zt);function ie(T){f[T]!==!0&&(n.enable(T),f[T]=!0)}function Ee(T){f[T]!==!1&&(n.disable(T),f[T]=!1)}function Se(T,ae){return p[T]!==ae?(n.bindFramebuffer(T,ae),p[T]=ae,T===n.DRAW_FRAMEBUFFER&&(p[n.FRAMEBUFFER]=ae),T===n.FRAMEBUFFER&&(p[n.DRAW_FRAMEBUFFER]=ae),!0):!1}function Pe(T,ae){let K=d,q=!1;if(T){K=u.get(ae),K===void 0&&(K=[],u.set(ae,K));let ue=T.textures;if(K.length!==ue.length||K[0]!==n.COLOR_ATTACHMENT0){for(let le=0,Oe=ue.length;le<Oe;le++)K[le]=n.COLOR_ATTACHMENT0+le;K.length=ue.length,q=!0}}else K[0]!==n.BACK&&(K[0]=n.BACK,q=!0);q&&n.drawBuffers(K)}function Ye(T){return m!==T?(n.useProgram(T),m=T,!0):!1}let Te={[vi]:n.FUNC_ADD,[Da]:n.FUNC_SUBTRACT,[ya]:n.FUNC_REVERSE_SUBTRACT};Te[Ta]=n.MIN,Te[Ba]=n.MAX;let ze={[Ia]:n.ZERO,[ba]:n.ONE,[Ra]:n.SRC_COLOR,[nr]:n.SRC_ALPHA,[Qa]:n.SRC_ALPHA_SATURATE,[Na]:n.DST_COLOR,[Oa]:n.DST_ALPHA,[La]:n.ONE_MINUS_SRC_COLOR,[rr]:n.ONE_MINUS_SRC_ALPHA,[Fa]:n.ONE_MINUS_DST_COLOR,[Ua]:n.ONE_MINUS_DST_ALPHA,[Ga]:n.CONSTANT_COLOR,[Ha]:n.ONE_MINUS_CONSTANT_COLOR,[ka]:n.CONSTANT_ALPHA,[za]:n.ONE_MINUS_CONSTANT_ALPHA};function B(T,ae,K,q,ue,le,Oe,at,vt,$e){if(T===zt){M===!0&&(Ee(n.BLEND),M=!1);return}if(M===!1&&(ie(n.BLEND),M=!0),T!==Pa){if(T!==h||$e!==E){if((A!==vi||v!==vi)&&(n.blendEquation(n.FUNC_ADD),A=vi,v=vi),$e)switch(T){case xi:n.blendFuncSeparate(n.ONE,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case Ms:n.blendFunc(n.ONE,n.ONE);break;case _s:n.blendFuncSeparate(n.ZERO,n.ONE_MINUS_SRC_COLOR,n.ZERO,n.ONE);break;case xs:n.blendFuncSeparate(n.ZERO,n.SRC_COLOR,n.ZERO,n.SRC_ALPHA);break;default:console.error("THREE.WebGLState: Invalid blending: ",T);break}else switch(T){case xi:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case Ms:n.blendFunc(n.SRC_ALPHA,n.ONE);break;case _s:n.blendFuncSeparate(n.ZERO,n.ONE_MINUS_SRC_COLOR,n.ZERO,n.ONE);break;case xs:n.blendFunc(n.ZERO,n.SRC_COLOR);break;default:console.error("THREE.WebGLState: Invalid blending: ",T);break}w=null,C=null,N=null,D=null,y.set(0,0,0),L=0,h=T,E=$e}return}ue=ue||ae,le=le||K,Oe=Oe||q,(ae!==A||ue!==v)&&(n.blendEquationSeparate(Te[ae],Te[ue]),A=ae,v=ue),(K!==w||q!==C||le!==N||Oe!==D)&&(n.blendFuncSeparate(ze[K],ze[q],ze[le],ze[Oe]),w=K,C=q,N=le,D=Oe),(at.equals(y)===!1||vt!==L)&&(n.blendColor(at.r,at.g,at.b,vt),y.copy(at),L=vt),h=T,E=!1}function Xe(T,ae){T.side===_t?Ee(n.CULL_FACE):ie(n.CULL_FACE);let K=T.side===ot;ae&&(K=!K),Fe(K),T.blending===xi&&T.transparent===!1?B(zt):B(T.blending,T.blendEquation,T.blendSrc,T.blendDst,T.blendEquationAlpha,T.blendSrcAlpha,T.blendDstAlpha,T.blendColor,T.blendAlpha,T.premultipliedAlpha),s.setFunc(T.depthFunc),s.setTest(T.depthTest),s.setMask(T.depthWrite),o.setMask(T.colorWrite);let q=T.stencilWrite;a.setTest(q),q&&(a.setMask(T.stencilWriteMask),a.setFunc(T.stencilFunc,T.stencilRef,T.stencilFuncMask),a.setOp(T.stencilFail,T.stencilZFail,T.stencilZPass)),je(T.polygonOffset,T.polygonOffsetFactor,T.polygonOffsetUnits),T.alphaToCoverage===!0?ie(n.SAMPLE_ALPHA_TO_COVERAGE):Ee(n.SAMPLE_ALPHA_TO_COVERAGE)}function Fe(T){x!==T&&(T?n.frontFace(n.CW):n.frontFace(n.CCW),x=T)}function Le(T){T!==wa?(ie(n.CULL_FACE),T!==P&&(T===gs?n.cullFace(n.BACK):T===Ca?n.cullFace(n.FRONT):n.cullFace(n.FRONT_AND_BACK))):Ee(n.CULL_FACE),P=T}function ge(T){T!==G&&(Q&&n.lineWidth(T),G=T)}function je(T,ae,K){T?(ie(n.POLYGON_OFFSET_FILL),(O!==ae||z!==K)&&(n.polygonOffset(ae,K),O=ae,z=K)):Ee(n.POLYGON_OFFSET_FILL)}function we(T){T?ie(n.SCISSOR_TEST):Ee(n.SCISSOR_TEST)}function S(T){T===void 0&&(T=n.TEXTURE0+W-1),ee!==T&&(n.activeTexture(T),ee=T)}function g(T,ae,K){K===void 0&&(ee===null?K=n.TEXTURE0+W-1:K=ee);let q=se[K];q===void 0&&(q={type:void 0,texture:void 0},se[K]=q),(q.type!==T||q.texture!==ae)&&(ee!==K&&(n.activeTexture(K),ee=K),n.bindTexture(T,ae||fe[T]),q.type=T,q.texture=ae)}function U(){let T=se[ee];T!==void 0&&T.type!==void 0&&(n.bindTexture(T.type,null),T.type=void 0,T.texture=void 0)}function X(){try{n.compressedTexImage2D.apply(n,arguments)}catch(T){console.error("THREE.WebGLState:",T)}}function Z(){try{n.compressedTexImage3D.apply(n,arguments)}catch(T){console.error("THREE.WebGLState:",T)}}function Y(){try{n.texSubImage2D.apply(n,arguments)}catch(T){console.error("THREE.WebGLState:",T)}}function pe(){try{n.texSubImage3D.apply(n,arguments)}catch(T){console.error("THREE.WebGLState:",T)}}function ne(){try{n.compressedTexSubImage2D.apply(n,arguments)}catch(T){console.error("THREE.WebGLState:",T)}}function ce(){try{n.compressedTexSubImage3D.apply(n,arguments)}catch(T){console.error("THREE.WebGLState:",T)}}function He(){try{n.texStorage2D.apply(n,arguments)}catch(T){console.error("THREE.WebGLState:",T)}}function $(){try{n.texStorage3D.apply(n,arguments)}catch(T){console.error("THREE.WebGLState:",T)}}function de(){try{n.texImage2D.apply(n,arguments)}catch(T){console.error("THREE.WebGLState:",T)}}function Ce(){try{n.texImage3D.apply(n,arguments)}catch(T){console.error("THREE.WebGLState:",T)}}function De(T){Be.equals(T)===!1&&(n.scissor(T.x,T.y,T.z,T.w),Be.copy(T))}function he(T){V.equals(T)===!1&&(n.viewport(T.x,T.y,T.z,T.w),V.copy(T))}function ke(T,ae){let K=l.get(ae);K===void 0&&(K=new WeakMap,l.set(ae,K));let q=K.get(T);q===void 0&&(q=n.getUniformBlockIndex(ae,T.name),K.set(T,q))}function be(T,ae){let q=l.get(ae).get(T);c.get(ae)!==q&&(n.uniformBlockBinding(ae,q,T.__bindingPointIndex),c.set(ae,q))}function Je(){n.disable(n.BLEND),n.disable(n.CULL_FACE),n.disable(n.DEPTH_TEST),n.disable(n.POLYGON_OFFSET_FILL),n.disable(n.SCISSOR_TEST),n.disable(n.STENCIL_TEST),n.disable(n.SAMPLE_ALPHA_TO_COVERAGE),n.blendEquation(n.FUNC_ADD),n.blendFunc(n.ONE,n.ZERO),n.blendFuncSeparate(n.ONE,n.ZERO,n.ONE,n.ZERO),n.blendColor(0,0,0,0),n.colorMask(!0,!0,!0,!0),n.clearColor(0,0,0,0),n.depthMask(!0),n.depthFunc(n.LESS),s.setReversed(!1),n.clearDepth(1),n.stencilMask(4294967295),n.stencilFunc(n.ALWAYS,0,4294967295),n.stencilOp(n.KEEP,n.KEEP,n.KEEP),n.clearStencil(0),n.cullFace(n.BACK),n.frontFace(n.CCW),n.polygonOffset(0,0),n.activeTexture(n.TEXTURE0),n.bindFramebuffer(n.FRAMEBUFFER,null),n.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),n.bindFramebuffer(n.READ_FRAMEBUFFER,null),n.useProgram(null),n.lineWidth(1),n.scissor(0,0,n.canvas.width,n.canvas.height),n.viewport(0,0,n.canvas.width,n.canvas.height),f={},ee=null,se={},p={},u=new WeakMap,d=[],m=null,M=!1,h=null,A=null,w=null,C=null,v=null,N=null,D=null,y=new Ge(0,0,0),L=0,E=!1,x=null,P=null,G=null,O=null,z=null,Be.set(0,0,n.canvas.width,n.canvas.height),V.set(0,0,n.canvas.width,n.canvas.height),o.reset(),s.reset(),a.reset()}return{buffers:{color:o,depth:s,stencil:a},enable:ie,disable:Ee,bindFramebuffer:Se,drawBuffers:Pe,useProgram:Ye,setBlending:B,setMaterial:Xe,setFlipSided:Fe,setCullFace:Le,setLineWidth:ge,setPolygonOffset:je,setScissorTest:we,activeTexture:S,bindTexture:g,unbindTexture:U,compressedTexImage2D:X,compressedTexImage3D:Z,texImage2D:de,texImage3D:Ce,updateUBOMapping:ke,uniformBlockBinding:be,texStorage2D:He,texStorage3D:$,texSubImage2D:Y,texSubImage3D:pe,compressedTexSubImage2D:ne,compressedTexSubImage3D:ce,scissor:De,viewport:he,reset:Je}}function ra(n,e,t,i){let r=Kd(i);switch(t){case uo:return n*e;case po:return n*e;case mo:return n*e*2;case dn:return n*e/r.components*r.byteLength;case pn:return n*e/r.components*r.byteLength;case go:return n*e*2/r.components*r.byteLength;case mn:return n*e*2/r.components*r.byteLength;case ho:return n*e*3/r.components*r.byteLength;case mt:return n*e*4/r.components*r.byteLength;case gn:return n*e*4/r.components*r.byteLength;case Mn:case _n:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*8;case xn:case vn:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case fr:case hr:return Math.max(n,16)*Math.max(e,8)/4;case Ar:case ur:return Math.max(n,8)*Math.max(e,8)/2;case dr:case pr:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*8;case mr:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case gr:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case Mr:return Math.floor((n+4)/5)*Math.floor((e+3)/4)*16;case _r:return Math.floor((n+4)/5)*Math.floor((e+4)/5)*16;case xr:return Math.floor((n+5)/6)*Math.floor((e+4)/5)*16;case vr:return Math.floor((n+5)/6)*Math.floor((e+5)/6)*16;case Er:return Math.floor((n+7)/8)*Math.floor((e+4)/5)*16;case wr:return Math.floor((n+7)/8)*Math.floor((e+5)/6)*16;case Cr:return Math.floor((n+7)/8)*Math.floor((e+7)/8)*16;case Sr:return Math.floor((n+9)/10)*Math.floor((e+4)/5)*16;case Pr:return Math.floor((n+9)/10)*Math.floor((e+5)/6)*16;case Dr:return Math.floor((n+9)/10)*Math.floor((e+7)/8)*16;case yr:return Math.floor((n+9)/10)*Math.floor((e+9)/10)*16;case Tr:return Math.floor((n+11)/12)*Math.floor((e+9)/10)*16;case Br:return Math.floor((n+11)/12)*Math.floor((e+11)/12)*16;case En:case Ir:case br:return Math.ceil(n/4)*Math.ceil(e/4)*16;case Mo:case Rr:return Math.ceil(n/4)*Math.ceil(e/4)*8;case Lr:case Or:return Math.ceil(n/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function Kd(n){switch(n){case Et:case lo:return{byteLength:1,components:1};case Ei:case Ao:case hi:return{byteLength:2,components:1};case un:case hn:return{byteLength:2,components:4};case Ft:case fn:case xt:return{byteLength:4,components:1};case fo:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${n}.`)}function Mu(n,e,t,i,r,o,s){let a=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,c=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),l=new Qe,f=new WeakMap,p,u=new WeakMap,d=!1;try{d=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function m(S,g){return d?new OffscreenCanvas(S,g):Cn("canvas")}function M(S,g,U){let X=1,Z=we(S);if((Z.width>U||Z.height>U)&&(X=U/Math.max(Z.width,Z.height)),X<1)if(typeof HTMLImageElement<"u"&&S instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&S instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&S instanceof ImageBitmap||typeof VideoFrame<"u"&&S instanceof VideoFrame){let Y=Math.floor(X*Z.width),pe=Math.floor(X*Z.height);p===void 0&&(p=m(Y,pe));let ne=g?m(Y,pe):p;return ne.width=Y,ne.height=pe,ne.getContext("2d").drawImage(S,0,0,Y,pe),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+Z.width+"x"+Z.height+") to ("+Y+"x"+pe+")."),ne}else return"data"in S&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+Z.width+"x"+Z.height+")."),S;return S}function h(S){return S.generateMipmaps}function A(S){n.generateMipmap(S)}function w(S){return S.isWebGLCubeRenderTarget?n.TEXTURE_CUBE_MAP:S.isWebGL3DRenderTarget?n.TEXTURE_3D:S.isWebGLArrayRenderTarget||S.isCompressedArrayTexture?n.TEXTURE_2D_ARRAY:n.TEXTURE_2D}function C(S,g,U,X,Z=!1){if(S!==null){if(n[S]!==void 0)return n[S];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+S+"'")}let Y=g;if(g===n.RED&&(U===n.FLOAT&&(Y=n.R32F),U===n.HALF_FLOAT&&(Y=n.R16F),U===n.UNSIGNED_BYTE&&(Y=n.R8)),g===n.RED_INTEGER&&(U===n.UNSIGNED_BYTE&&(Y=n.R8UI),U===n.UNSIGNED_SHORT&&(Y=n.R16UI),U===n.UNSIGNED_INT&&(Y=n.R32UI),U===n.BYTE&&(Y=n.R8I),U===n.SHORT&&(Y=n.R16I),U===n.INT&&(Y=n.R32I)),g===n.RG&&(U===n.FLOAT&&(Y=n.RG32F),U===n.HALF_FLOAT&&(Y=n.RG16F),U===n.UNSIGNED_BYTE&&(Y=n.RG8)),g===n.RG_INTEGER&&(U===n.UNSIGNED_BYTE&&(Y=n.RG8UI),U===n.UNSIGNED_SHORT&&(Y=n.RG16UI),U===n.UNSIGNED_INT&&(Y=n.RG32UI),U===n.BYTE&&(Y=n.RG8I),U===n.SHORT&&(Y=n.RG16I),U===n.INT&&(Y=n.RG32I)),g===n.RGB_INTEGER&&(U===n.UNSIGNED_BYTE&&(Y=n.RGB8UI),U===n.UNSIGNED_SHORT&&(Y=n.RGB16UI),U===n.UNSIGNED_INT&&(Y=n.RGB32UI),U===n.BYTE&&(Y=n.RGB8I),U===n.SHORT&&(Y=n.RGB16I),U===n.INT&&(Y=n.RGB32I)),g===n.RGBA_INTEGER&&(U===n.UNSIGNED_BYTE&&(Y=n.RGBA8UI),U===n.UNSIGNED_SHORT&&(Y=n.RGBA16UI),U===n.UNSIGNED_INT&&(Y=n.RGBA32UI),U===n.BYTE&&(Y=n.RGBA8I),U===n.SHORT&&(Y=n.RGBA16I),U===n.INT&&(Y=n.RGBA32I)),g===n.RGB&&U===n.UNSIGNED_INT_5_9_9_9_REV&&(Y=n.RGB9_E5),g===n.RGBA){let pe=Z?Yi:Ne.getTransfer(X);U===n.FLOAT&&(Y=n.RGBA32F),U===n.HALF_FLOAT&&(Y=n.RGBA16F),U===n.UNSIGNED_BYTE&&(Y=pe===Ve?n.SRGB8_ALPHA8:n.RGBA8),U===n.UNSIGNED_SHORT_4_4_4_4&&(Y=n.RGBA4),U===n.UNSIGNED_SHORT_5_5_5_1&&(Y=n.RGB5_A1)}return(Y===n.R16F||Y===n.R32F||Y===n.RG16F||Y===n.RG32F||Y===n.RGBA16F||Y===n.RGBA32F)&&e.get("EXT_color_buffer_float"),Y}function v(S,g){let U;return S?g===null||g===Ft||g===ni?U=n.DEPTH24_STENCIL8:g===xt?U=n.DEPTH32F_STENCIL8:g===Ei&&(U=n.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):g===null||g===Ft||g===ni?U=n.DEPTH_COMPONENT24:g===xt?U=n.DEPTH_COMPONENT32F:g===Ei&&(U=n.DEPTH_COMPONENT16),U}function N(S,g){return h(S)===!0||S.isFramebufferTexture&&S.minFilter!==ut&&S.minFilter!==Dt?Math.log2(Math.max(g.width,g.height))+1:S.mipmaps!==void 0&&S.mipmaps.length>0?S.mipmaps.length:S.isCompressedTexture&&Array.isArray(S.image)?g.mipmaps.length:1}function D(S){let g=S.target;g.removeEventListener("dispose",D),L(g),g.isVideoTexture&&f.delete(g)}function y(S){let g=S.target;g.removeEventListener("dispose",y),x(g)}function L(S){let g=i.get(S);if(g.__webglInit===void 0)return;let U=S.source,X=u.get(U);if(X){let Z=X[g.__cacheKey];Z.usedTimes--,Z.usedTimes===0&&E(S),Object.keys(X).length===0&&u.delete(U)}i.remove(S)}function E(S){let g=i.get(S);n.deleteTexture(g.__webglTexture);let U=S.source,X=u.get(U);delete X[g.__cacheKey],s.memory.textures--}function x(S){let g=i.get(S);if(S.depthTexture&&(S.depthTexture.dispose(),i.remove(S.depthTexture)),S.isWebGLCubeRenderTarget)for(let X=0;X<6;X++){if(Array.isArray(g.__webglFramebuffer[X]))for(let Z=0;Z<g.__webglFramebuffer[X].length;Z++)n.deleteFramebuffer(g.__webglFramebuffer[X][Z]);else n.deleteFramebuffer(g.__webglFramebuffer[X]);g.__webglDepthbuffer&&n.deleteRenderbuffer(g.__webglDepthbuffer[X])}else{if(Array.isArray(g.__webglFramebuffer))for(let X=0;X<g.__webglFramebuffer.length;X++)n.deleteFramebuffer(g.__webglFramebuffer[X]);else n.deleteFramebuffer(g.__webglFramebuffer);if(g.__webglDepthbuffer&&n.deleteRenderbuffer(g.__webglDepthbuffer),g.__webglMultisampledFramebuffer&&n.deleteFramebuffer(g.__webglMultisampledFramebuffer),g.__webglColorRenderbuffer)for(let X=0;X<g.__webglColorRenderbuffer.length;X++)g.__webglColorRenderbuffer[X]&&n.deleteRenderbuffer(g.__webglColorRenderbuffer[X]);g.__webglDepthRenderbuffer&&n.deleteRenderbuffer(g.__webglDepthRenderbuffer)}let U=S.textures;for(let X=0,Z=U.length;X<Z;X++){let Y=i.get(U[X]);Y.__webglTexture&&(n.deleteTexture(Y.__webglTexture),s.memory.textures--),i.remove(U[X])}i.remove(S)}let P=0;function G(){P=0}function O(){let S=P;return S>=r.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+S+" texture units while this GPU supports only "+r.maxTextures),P+=1,S}function z(S){let g=[];return g.push(S.wrapS),g.push(S.wrapT),g.push(S.wrapR||0),g.push(S.magFilter),g.push(S.minFilter),g.push(S.anisotropy),g.push(S.internalFormat),g.push(S.format),g.push(S.type),g.push(S.generateMipmaps),g.push(S.premultiplyAlpha),g.push(S.flipY),g.push(S.unpackAlignment),g.push(S.colorSpace),g.join()}function W(S,g){let U=i.get(S);if(S.isVideoTexture&&ge(S),S.isRenderTargetTexture===!1&&S.version>0&&U.__version!==S.version){let X=S.image;if(X===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(X.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{V(U,S,g);return}}t.bindTexture(n.TEXTURE_2D,U.__webglTexture,n.TEXTURE0+g)}function Q(S,g){let U=i.get(S);if(S.version>0&&U.__version!==S.version){V(U,S,g);return}t.bindTexture(n.TEXTURE_2D_ARRAY,U.__webglTexture,n.TEXTURE0+g)}function J(S,g){let U=i.get(S);if(S.version>0&&U.__version!==S.version){V(U,S,g);return}t.bindTexture(n.TEXTURE_3D,U.__webglTexture,n.TEXTURE0+g)}function F(S,g){let U=i.get(S);if(S.version>0&&U.__version!==S.version){j(U,S,g);return}t.bindTexture(n.TEXTURE_CUBE_MAP,U.__webglTexture,n.TEXTURE0+g)}let ee={[ar]:n.REPEAT,[ti]:n.CLAMP_TO_EDGE,[cr]:n.MIRRORED_REPEAT},se={[ut]:n.NEAREST,[$a]:n.NEAREST_MIPMAP_NEAREST,[lr]:n.NEAREST_MIPMAP_LINEAR,[Dt]:n.LINEAR,[co]:n.LINEAR_MIPMAP_NEAREST,[ii]:n.LINEAR_MIPMAP_LINEAR},oe={[rc]:n.NEVER,[Ac]:n.ALWAYS,[oc]:n.LESS,[_o]:n.LEQUAL,[sc]:n.EQUAL,[lc]:n.GEQUAL,[ac]:n.GREATER,[cc]:n.NOTEQUAL};function me(S,g){if(g.type===xt&&e.has("OES_texture_float_linear")===!1&&(g.magFilter===Dt||g.magFilter===co||g.magFilter===lr||g.magFilter===ii||g.minFilter===Dt||g.minFilter===co||g.minFilter===lr||g.minFilter===ii)&&console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),n.texParameteri(S,n.TEXTURE_WRAP_S,ee[g.wrapS]),n.texParameteri(S,n.TEXTURE_WRAP_T,ee[g.wrapT]),(S===n.TEXTURE_3D||S===n.TEXTURE_2D_ARRAY)&&n.texParameteri(S,n.TEXTURE_WRAP_R,ee[g.wrapR]),n.texParameteri(S,n.TEXTURE_MAG_FILTER,se[g.magFilter]),n.texParameteri(S,n.TEXTURE_MIN_FILTER,se[g.minFilter]),g.compareFunction&&(n.texParameteri(S,n.TEXTURE_COMPARE_MODE,n.COMPARE_REF_TO_TEXTURE),n.texParameteri(S,n.TEXTURE_COMPARE_FUNC,oe[g.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(g.magFilter===ut||g.minFilter!==lr&&g.minFilter!==ii||g.type===xt&&e.has("OES_texture_float_linear")===!1)return;if(g.anisotropy>1||i.get(g).__currentAnisotropy){let U=e.get("EXT_texture_filter_anisotropic");n.texParameterf(S,U.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(g.anisotropy,r.getMaxAnisotropy())),i.get(g).__currentAnisotropy=g.anisotropy}}}function Be(S,g){let U=!1;S.__webglInit===void 0&&(S.__webglInit=!0,g.addEventListener("dispose",D));let X=g.source,Z=u.get(X);Z===void 0&&(Z={},u.set(X,Z));let Y=z(g);if(Y!==S.__cacheKey){Z[Y]===void 0&&(Z[Y]={texture:n.createTexture(),usedTimes:0},s.memory.textures++,U=!0),Z[Y].usedTimes++;let pe=Z[S.__cacheKey];pe!==void 0&&(Z[S.__cacheKey].usedTimes--,pe.usedTimes===0&&E(g)),S.__cacheKey=Y,S.__webglTexture=Z[Y].texture}return U}function V(S,g,U){let X=n.TEXTURE_2D;(g.isDataArrayTexture||g.isCompressedArrayTexture)&&(X=n.TEXTURE_2D_ARRAY),g.isData3DTexture&&(X=n.TEXTURE_3D);let Z=Be(S,g),Y=g.source;t.bindTexture(X,S.__webglTexture,n.TEXTURE0+U);let pe=i.get(Y);if(Y.version!==pe.__version||Z===!0){t.activeTexture(n.TEXTURE0+U);let ne=Ne.getPrimaries(Ne.workingColorSpace),ce=g.colorSpace===Kt?null:Ne.getPrimaries(g.colorSpace),He=g.colorSpace===Kt||ne===ce?n.NONE:n.BROWSER_DEFAULT_WEBGL;n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,g.flipY),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,g.premultiplyAlpha),n.pixelStorei(n.UNPACK_ALIGNMENT,g.unpackAlignment),n.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,He);let $=M(g.image,!1,r.maxTextureSize);$=je(g,$);let de=o.convert(g.format,g.colorSpace),Ce=o.convert(g.type),De=C(g.internalFormat,de,Ce,g.colorSpace,g.isVideoTexture);me(X,g);let he,ke=g.mipmaps,be=g.isVideoTexture!==!0,Je=pe.__version===void 0||Z===!0,T=Y.dataReady,ae=N(g,$);if(g.isDepthTexture)De=v(g.format===pi,g.type),Je&&(be?t.texStorage2D(n.TEXTURE_2D,1,De,$.width,$.height):t.texImage2D(n.TEXTURE_2D,0,De,$.width,$.height,0,de,Ce,null));else if(g.isDataTexture)if(ke.length>0){be&&Je&&t.texStorage2D(n.TEXTURE_2D,ae,De,ke[0].width,ke[0].height);for(let K=0,q=ke.length;K<q;K++)he=ke[K],be?T&&t.texSubImage2D(n.TEXTURE_2D,K,0,0,he.width,he.height,de,Ce,he.data):t.texImage2D(n.TEXTURE_2D,K,De,he.width,he.height,0,de,Ce,he.data);g.generateMipmaps=!1}else be?(Je&&t.texStorage2D(n.TEXTURE_2D,ae,De,$.width,$.height),T&&t.texSubImage2D(n.TEXTURE_2D,0,0,0,$.width,$.height,de,Ce,$.data)):t.texImage2D(n.TEXTURE_2D,0,De,$.width,$.height,0,de,Ce,$.data);else if(g.isCompressedTexture)if(g.isCompressedArrayTexture){be&&Je&&t.texStorage3D(n.TEXTURE_2D_ARRAY,ae,De,ke[0].width,ke[0].height,$.depth);for(let K=0,q=ke.length;K<q;K++)if(he=ke[K],g.format!==mt)if(de!==null)if(be){if(T)if(g.layerUpdates.size>0){let ue=ra(he.width,he.height,g.format,g.type);for(let le of g.layerUpdates){let Oe=he.data.subarray(le*ue/he.data.BYTES_PER_ELEMENT,(le+1)*ue/he.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,K,0,0,le,he.width,he.height,1,de,Oe)}g.clearLayerUpdates()}else t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,K,0,0,0,he.width,he.height,$.depth,de,he.data)}else t.compressedTexImage3D(n.TEXTURE_2D_ARRAY,K,De,he.width,he.height,$.depth,0,he.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else be?T&&t.texSubImage3D(n.TEXTURE_2D_ARRAY,K,0,0,0,he.width,he.height,$.depth,de,Ce,he.data):t.texImage3D(n.TEXTURE_2D_ARRAY,K,De,he.width,he.height,$.depth,0,de,Ce,he.data)}else{be&&Je&&t.texStorage2D(n.TEXTURE_2D,ae,De,ke[0].width,ke[0].height);for(let K=0,q=ke.length;K<q;K++)he=ke[K],g.format!==mt?de!==null?be?T&&t.compressedTexSubImage2D(n.TEXTURE_2D,K,0,0,he.width,he.height,de,he.data):t.compressedTexImage2D(n.TEXTURE_2D,K,De,he.width,he.height,0,he.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):be?T&&t.texSubImage2D(n.TEXTURE_2D,K,0,0,he.width,he.height,de,Ce,he.data):t.texImage2D(n.TEXTURE_2D,K,De,he.width,he.height,0,de,Ce,he.data)}else if(g.isDataArrayTexture)if(be){if(Je&&t.texStorage3D(n.TEXTURE_2D_ARRAY,ae,De,$.width,$.height,$.depth),T)if(g.layerUpdates.size>0){let K=ra($.width,$.height,g.format,g.type);for(let q of g.layerUpdates){let ue=$.data.subarray(q*K/$.data.BYTES_PER_ELEMENT,(q+1)*K/$.data.BYTES_PER_ELEMENT);t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,q,$.width,$.height,1,de,Ce,ue)}g.clearLayerUpdates()}else t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,0,$.width,$.height,$.depth,de,Ce,$.data)}else t.texImage3D(n.TEXTURE_2D_ARRAY,0,De,$.width,$.height,$.depth,0,de,Ce,$.data);else if(g.isData3DTexture)be?(Je&&t.texStorage3D(n.TEXTURE_3D,ae,De,$.width,$.height,$.depth),T&&t.texSubImage3D(n.TEXTURE_3D,0,0,0,0,$.width,$.height,$.depth,de,Ce,$.data)):t.texImage3D(n.TEXTURE_3D,0,De,$.width,$.height,$.depth,0,de,Ce,$.data);else if(g.isFramebufferTexture){if(Je)if(be)t.texStorage2D(n.TEXTURE_2D,ae,De,$.width,$.height);else{let K=$.width,q=$.height;for(let ue=0;ue<ae;ue++)t.texImage2D(n.TEXTURE_2D,ue,De,K,q,0,de,Ce,null),K>>=1,q>>=1}}else if(ke.length>0){if(be&&Je){let K=we(ke[0]);t.texStorage2D(n.TEXTURE_2D,ae,De,K.width,K.height)}for(let K=0,q=ke.length;K<q;K++)he=ke[K],be?T&&t.texSubImage2D(n.TEXTURE_2D,K,0,0,de,Ce,he):t.texImage2D(n.TEXTURE_2D,K,De,de,Ce,he);g.generateMipmaps=!1}else if(be){if(Je){let K=we($);t.texStorage2D(n.TEXTURE_2D,ae,De,K.width,K.height)}T&&t.texSubImage2D(n.TEXTURE_2D,0,0,0,de,Ce,$)}else t.texImage2D(n.TEXTURE_2D,0,De,de,Ce,$);h(g)&&A(X),pe.__version=Y.version,g.onUpdate&&g.onUpdate(g)}S.__version=g.version}function j(S,g,U){if(g.image.length!==6)return;let X=Be(S,g),Z=g.source;t.bindTexture(n.TEXTURE_CUBE_MAP,S.__webglTexture,n.TEXTURE0+U);let Y=i.get(Z);if(Z.version!==Y.__version||X===!0){t.activeTexture(n.TEXTURE0+U);let pe=Ne.getPrimaries(Ne.workingColorSpace),ne=g.colorSpace===Kt?null:Ne.getPrimaries(g.colorSpace),ce=g.colorSpace===Kt||pe===ne?n.NONE:n.BROWSER_DEFAULT_WEBGL;n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,g.flipY),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,g.premultiplyAlpha),n.pixelStorei(n.UNPACK_ALIGNMENT,g.unpackAlignment),n.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,ce);let He=g.isCompressedTexture||g.image[0].isCompressedTexture,$=g.image[0]&&g.image[0].isDataTexture,de=[];for(let q=0;q<6;q++)!He&&!$?de[q]=M(g.image[q],!0,r.maxCubemapSize):de[q]=$?g.image[q].image:g.image[q],de[q]=je(g,de[q]);let Ce=de[0],De=o.convert(g.format,g.colorSpace),he=o.convert(g.type),ke=C(g.internalFormat,De,he,g.colorSpace),be=g.isVideoTexture!==!0,Je=Y.__version===void 0||X===!0,T=Z.dataReady,ae=N(g,Ce);me(n.TEXTURE_CUBE_MAP,g);let K;if(He){be&&Je&&t.texStorage2D(n.TEXTURE_CUBE_MAP,ae,ke,Ce.width,Ce.height);for(let q=0;q<6;q++){K=de[q].mipmaps;for(let ue=0;ue<K.length;ue++){let le=K[ue];g.format!==mt?De!==null?be?T&&t.compressedTexSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+q,ue,0,0,le.width,le.height,De,le.data):t.compressedTexImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+q,ue,ke,le.width,le.height,0,le.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):be?T&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+q,ue,0,0,le.width,le.height,De,he,le.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+q,ue,ke,le.width,le.height,0,De,he,le.data)}}}else{if(K=g.mipmaps,be&&Je){K.length>0&&ae++;let q=we(de[0]);t.texStorage2D(n.TEXTURE_CUBE_MAP,ae,ke,q.width,q.height)}for(let q=0;q<6;q++)if($){be?T&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+q,0,0,0,de[q].width,de[q].height,De,he,de[q].data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+q,0,ke,de[q].width,de[q].height,0,De,he,de[q].data);for(let ue=0;ue<K.length;ue++){let Oe=K[ue].image[q].image;be?T&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+q,ue+1,0,0,Oe.width,Oe.height,De,he,Oe.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+q,ue+1,ke,Oe.width,Oe.height,0,De,he,Oe.data)}}else{be?T&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+q,0,0,0,De,he,de[q]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+q,0,ke,De,he,de[q]);for(let ue=0;ue<K.length;ue++){let le=K[ue];be?T&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+q,ue+1,0,0,De,he,le.image[q]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+q,ue+1,ke,De,he,le.image[q])}}}h(g)&&A(n.TEXTURE_CUBE_MAP),Y.__version=Z.version,g.onUpdate&&g.onUpdate(g)}S.__version=g.version}function fe(S,g,U,X,Z,Y){let pe=o.convert(U.format,U.colorSpace),ne=o.convert(U.type),ce=C(U.internalFormat,pe,ne,U.colorSpace),He=i.get(g),$=i.get(U);if($.__renderTarget=g,!He.__hasExternalTextures){let de=Math.max(1,g.width>>Y),Ce=Math.max(1,g.height>>Y);Z===n.TEXTURE_3D||Z===n.TEXTURE_2D_ARRAY?t.texImage3D(Z,Y,ce,de,Ce,g.depth,0,pe,ne,null):t.texImage2D(Z,Y,ce,de,Ce,0,pe,ne,null)}t.bindFramebuffer(n.FRAMEBUFFER,S),Le(g)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,X,Z,$.__webglTexture,0,Fe(g)):(Z===n.TEXTURE_2D||Z>=n.TEXTURE_CUBE_MAP_POSITIVE_X&&Z<=n.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&n.framebufferTexture2D(n.FRAMEBUFFER,X,Z,$.__webglTexture,Y),t.bindFramebuffer(n.FRAMEBUFFER,null)}function ie(S,g,U){if(n.bindRenderbuffer(n.RENDERBUFFER,S),g.depthBuffer){let X=g.depthTexture,Z=X&&X.isDepthTexture?X.type:null,Y=v(g.stencilBuffer,Z),pe=g.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,ne=Fe(g);Le(g)?a.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,ne,Y,g.width,g.height):U?n.renderbufferStorageMultisample(n.RENDERBUFFER,ne,Y,g.width,g.height):n.renderbufferStorage(n.RENDERBUFFER,Y,g.width,g.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,pe,n.RENDERBUFFER,S)}else{let X=g.textures;for(let Z=0;Z<X.length;Z++){let Y=X[Z],pe=o.convert(Y.format,Y.colorSpace),ne=o.convert(Y.type),ce=C(Y.internalFormat,pe,ne,Y.colorSpace),He=Fe(g);U&&Le(g)===!1?n.renderbufferStorageMultisample(n.RENDERBUFFER,He,ce,g.width,g.height):Le(g)?a.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,He,ce,g.width,g.height):n.renderbufferStorage(n.RENDERBUFFER,ce,g.width,g.height)}}n.bindRenderbuffer(n.RENDERBUFFER,null)}function Ee(S,g){if(g&&g.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(t.bindFramebuffer(n.FRAMEBUFFER,S),!(g.depthTexture&&g.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");let X=i.get(g.depthTexture);X.__renderTarget=g,(!X.__webglTexture||g.depthTexture.image.width!==g.width||g.depthTexture.image.height!==g.height)&&(g.depthTexture.image.width=g.width,g.depthTexture.image.height=g.height,g.depthTexture.needsUpdate=!0),W(g.depthTexture,0);let Z=X.__webglTexture,Y=Fe(g);if(g.depthTexture.format===di)Le(g)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,n.DEPTH_ATTACHMENT,n.TEXTURE_2D,Z,0,Y):n.framebufferTexture2D(n.FRAMEBUFFER,n.DEPTH_ATTACHMENT,n.TEXTURE_2D,Z,0);else if(g.depthTexture.format===pi)Le(g)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,n.DEPTH_STENCIL_ATTACHMENT,n.TEXTURE_2D,Z,0,Y):n.framebufferTexture2D(n.FRAMEBUFFER,n.DEPTH_STENCIL_ATTACHMENT,n.TEXTURE_2D,Z,0);else throw new Error("Unknown depthTexture format")}function Se(S){let g=i.get(S),U=S.isWebGLCubeRenderTarget===!0;if(g.__boundDepthTexture!==S.depthTexture){let X=S.depthTexture;if(g.__depthDisposeCallback&&g.__depthDisposeCallback(),X){let Z=()=>{delete g.__boundDepthTexture,delete g.__depthDisposeCallback,X.removeEventListener("dispose",Z)};X.addEventListener("dispose",Z),g.__depthDisposeCallback=Z}g.__boundDepthTexture=X}if(S.depthTexture&&!g.__autoAllocateDepthBuffer){if(U)throw new Error("target.depthTexture not supported in Cube render targets");Ee(g.__webglFramebuffer,S)}else if(U){g.__webglDepthbuffer=[];for(let X=0;X<6;X++)if(t.bindFramebuffer(n.FRAMEBUFFER,g.__webglFramebuffer[X]),g.__webglDepthbuffer[X]===void 0)g.__webglDepthbuffer[X]=n.createRenderbuffer(),ie(g.__webglDepthbuffer[X],S,!1);else{let Z=S.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,Y=g.__webglDepthbuffer[X];n.bindRenderbuffer(n.RENDERBUFFER,Y),n.framebufferRenderbuffer(n.FRAMEBUFFER,Z,n.RENDERBUFFER,Y)}}else if(t.bindFramebuffer(n.FRAMEBUFFER,g.__webglFramebuffer),g.__webglDepthbuffer===void 0)g.__webglDepthbuffer=n.createRenderbuffer(),ie(g.__webglDepthbuffer,S,!1);else{let X=S.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,Z=g.__webglDepthbuffer;n.bindRenderbuffer(n.RENDERBUFFER,Z),n.framebufferRenderbuffer(n.FRAMEBUFFER,X,n.RENDERBUFFER,Z)}t.bindFramebuffer(n.FRAMEBUFFER,null)}function Pe(S,g,U){let X=i.get(S);g!==void 0&&fe(X.__webglFramebuffer,S,S.texture,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,0),U!==void 0&&Se(S)}function Ye(S){let g=S.texture,U=i.get(S),X=i.get(g);S.addEventListener("dispose",y);let Z=S.textures,Y=S.isWebGLCubeRenderTarget===!0,pe=Z.length>1;if(pe||(X.__webglTexture===void 0&&(X.__webglTexture=n.createTexture()),X.__version=g.version,s.memory.textures++),Y){U.__webglFramebuffer=[];for(let ne=0;ne<6;ne++)if(g.mipmaps&&g.mipmaps.length>0){U.__webglFramebuffer[ne]=[];for(let ce=0;ce<g.mipmaps.length;ce++)U.__webglFramebuffer[ne][ce]=n.createFramebuffer()}else U.__webglFramebuffer[ne]=n.createFramebuffer()}else{if(g.mipmaps&&g.mipmaps.length>0){U.__webglFramebuffer=[];for(let ne=0;ne<g.mipmaps.length;ne++)U.__webglFramebuffer[ne]=n.createFramebuffer()}else U.__webglFramebuffer=n.createFramebuffer();if(pe)for(let ne=0,ce=Z.length;ne<ce;ne++){let He=i.get(Z[ne]);He.__webglTexture===void 0&&(He.__webglTexture=n.createTexture(),s.memory.textures++)}if(S.samples>0&&Le(S)===!1){U.__webglMultisampledFramebuffer=n.createFramebuffer(),U.__webglColorRenderbuffer=[],t.bindFramebuffer(n.FRAMEBUFFER,U.__webglMultisampledFramebuffer);for(let ne=0;ne<Z.length;ne++){let ce=Z[ne];U.__webglColorRenderbuffer[ne]=n.createRenderbuffer(),n.bindRenderbuffer(n.RENDERBUFFER,U.__webglColorRenderbuffer[ne]);let He=o.convert(ce.format,ce.colorSpace),$=o.convert(ce.type),de=C(ce.internalFormat,He,$,ce.colorSpace,S.isXRRenderTarget===!0),Ce=Fe(S);n.renderbufferStorageMultisample(n.RENDERBUFFER,Ce,de,S.width,S.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+ne,n.RENDERBUFFER,U.__webglColorRenderbuffer[ne])}n.bindRenderbuffer(n.RENDERBUFFER,null),S.depthBuffer&&(U.__webglDepthRenderbuffer=n.createRenderbuffer(),ie(U.__webglDepthRenderbuffer,S,!0)),t.bindFramebuffer(n.FRAMEBUFFER,null)}}if(Y){t.bindTexture(n.TEXTURE_CUBE_MAP,X.__webglTexture),me(n.TEXTURE_CUBE_MAP,g);for(let ne=0;ne<6;ne++)if(g.mipmaps&&g.mipmaps.length>0)for(let ce=0;ce<g.mipmaps.length;ce++)fe(U.__webglFramebuffer[ne][ce],S,g,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+ne,ce);else fe(U.__webglFramebuffer[ne],S,g,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+ne,0);h(g)&&A(n.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(pe){for(let ne=0,ce=Z.length;ne<ce;ne++){let He=Z[ne],$=i.get(He);t.bindTexture(n.TEXTURE_2D,$.__webglTexture),me(n.TEXTURE_2D,He),fe(U.__webglFramebuffer,S,He,n.COLOR_ATTACHMENT0+ne,n.TEXTURE_2D,0),h(He)&&A(n.TEXTURE_2D)}t.unbindTexture()}else{let ne=n.TEXTURE_2D;if((S.isWebGL3DRenderTarget||S.isWebGLArrayRenderTarget)&&(ne=S.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),t.bindTexture(ne,X.__webglTexture),me(ne,g),g.mipmaps&&g.mipmaps.length>0)for(let ce=0;ce<g.mipmaps.length;ce++)fe(U.__webglFramebuffer[ce],S,g,n.COLOR_ATTACHMENT0,ne,ce);else fe(U.__webglFramebuffer,S,g,n.COLOR_ATTACHMENT0,ne,0);h(g)&&A(ne),t.unbindTexture()}S.depthBuffer&&Se(S)}function Te(S){let g=S.textures;for(let U=0,X=g.length;U<X;U++){let Z=g[U];if(h(Z)){let Y=w(S),pe=i.get(Z).__webglTexture;t.bindTexture(Y,pe),A(Y),t.unbindTexture()}}}let ze=[],B=[];function Xe(S){if(S.samples>0){if(Le(S)===!1){let g=S.textures,U=S.width,X=S.height,Z=n.COLOR_BUFFER_BIT,Y=S.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,pe=i.get(S),ne=g.length>1;if(ne)for(let ce=0;ce<g.length;ce++)t.bindFramebuffer(n.FRAMEBUFFER,pe.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+ce,n.RENDERBUFFER,null),t.bindFramebuffer(n.FRAMEBUFFER,pe.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+ce,n.TEXTURE_2D,null,0);t.bindFramebuffer(n.READ_FRAMEBUFFER,pe.__webglMultisampledFramebuffer),t.bindFramebuffer(n.DRAW_FRAMEBUFFER,pe.__webglFramebuffer);for(let ce=0;ce<g.length;ce++){if(S.resolveDepthBuffer&&(S.depthBuffer&&(Z|=n.DEPTH_BUFFER_BIT),S.stencilBuffer&&S.resolveStencilBuffer&&(Z|=n.STENCIL_BUFFER_BIT)),ne){n.framebufferRenderbuffer(n.READ_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.RENDERBUFFER,pe.__webglColorRenderbuffer[ce]);let He=i.get(g[ce]).__webglTexture;n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,He,0)}n.blitFramebuffer(0,0,U,X,0,0,U,X,Z,n.NEAREST),c===!0&&(ze.length=0,B.length=0,ze.push(n.COLOR_ATTACHMENT0+ce),S.depthBuffer&&S.resolveDepthBuffer===!1&&(ze.push(Y),B.push(Y),n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,B)),n.invalidateFramebuffer(n.READ_FRAMEBUFFER,ze))}if(t.bindFramebuffer(n.READ_FRAMEBUFFER,null),t.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),ne)for(let ce=0;ce<g.length;ce++){t.bindFramebuffer(n.FRAMEBUFFER,pe.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+ce,n.RENDERBUFFER,pe.__webglColorRenderbuffer[ce]);let He=i.get(g[ce]).__webglTexture;t.bindFramebuffer(n.FRAMEBUFFER,pe.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+ce,n.TEXTURE_2D,He,0)}t.bindFramebuffer(n.DRAW_FRAMEBUFFER,pe.__webglMultisampledFramebuffer)}else if(S.depthBuffer&&S.resolveDepthBuffer===!1&&c){let g=S.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,[g])}}}function Fe(S){return Math.min(r.maxSamples,S.samples)}function Le(S){let g=i.get(S);return S.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&g.__useRenderToTexture!==!1}function ge(S){let g=s.render.frame;f.get(S)!==g&&(f.set(S,g),S.update())}function je(S,g){let U=S.colorSpace,X=S.format,Z=S.type;return S.isCompressedTexture===!0||S.isVideoTexture===!0||U!==ri&&U!==Kt&&(Ne.getTransfer(U)===Ve?(X!==mt||Z!==Et)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",U)),g}function we(S){return typeof HTMLImageElement<"u"&&S instanceof HTMLImageElement?(l.width=S.naturalWidth||S.width,l.height=S.naturalHeight||S.height):typeof VideoFrame<"u"&&S instanceof VideoFrame?(l.width=S.displayWidth,l.height=S.displayHeight):(l.width=S.width,l.height=S.height),l}this.allocateTextureUnit=O,this.resetTextureUnits=G,this.setTexture2D=W,this.setTexture2DArray=Q,this.setTexture3D=J,this.setTextureCube=F,this.rebindTextures=Pe,this.setupRenderTarget=Ye,this.updateRenderTargetMipmap=Te,this.updateMultisampleRenderTarget=Xe,this.setupDepthRenderbuffer=Se,this.setupFrameBufferTexture=fe,this.useMultisampledRTT=Le}function _u(n,e){function t(i,r=Kt){let o,s=Ne.getTransfer(r);if(i===Et)return n.UNSIGNED_BYTE;if(i===un)return n.UNSIGNED_SHORT_4_4_4_4;if(i===hn)return n.UNSIGNED_SHORT_5_5_5_1;if(i===fo)return n.UNSIGNED_INT_5_9_9_9_REV;if(i===lo)return n.BYTE;if(i===Ao)return n.SHORT;if(i===Ei)return n.UNSIGNED_SHORT;if(i===fn)return n.INT;if(i===Ft)return n.UNSIGNED_INT;if(i===xt)return n.FLOAT;if(i===hi)return n.HALF_FLOAT;if(i===uo)return n.ALPHA;if(i===ho)return n.RGB;if(i===mt)return n.RGBA;if(i===po)return n.LUMINANCE;if(i===mo)return n.LUMINANCE_ALPHA;if(i===di)return n.DEPTH_COMPONENT;if(i===pi)return n.DEPTH_STENCIL;if(i===dn)return n.RED;if(i===pn)return n.RED_INTEGER;if(i===go)return n.RG;if(i===mn)return n.RG_INTEGER;if(i===gn)return n.RGBA_INTEGER;if(i===Mn||i===_n||i===xn||i===vn)if(s===Ve)if(o=e.get("WEBGL_compressed_texture_s3tc_srgb"),o!==null){if(i===Mn)return o.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===_n)return o.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===xn)return o.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===vn)return o.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(o=e.get("WEBGL_compressed_texture_s3tc"),o!==null){if(i===Mn)return o.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===_n)return o.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===xn)return o.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===vn)return o.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===Ar||i===fr||i===ur||i===hr)if(o=e.get("WEBGL_compressed_texture_pvrtc"),o!==null){if(i===Ar)return o.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===fr)return o.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===ur)return o.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===hr)return o.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===dr||i===pr||i===mr)if(o=e.get("WEBGL_compressed_texture_etc"),o!==null){if(i===dr||i===pr)return s===Ve?o.COMPRESSED_SRGB8_ETC2:o.COMPRESSED_RGB8_ETC2;if(i===mr)return s===Ve?o.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:o.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(i===gr||i===Mr||i===_r||i===xr||i===vr||i===Er||i===wr||i===Cr||i===Sr||i===Pr||i===Dr||i===yr||i===Tr||i===Br)if(o=e.get("WEBGL_compressed_texture_astc"),o!==null){if(i===gr)return s===Ve?o.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:o.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===Mr)return s===Ve?o.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:o.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===_r)return s===Ve?o.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:o.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===xr)return s===Ve?o.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:o.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===vr)return s===Ve?o.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:o.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===Er)return s===Ve?o.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:o.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===wr)return s===Ve?o.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:o.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===Cr)return s===Ve?o.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:o.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===Sr)return s===Ve?o.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:o.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===Pr)return s===Ve?o.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:o.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===Dr)return s===Ve?o.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:o.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===yr)return s===Ve?o.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:o.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===Tr)return s===Ve?o.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:o.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===Br)return s===Ve?o.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:o.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===En||i===Ir||i===br)if(o=e.get("EXT_texture_compression_bptc"),o!==null){if(i===En)return s===Ve?o.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:o.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===Ir)return o.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===br)return o.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===Mo||i===Rr||i===Lr||i===Or)if(o=e.get("EXT_texture_compression_rgtc"),o!==null){if(i===En)return o.COMPRESSED_RED_RGTC1_EXT;if(i===Rr)return o.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===Lr)return o.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===Or)return o.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return i===ni?n.UNSIGNED_INT_24_8:n[i]!==void 0?n[i]:null}return{convert:t}}var is=class extends ft{constructor(e=[]){super(),this.isArrayCamera=!0,this.cameras=e}};var sn=class extends lt{constructor(){super(),this.isGroup=!0,this.type="Group"}};var Wd={type:"move"},Xn=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new sn,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new sn,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new R,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new R),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new sn,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new R,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new R),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let i of e.hand.values())this._getHandJoint(t,i)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,i){let r=null,o=null,s=null,a=this._targetRay,c=this._grip,l=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(l&&e.hand){s=!0;for(let M of e.hand.values()){let h=t.getJointPose(M,i),A=this._getHandJoint(l,M);h!==null&&(A.matrix.fromArray(h.transform.matrix),A.matrix.decompose(A.position,A.rotation,A.scale),A.matrixWorldNeedsUpdate=!0,A.jointRadius=h.radius),A.visible=h!==null}let f=l.joints["index-finger-tip"],p=l.joints["thumb-tip"],u=f.position.distanceTo(p.position),d=.02,m=.005;l.inputState.pinching&&u>d+m?(l.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!l.inputState.pinching&&u<=d-m&&(l.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else c!==null&&e.gripSpace&&(o=t.getPose(e.gripSpace,i),o!==null&&(c.matrix.fromArray(o.transform.matrix),c.matrix.decompose(c.position,c.rotation,c.scale),c.matrixWorldNeedsUpdate=!0,o.linearVelocity?(c.hasLinearVelocity=!0,c.linearVelocity.copy(o.linearVelocity)):c.hasLinearVelocity=!1,o.angularVelocity?(c.hasAngularVelocity=!0,c.angularVelocity.copy(o.angularVelocity)):c.hasAngularVelocity=!1));a!==null&&(r=t.getPose(e.targetRaySpace,i),r===null&&o!==null&&(r=o),r!==null&&(a.matrix.fromArray(r.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,r.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(r.linearVelocity)):a.hasLinearVelocity=!1,r.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(r.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(Wd)))}return a!==null&&(a.visible=r!==null),c!==null&&(c.visible=o!==null),l!==null&&(l.visible=s!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let i=new sn;i.matrixAutoUpdate=!1,i.visible=!1,e.joints[t.jointName]=i,e.add(i)}return e.joints[t.jointName]}};var Yd=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Xd=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,ns=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t,i){if(this.texture===null){let r=new st,o=e.properties.get(r);o.__webglTexture=t.texture,(t.depthNear!=i.depthNear||t.depthFar!=i.depthFar)&&(this.depthNear=t.depthNear,this.depthFar=t.depthFar),this.texture=r}}getMesh(e){if(this.texture!==null&&this.mesh===null){let t=e.cameras[0].viewport,i=new Bt({vertexShader:Yd,fragmentShader:Xd,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new ct(new Vi(20,20),i)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}};var rs=class extends Rt{constructor(e,t){super();let i=this,r=null,o=1,s=null,a="local-floor",c=1,l=null,f=null,p=null,u=null,d=null,m=null,M=new ns,h=t.getContextAttributes(),A=null,w=null,C=[],v=[],N=new Qe,D=null,y=new ft;y.viewport=new et;let L=new ft;L.viewport=new et;let E=[y,L],x=new is,P=null,G=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(V){let j=C[V];return j===void 0&&(j=new Xn,C[V]=j),j.getTargetRaySpace()},this.getControllerGrip=function(V){let j=C[V];return j===void 0&&(j=new Xn,C[V]=j),j.getGripSpace()},this.getHand=function(V){let j=C[V];return j===void 0&&(j=new Xn,C[V]=j),j.getHandSpace()};function O(V){let j=v.indexOf(V.inputSource);if(j===-1)return;let fe=C[j];fe!==void 0&&(fe.update(V.inputSource,V.frame,l||s),fe.dispatchEvent({type:V.type,data:V.inputSource}))}function z(){r.removeEventListener("select",O),r.removeEventListener("selectstart",O),r.removeEventListener("selectend",O),r.removeEventListener("squeeze",O),r.removeEventListener("squeezestart",O),r.removeEventListener("squeezeend",O),r.removeEventListener("end",z),r.removeEventListener("inputsourceschange",W);for(let V=0;V<C.length;V++){let j=v[V];j!==null&&(v[V]=null,C[V].disconnect(j))}P=null,G=null,M.reset(),e.setRenderTarget(A),d=null,u=null,p=null,r=null,w=null,Be.stop(),i.isPresenting=!1,e.setPixelRatio(D),e.setSize(N.width,N.height,!1),i.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(V){o=V,i.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(V){a=V,i.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return l||s},this.setReferenceSpace=function(V){l=V},this.getBaseLayer=function(){return u!==null?u:d},this.getBinding=function(){return p},this.getFrame=function(){return m},this.getSession=function(){return r},this.setSession=async function(V){if(r=V,r!==null){if(A=e.getRenderTarget(),r.addEventListener("select",O),r.addEventListener("selectstart",O),r.addEventListener("selectend",O),r.addEventListener("squeeze",O),r.addEventListener("squeezestart",O),r.addEventListener("squeezeend",O),r.addEventListener("end",z),r.addEventListener("inputsourceschange",W),h.xrCompatible!==!0&&await t.makeXRCompatible(),D=e.getPixelRatio(),e.getSize(N),r.renderState.layers===void 0){let j={antialias:h.antialias,alpha:!0,depth:h.depth,stencil:h.stencil,framebufferScaleFactor:o};d=new XRWebGLLayer(r,t,j),r.updateRenderState({baseLayer:d}),e.setPixelRatio(1),e.setSize(d.framebufferWidth,d.framebufferHeight,!1),w=new Lt(d.framebufferWidth,d.framebufferHeight,{format:mt,type:Et,colorSpace:e.outputColorSpace,stencilBuffer:h.stencil})}else{let j=null,fe=null,ie=null;h.depth&&(ie=h.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,j=h.stencil?pi:di,fe=h.stencil?ni:Ft);let Ee={colorFormat:t.RGBA8,depthFormat:ie,scaleFactor:o};p=new XRWebGLBinding(r,t),u=p.createProjectionLayer(Ee),r.updateRenderState({layers:[u]}),e.setPixelRatio(1),e.setSize(u.textureWidth,u.textureHeight,!1),w=new Lt(u.textureWidth,u.textureHeight,{format:mt,type:Et,depthTexture:new Wn(u.textureWidth,u.textureHeight,fe,void 0,void 0,void 0,void 0,void 0,void 0,j),stencilBuffer:h.stencil,colorSpace:e.outputColorSpace,samples:h.antialias?4:0,resolveDepthBuffer:u.ignoreDepthValues===!1})}w.isXRRenderTarget=!0,this.setFoveation(c),l=null,s=await r.requestReferenceSpace(a),Be.setContext(r),Be.start(),i.isPresenting=!0,i.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(r!==null)return r.environmentBlendMode},this.getDepthTexture=function(){return M.getDepthTexture()};function W(V){for(let j=0;j<V.removed.length;j++){let fe=V.removed[j],ie=v.indexOf(fe);ie>=0&&(v[ie]=null,C[ie].disconnect(fe))}for(let j=0;j<V.added.length;j++){let fe=V.added[j],ie=v.indexOf(fe);if(ie===-1){for(let Se=0;Se<C.length;Se++)if(Se>=v.length){v.push(fe),ie=Se;break}else if(v[Se]===null){v[Se]=fe,ie=Se;break}if(ie===-1)break}let Ee=C[ie];Ee&&Ee.connect(fe)}}let Q=new R,J=new R;function F(V,j,fe){Q.setFromMatrixPosition(j.matrixWorld),J.setFromMatrixPosition(fe.matrixWorld);let ie=Q.distanceTo(J),Ee=j.projectionMatrix.elements,Se=fe.projectionMatrix.elements,Pe=Ee[14]/(Ee[10]-1),Ye=Ee[14]/(Ee[10]+1),Te=(Ee[9]+1)/Ee[5],ze=(Ee[9]-1)/Ee[5],B=(Ee[8]-1)/Ee[0],Xe=(Se[8]+1)/Se[0],Fe=Pe*B,Le=Pe*Xe,ge=ie/(-B+Xe),je=ge*-B;if(j.matrixWorld.decompose(V.position,V.quaternion,V.scale),V.translateX(je),V.translateZ(ge),V.matrixWorld.compose(V.position,V.quaternion,V.scale),V.matrixWorldInverse.copy(V.matrixWorld).invert(),Ee[10]===-1)V.projectionMatrix.copy(j.projectionMatrix),V.projectionMatrixInverse.copy(j.projectionMatrixInverse);else{let we=Pe+ge,S=Ye+ge,g=Fe-je,U=Le+(ie-je),X=Te*Ye/S*we,Z=ze*Ye/S*we;V.projectionMatrix.makePerspective(g,U,X,Z,we,S),V.projectionMatrixInverse.copy(V.projectionMatrix).invert()}}function ee(V,j){j===null?V.matrixWorld.copy(V.matrix):V.matrixWorld.multiplyMatrices(j.matrixWorld,V.matrix),V.matrixWorldInverse.copy(V.matrixWorld).invert()}this.updateCamera=function(V){if(r===null)return;let j=V.near,fe=V.far;M.texture!==null&&(M.depthNear>0&&(j=M.depthNear),M.depthFar>0&&(fe=M.depthFar)),x.near=L.near=y.near=j,x.far=L.far=y.far=fe,(P!==x.near||G!==x.far)&&(r.updateRenderState({depthNear:x.near,depthFar:x.far}),P=x.near,G=x.far),y.layers.mask=V.layers.mask|2,L.layers.mask=V.layers.mask|4,x.layers.mask=y.layers.mask|L.layers.mask;let ie=V.parent,Ee=x.cameras;ee(x,ie);for(let Se=0;Se<Ee.length;Se++)ee(Ee[Se],ie);Ee.length===2?F(x,y,L):x.projectionMatrix.copy(y.projectionMatrix),se(V,x,ie)};function se(V,j,fe){fe===null?V.matrix.copy(j.matrixWorld):(V.matrix.copy(fe.matrixWorld),V.matrix.invert(),V.matrix.multiply(j.matrixWorld)),V.matrix.decompose(V.position,V.quaternion,V.scale),V.updateMatrixWorld(!0),V.projectionMatrix.copy(j.projectionMatrix),V.projectionMatrixInverse.copy(j.projectionMatrixInverse),V.isPerspectiveCamera&&(V.fov=Ur*2*Math.atan(1/V.projectionMatrix.elements[5]),V.zoom=1)}this.getCamera=function(){return x},this.getFoveation=function(){if(!(u===null&&d===null))return c},this.setFoveation=function(V){c=V,u!==null&&(u.fixedFoveation=V),d!==null&&d.fixedFoveation!==void 0&&(d.fixedFoveation=V)},this.hasDepthSensing=function(){return M.texture!==null},this.getDepthSensingMesh=function(){return M.getMesh(x)};let oe=null;function me(V,j){if(f=j.getViewerPose(l||s),m=j,f!==null){let fe=f.views;d!==null&&(e.setRenderTargetFramebuffer(w,d.framebuffer),e.setRenderTarget(w));let ie=!1;fe.length!==x.cameras.length&&(x.cameras.length=0,ie=!0);for(let Se=0;Se<fe.length;Se++){let Pe=fe[Se],Ye=null;if(d!==null)Ye=d.getViewport(Pe);else{let ze=p.getViewSubImage(u,Pe);Ye=ze.viewport,Se===0&&(e.setRenderTargetTextures(w,ze.colorTexture,u.ignoreDepthValues?void 0:ze.depthStencilTexture),e.setRenderTarget(w))}let Te=E[Se];Te===void 0&&(Te=new ft,Te.layers.enable(Se),Te.viewport=new et,E[Se]=Te),Te.matrix.fromArray(Pe.transform.matrix),Te.matrix.decompose(Te.position,Te.quaternion,Te.scale),Te.projectionMatrix.fromArray(Pe.projectionMatrix),Te.projectionMatrixInverse.copy(Te.projectionMatrix).invert(),Te.viewport.set(Ye.x,Ye.y,Ye.width,Ye.height),Se===0&&(x.matrix.copy(Te.matrix),x.matrix.decompose(x.position,x.quaternion,x.scale)),ie===!0&&x.cameras.push(Te)}let Ee=r.enabledFeatures;if(Ee&&Ee.includes("depth-sensing")){let Se=p.getDepthInformation(fe[0]);Se&&Se.isValid&&Se.texture&&M.init(e,Se,r.renderState)}}for(let fe=0;fe<C.length;fe++){let ie=v[fe],Ee=C[fe];ie!==null&&Ee!==void 0&&Ee.update(ie,j,l||s)}oe&&oe(V,j),j.detectedPlanes&&i.dispatchEvent({type:"planesdetected",data:j}),m=null}let Be=new Yo;Be.setAnimationLoop(me),this.setAnimationLoop=function(V){oe=V},this.dispose=function(){}}};var an=new Ot,Jd=new We;function xu(n,e){function t(h,A){h.matrixAutoUpdate===!0&&h.updateMatrix(),A.value.copy(h.matrix)}function i(h,A){A.color.getRGB(h.fogColor.value,zo(n)),A.isFog?(h.fogNear.value=A.near,h.fogFar.value=A.far):A.isFogExp2&&(h.fogDensity.value=A.density)}function r(h,A,w,C,v){A.isMeshBasicMaterial||A.isMeshLambertMaterial?o(h,A):A.isMeshToonMaterial?(o(h,A),p(h,A)):A.isMeshPhongMaterial?(o(h,A),f(h,A)):A.isMeshStandardMaterial?(o(h,A),u(h,A),A.isMeshPhysicalMaterial&&d(h,A,v)):A.isMeshMatcapMaterial?(o(h,A),m(h,A)):A.isMeshDepthMaterial?o(h,A):A.isMeshDistanceMaterial?(o(h,A),M(h,A)):A.isMeshNormalMaterial?o(h,A):A.isLineBasicMaterial?(s(h,A),A.isLineDashedMaterial&&a(h,A)):A.isPointsMaterial?c(h,A,w,C):A.isSpriteMaterial?l(h,A):A.isShadowMaterial?(h.color.value.copy(A.color),h.opacity.value=A.opacity):A.isShaderMaterial&&(A.uniformsNeedUpdate=!1)}function o(h,A){h.opacity.value=A.opacity,A.color&&h.diffuse.value.copy(A.color),A.emissive&&h.emissive.value.copy(A.emissive).multiplyScalar(A.emissiveIntensity),A.map&&(h.map.value=A.map,t(A.map,h.mapTransform)),A.alphaMap&&(h.alphaMap.value=A.alphaMap,t(A.alphaMap,h.alphaMapTransform)),A.bumpMap&&(h.bumpMap.value=A.bumpMap,t(A.bumpMap,h.bumpMapTransform),h.bumpScale.value=A.bumpScale,A.side===ot&&(h.bumpScale.value*=-1)),A.normalMap&&(h.normalMap.value=A.normalMap,t(A.normalMap,h.normalMapTransform),h.normalScale.value.copy(A.normalScale),A.side===ot&&h.normalScale.value.negate()),A.displacementMap&&(h.displacementMap.value=A.displacementMap,t(A.displacementMap,h.displacementMapTransform),h.displacementScale.value=A.displacementScale,h.displacementBias.value=A.displacementBias),A.emissiveMap&&(h.emissiveMap.value=A.emissiveMap,t(A.emissiveMap,h.emissiveMapTransform)),A.specularMap&&(h.specularMap.value=A.specularMap,t(A.specularMap,h.specularMapTransform)),A.alphaTest>0&&(h.alphaTest.value=A.alphaTest);let w=e.get(A),C=w.envMap,v=w.envMapRotation;C&&(h.envMap.value=C,an.copy(v),an.x*=-1,an.y*=-1,an.z*=-1,C.isCubeTexture&&C.isRenderTargetTexture===!1&&(an.y*=-1,an.z*=-1),h.envMapRotation.value.setFromMatrix4(Jd.makeRotationFromEuler(an)),h.flipEnvMap.value=C.isCubeTexture&&C.isRenderTargetTexture===!1?-1:1,h.reflectivity.value=A.reflectivity,h.ior.value=A.ior,h.refractionRatio.value=A.refractionRatio),A.lightMap&&(h.lightMap.value=A.lightMap,h.lightMapIntensity.value=A.lightMapIntensity,t(A.lightMap,h.lightMapTransform)),A.aoMap&&(h.aoMap.value=A.aoMap,h.aoMapIntensity.value=A.aoMapIntensity,t(A.aoMap,h.aoMapTransform))}function s(h,A){h.diffuse.value.copy(A.color),h.opacity.value=A.opacity,A.map&&(h.map.value=A.map,t(A.map,h.mapTransform))}function a(h,A){h.dashSize.value=A.dashSize,h.totalSize.value=A.dashSize+A.gapSize,h.scale.value=A.scale}function c(h,A,w,C){h.diffuse.value.copy(A.color),h.opacity.value=A.opacity,h.size.value=A.size*w,h.scale.value=C*.5,A.map&&(h.map.value=A.map,t(A.map,h.uvTransform)),A.alphaMap&&(h.alphaMap.value=A.alphaMap,t(A.alphaMap,h.alphaMapTransform)),A.alphaTest>0&&(h.alphaTest.value=A.alphaTest)}function l(h,A){h.diffuse.value.copy(A.color),h.opacity.value=A.opacity,h.rotation.value=A.rotation,A.map&&(h.map.value=A.map,t(A.map,h.mapTransform)),A.alphaMap&&(h.alphaMap.value=A.alphaMap,t(A.alphaMap,h.alphaMapTransform)),A.alphaTest>0&&(h.alphaTest.value=A.alphaTest)}function f(h,A){h.specular.value.copy(A.specular),h.shininess.value=Math.max(A.shininess,1e-4)}function p(h,A){A.gradientMap&&(h.gradientMap.value=A.gradientMap)}function u(h,A){h.metalness.value=A.metalness,A.metalnessMap&&(h.metalnessMap.value=A.metalnessMap,t(A.metalnessMap,h.metalnessMapTransform)),h.roughness.value=A.roughness,A.roughnessMap&&(h.roughnessMap.value=A.roughnessMap,t(A.roughnessMap,h.roughnessMapTransform)),A.envMap&&(h.envMapIntensity.value=A.envMapIntensity)}function d(h,A,w){h.ior.value=A.ior,A.sheen>0&&(h.sheenColor.value.copy(A.sheenColor).multiplyScalar(A.sheen),h.sheenRoughness.value=A.sheenRoughness,A.sheenColorMap&&(h.sheenColorMap.value=A.sheenColorMap,t(A.sheenColorMap,h.sheenColorMapTransform)),A.sheenRoughnessMap&&(h.sheenRoughnessMap.value=A.sheenRoughnessMap,t(A.sheenRoughnessMap,h.sheenRoughnessMapTransform))),A.clearcoat>0&&(h.clearcoat.value=A.clearcoat,h.clearcoatRoughness.value=A.clearcoatRoughness,A.clearcoatMap&&(h.clearcoatMap.value=A.clearcoatMap,t(A.clearcoatMap,h.clearcoatMapTransform)),A.clearcoatRoughnessMap&&(h.clearcoatRoughnessMap.value=A.clearcoatRoughnessMap,t(A.clearcoatRoughnessMap,h.clearcoatRoughnessMapTransform)),A.clearcoatNormalMap&&(h.clearcoatNormalMap.value=A.clearcoatNormalMap,t(A.clearcoatNormalMap,h.clearcoatNormalMapTransform),h.clearcoatNormalScale.value.copy(A.clearcoatNormalScale),A.side===ot&&h.clearcoatNormalScale.value.negate())),A.dispersion>0&&(h.dispersion.value=A.dispersion),A.iridescence>0&&(h.iridescence.value=A.iridescence,h.iridescenceIOR.value=A.iridescenceIOR,h.iridescenceThicknessMinimum.value=A.iridescenceThicknessRange[0],h.iridescenceThicknessMaximum.value=A.iridescenceThicknessRange[1],A.iridescenceMap&&(h.iridescenceMap.value=A.iridescenceMap,t(A.iridescenceMap,h.iridescenceMapTransform)),A.iridescenceThicknessMap&&(h.iridescenceThicknessMap.value=A.iridescenceThicknessMap,t(A.iridescenceThicknessMap,h.iridescenceThicknessMapTransform))),A.transmission>0&&(h.transmission.value=A.transmission,h.transmissionSamplerMap.value=w.texture,h.transmissionSamplerSize.value.set(w.width,w.height),A.transmissionMap&&(h.transmissionMap.value=A.transmissionMap,t(A.transmissionMap,h.transmissionMapTransform)),h.thickness.value=A.thickness,A.thicknessMap&&(h.thicknessMap.value=A.thicknessMap,t(A.thicknessMap,h.thicknessMapTransform)),h.attenuationDistance.value=A.attenuationDistance,h.attenuationColor.value.copy(A.attenuationColor)),A.anisotropy>0&&(h.anisotropyVector.value.set(A.anisotropy*Math.cos(A.anisotropyRotation),A.anisotropy*Math.sin(A.anisotropyRotation)),A.anisotropyMap&&(h.anisotropyMap.value=A.anisotropyMap,t(A.anisotropyMap,h.anisotropyMapTransform))),h.specularIntensity.value=A.specularIntensity,h.specularColor.value.copy(A.specularColor),A.specularColorMap&&(h.specularColorMap.value=A.specularColorMap,t(A.specularColorMap,h.specularColorMapTransform)),A.specularIntensityMap&&(h.specularIntensityMap.value=A.specularIntensityMap,t(A.specularIntensityMap,h.specularIntensityMapTransform))}function m(h,A){A.matcap&&(h.matcap.value=A.matcap)}function M(h,A){let w=e.get(A).light;h.referencePosition.value.setFromMatrixPosition(w.matrixWorld),h.nearDistance.value=w.shadow.camera.near,h.farDistance.value=w.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:r}}function vu(n,e,t,i){let r={},o={},s=[],a=n.getParameter(n.MAX_UNIFORM_BUFFER_BINDINGS);function c(w,C){let v=C.program;i.uniformBlockBinding(w,v)}function l(w,C){let v=r[w.id];v===void 0&&(m(w),v=f(w),r[w.id]=v,w.addEventListener("dispose",h));let N=C.program;i.updateUBOMapping(w,N);let D=e.render.frame;o[w.id]!==D&&(u(w),o[w.id]=D)}function f(w){let C=p();w.__bindingPointIndex=C;let v=n.createBuffer(),N=w.__size,D=w.usage;return n.bindBuffer(n.UNIFORM_BUFFER,v),n.bufferData(n.UNIFORM_BUFFER,N,D),n.bindBuffer(n.UNIFORM_BUFFER,null),n.bindBufferBase(n.UNIFORM_BUFFER,C,v),v}function p(){for(let w=0;w<a;w++)if(s.indexOf(w)===-1)return s.push(w),w;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function u(w){let C=r[w.id],v=w.uniforms,N=w.__cache;n.bindBuffer(n.UNIFORM_BUFFER,C);for(let D=0,y=v.length;D<y;D++){let L=Array.isArray(v[D])?v[D]:[v[D]];for(let E=0,x=L.length;E<x;E++){let P=L[E];if(d(P,D,E,N)===!0){let G=P.__offset,O=Array.isArray(P.value)?P.value:[P.value],z=0;for(let W=0;W<O.length;W++){let Q=O[W],J=M(Q);typeof Q=="number"||typeof Q=="boolean"?(P.__data[0]=Q,n.bufferSubData(n.UNIFORM_BUFFER,G+z,P.__data)):Q.isMatrix3?(P.__data[0]=Q.elements[0],P.__data[1]=Q.elements[1],P.__data[2]=Q.elements[2],P.__data[3]=0,P.__data[4]=Q.elements[3],P.__data[5]=Q.elements[4],P.__data[6]=Q.elements[5],P.__data[7]=0,P.__data[8]=Q.elements[6],P.__data[9]=Q.elements[7],P.__data[10]=Q.elements[8],P.__data[11]=0):(Q.toArray(P.__data,z),z+=J.storage/Float32Array.BYTES_PER_ELEMENT)}n.bufferSubData(n.UNIFORM_BUFFER,G,P.__data)}}}n.bindBuffer(n.UNIFORM_BUFFER,null)}function d(w,C,v,N){let D=w.value,y=C+"_"+v;if(N[y]===void 0)return typeof D=="number"||typeof D=="boolean"?N[y]=D:N[y]=D.clone(),!0;{let L=N[y];if(typeof D=="number"||typeof D=="boolean"){if(L!==D)return N[y]=D,!0}else if(L.equals(D)===!1)return L.copy(D),!0}return!1}function m(w){let C=w.uniforms,v=0,N=16;for(let y=0,L=C.length;y<L;y++){let E=Array.isArray(C[y])?C[y]:[C[y]];for(let x=0,P=E.length;x<P;x++){let G=E[x],O=Array.isArray(G.value)?G.value:[G.value];for(let z=0,W=O.length;z<W;z++){let Q=O[z],J=M(Q),F=v%N,ee=F%J.boundary,se=F+ee;v+=ee,se!==0&&N-se<J.storage&&(v+=N-se),G.__data=new Float32Array(J.storage/Float32Array.BYTES_PER_ELEMENT),G.__offset=v,v+=J.storage}}}let D=v%N;return D>0&&(v+=N-D),w.__size=v,w.__cache={},this}function M(w){let C={boundary:0,storage:0};return typeof w=="number"||typeof w=="boolean"?(C.boundary=4,C.storage=4):w.isVector2?(C.boundary=8,C.storage=8):w.isVector3||w.isColor?(C.boundary=16,C.storage=12):w.isVector4?(C.boundary=16,C.storage=16):w.isMatrix3?(C.boundary=48,C.storage=48):w.isMatrix4?(C.boundary=64,C.storage=64):w.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",w),C}function h(w){let C=w.target;C.removeEventListener("dispose",h);let v=s.indexOf(C.__bindingPointIndex);s.splice(v,1),n.deleteBuffer(r[C.id]),delete r[C.id],delete o[C.id]}function A(){for(let w in r)n.deleteBuffer(r[w]);s=[],r={},o={}}return{bind:c,update:l,dispose:A}}var zr=class{constructor(e={}){let{canvas:t=dc(),context:i=null,depth:r=!0,stencil:o=!1,alpha:s=!1,antialias:a=!1,premultipliedAlpha:c=!0,preserveDrawingBuffer:l=!1,powerPreference:f="default",failIfMajorPerformanceCaveat:p=!1,reverseDepthBuffer:u=!1}=e;this.isWebGLRenderer=!0;let d;if(i!==null){if(typeof WebGLRenderingContext<"u"&&i instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");d=i.getContextAttributes().alpha}else d=s;let m=new Uint32Array(4),M=new Int32Array(4),h=null,A=null,w=[],C=[];this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this._outputColorSpace=yt,this.toneMapping=Vt,this.toneMappingExposure=1;let v=this,N=!1,D=0,y=0,L=null,E=-1,x=null,P=new et,G=new et,O=null,z=new Ge(0),W=0,Q=t.width,J=t.height,F=1,ee=null,se=null,oe=new et(0,0,Q,J),me=new et(0,0,Q,J),Be=!1,V=new zn,j=!1,fe=!1,ie=new We,Ee=new We,Se=new R,Pe=new et,Ye={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},Te=!1;function ze(){return L===null?F:1}let B=i;function Xe(_,I){return t.getContext(_,I)}try{let _={alpha:!0,depth:r,stencil:o,antialias:a,premultipliedAlpha:c,preserveDrawingBuffer:l,powerPreference:f,failIfMajorPerformanceCaveat:p};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${"170"}`),t.addEventListener("webglcontextlost",q,!1),t.addEventListener("webglcontextrestored",ue,!1),t.addEventListener("webglcontextcreationerror",le,!1),B===null){let I="webgl2";if(B=Xe(I,_),B===null)throw Xe(I)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(_){throw console.error("THREE.WebGLRenderer: "+_.message),_}let Fe,Le,ge,je,we,S,g,U,X,Z,Y,pe,ne,ce,He,$,de,Ce,De,he,ke,be,Je,T;function ae(){Fe=new Uf(B),Fe.init(),be=new _u(B,Fe),Le=new Pf(B,Fe,e,be),ge=new gu(B,Fe),Le.reverseDepthBuffer&&u&&ge.buffers.depth.setReversed(!0),je=new Qf(B),we=new au,S=new Mu(B,Fe,ge,we,Le,be,je),g=new yf(v),U=new Of(v),X=new kc(B),Je=new Cf(B,X),Z=new Nf(B,X,je,Je),Y=new Hf(B,Z,X,je),De=new Gf(B,Le,S),$=new Df(we),pe=new su(v,g,U,Fe,Le,Je,$),ne=new xu(v,we),ce=new Au,He=new hu(Fe),Ce=new wf(v,g,U,ge,Y,d,c),de=new mu(v,Y,Le),T=new vu(B,je,Le,ge),he=new Sf(B,Fe,je),ke=new Ff(B,Fe,je),je.programs=pe.programs,v.capabilities=Le,v.extensions=Fe,v.properties=we,v.renderLists=ce,v.shadowMap=de,v.state=ge,v.info=je}ae();let K=new rs(v,B);this.xr=K,this.getContext=function(){return B},this.getContextAttributes=function(){return B.getContextAttributes()},this.forceContextLoss=function(){let _=Fe.get("WEBGL_lose_context");_&&_.loseContext()},this.forceContextRestore=function(){let _=Fe.get("WEBGL_lose_context");_&&_.restoreContext()},this.getPixelRatio=function(){return F},this.setPixelRatio=function(_){_!==void 0&&(F=_,this.setSize(Q,J,!1))},this.getSize=function(_){return _.set(Q,J)},this.setSize=function(_,I,H=!0){if(K.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}Q=_,J=I,t.width=Math.floor(_*F),t.height=Math.floor(I*F),H===!0&&(t.style.width=_+"px",t.style.height=I+"px"),this.setViewport(0,0,_,I)},this.getDrawingBufferSize=function(_){return _.set(Q*F,J*F).floor()},this.setDrawingBufferSize=function(_,I,H){Q=_,J=I,F=H,t.width=Math.floor(_*H),t.height=Math.floor(I*H),this.setViewport(0,0,_,I)},this.getCurrentViewport=function(_){return _.copy(P)},this.getViewport=function(_){return _.copy(oe)},this.setViewport=function(_,I,H,k){_.isVector4?oe.set(_.x,_.y,_.z,_.w):oe.set(_,I,H,k),ge.viewport(P.copy(oe).multiplyScalar(F).round())},this.getScissor=function(_){return _.copy(me)},this.setScissor=function(_,I,H,k){_.isVector4?me.set(_.x,_.y,_.z,_.w):me.set(_,I,H,k),ge.scissor(G.copy(me).multiplyScalar(F).round())},this.getScissorTest=function(){return Be},this.setScissorTest=function(_){ge.setScissorTest(Be=_)},this.setOpaqueSort=function(_){ee=_},this.setTransparentSort=function(_){se=_},this.getClearColor=function(_){return _.copy(Ce.getClearColor())},this.setClearColor=function(){Ce.setClearColor.apply(Ce,arguments)},this.getClearAlpha=function(){return Ce.getClearAlpha()},this.setClearAlpha=function(){Ce.setClearAlpha.apply(Ce,arguments)},this.clear=function(_=!0,I=!0,H=!0){let k=0;if(_){let b=!1;if(L!==null){let te=L.texture.format;b=te===gn||te===mn||te===pn}if(b){let te=L.texture.type,Ae=te===Et||te===Ft||te===Ei||te===ni||te===un||te===hn,Me=Ce.getClearColor(),_e=Ce.getClearAlpha(),Ie=Me.r,Ue=Me.g,xe=Me.b;Ae?(m[0]=Ie,m[1]=Ue,m[2]=xe,m[3]=_e,B.clearBufferuiv(B.COLOR,0,m)):(M[0]=Ie,M[1]=Ue,M[2]=xe,M[3]=_e,B.clearBufferiv(B.COLOR,0,M))}else k|=B.COLOR_BUFFER_BIT}I&&(k|=B.DEPTH_BUFFER_BIT),H&&(k|=B.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),B.clear(k)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){t.removeEventListener("webglcontextlost",q,!1),t.removeEventListener("webglcontextrestored",ue,!1),t.removeEventListener("webglcontextcreationerror",le,!1),ce.dispose(),He.dispose(),we.dispose(),g.dispose(),U.dispose(),Y.dispose(),Je.dispose(),T.dispose(),pe.dispose(),K.dispose(),K.removeEventListener("sessionstart",ua),K.removeEventListener("sessionend",ha),Wi.stop()};function q(_){_.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),N=!0}function ue(){console.log("THREE.WebGLRenderer: Context Restored."),N=!1;let _=je.autoReset,I=de.enabled,H=de.autoUpdate,k=de.needsUpdate,b=de.type;ae(),je.autoReset=_,de.enabled=I,de.autoUpdate=H,de.needsUpdate=k,de.type=b}function le(_){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",_.statusMessage)}function Oe(_){let I=_.target;I.removeEventListener("dispose",Oe),at(I)}function at(_){vt(_),we.remove(_)}function vt(_){let I=we.get(_).programs;I!==void 0&&(I.forEach(function(H){pe.releaseProgram(H)}),_.isShaderMaterial&&pe.releaseShaderCache(_))}this.renderBufferDirect=function(_,I,H,k,b,te){I===null&&(I=Ye);let Ae=b.isMesh&&b.matrixWorld.determinant()<0,Me=Hu(_,I,H,k,b);ge.setMaterial(k,Ae);let _e=H.index,Ie=1;if(k.wireframe===!0){if(_e=Z.getWireframeAttribute(H),_e===void 0)return;Ie=2}let Ue=H.drawRange,xe=H.attributes.position,Ke=Ue.start*Ie,tt=(Ue.start+Ue.count)*Ie;te!==null&&(Ke=Math.max(Ke,te.start*Ie),tt=Math.min(tt,(te.start+te.count)*Ie)),_e!==null?(Ke=Math.max(Ke,0),tt=Math.min(tt,_e.count)):xe!=null&&(Ke=Math.max(Ke,0),tt=Math.min(tt,xe.count));let it=tt-Ke;if(it<0||it===1/0)return;Je.setup(b,k,Me,H,_e);let It,qe=he;if(_e!==null&&(It=X.get(_e),qe=ke,qe.setIndex(It)),b.isMesh)k.wireframe===!0?(ge.setLineWidth(k.wireframeLinewidth*ze()),qe.setMode(B.LINES)):qe.setMode(B.TRIANGLES);else if(b.isLine){let ve=k.linewidth;ve===void 0&&(ve=1),ge.setLineWidth(ve*ze()),b.isLineSegments?qe.setMode(B.LINES):b.isLineLoop?qe.setMode(B.LINE_LOOP):qe.setMode(B.LINE_STRIP)}else b.isPoints?qe.setMode(B.POINTS):b.isSprite&&qe.setMode(B.TRIANGLES);if(b.isBatchedMesh)if(b._multiDrawInstances!==null)qe.renderMultiDrawInstances(b._multiDrawStarts,b._multiDrawCounts,b._multiDrawCount,b._multiDrawInstances);else if(Fe.get("WEBGL_multi_draw"))qe.renderMultiDraw(b._multiDrawStarts,b._multiDrawCounts,b._multiDrawCount);else{let ve=b._multiDrawStarts,_i=b._multiDrawCounts,Ze=b._multiDrawCount,jt=_e?X.get(_e).bytesPerElement:1,An=we.get(k).currentProgram.getUniforms();for(let Ut=0;Ut<Ze;Ut++)An.setValue(B,"_gl_DrawID",Ut),qe.render(ve[Ut]/jt,_i[Ut])}else if(b.isInstancedMesh)qe.renderInstances(Ke,it,b.count);else if(H.isInstancedBufferGeometry){let ve=H._maxInstanceCount!==void 0?H._maxInstanceCount:1/0,_i=Math.min(H.instanceCount,ve);qe.renderInstances(Ke,it,_i)}else qe.render(Ke,it)};function $e(_,I,H){_.transparent===!0&&_.side===_t&&_.forceSinglePass===!1?(_.side=ot,_.needsUpdate=!0,jr(_,I,H),_.side=Nt,_.needsUpdate=!0,jr(_,I,H),_.side=_t):jr(_,I,H)}this.compile=function(_,I,H=null){H===null&&(H=_),A=He.get(H),A.init(I),C.push(A),H.traverseVisible(function(b){b.isLight&&b.layers.test(I.layers)&&(A.pushLight(b),b.castShadow&&A.pushShadow(b))}),_!==H&&_.traverseVisible(function(b){b.isLight&&b.layers.test(I.layers)&&(A.pushLight(b),b.castShadow&&A.pushShadow(b))}),A.setupLights();let k=new Set;return _.traverse(function(b){if(!(b.isMesh||b.isPoints||b.isLine||b.isSprite))return;let te=b.material;if(te)if(Array.isArray(te))for(let Ae=0;Ae<te.length;Ae++){let Me=te[Ae];$e(Me,H,b),k.add(Me)}else $e(te,H,b),k.add(te)}),C.pop(),A=null,k},this.compileAsync=function(_,I,H=null){let k=this.compile(_,I,H);return new Promise(b=>{function te(){if(k.forEach(function(Ae){we.get(Ae).currentProgram.isReady()&&k.delete(Ae)}),k.size===0){b(_);return}setTimeout(te,10)}Fe.get("KHR_parallel_shader_compile")!==null?te():setTimeout(te,10)})};let Zt=null;function Mi(_){Zt&&Zt(_)}function ua(){Wi.stop()}function ha(){Wi.start()}let Wi=new Yo;Wi.setAnimationLoop(Mi),typeof self<"u"&&Wi.setContext(self),this.setAnimationLoop=function(_){Zt=_,K.setAnimationLoop(_),_===null?Wi.stop():Wi.start()},K.addEventListener("sessionstart",ua),K.addEventListener("sessionend",ha),this.render=function(_,I){if(I!==void 0&&I.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(N===!0)return;if(_.matrixWorldAutoUpdate===!0&&_.updateMatrixWorld(),I.parent===null&&I.matrixWorldAutoUpdate===!0&&I.updateMatrixWorld(),K.enabled===!0&&K.isPresenting===!0&&(K.cameraAutoUpdate===!0&&K.updateCamera(I),I=K.getCamera()),_.isScene===!0&&_.onBeforeRender(v,_,I,L),A=He.get(_,C.length),A.init(I),C.push(A),Ee.multiplyMatrices(I.projectionMatrix,I.matrixWorldInverse),V.setFromProjectionMatrix(Ee),fe=this.localClippingEnabled,j=$.init(this.clippingPlanes,fe),h=ce.get(_,w.length),h.init(),w.push(h),K.enabled===!0&&K.isPresenting===!0){let te=v.xr.getDepthSensingMesh();te!==null&&ms(te,I,-1/0,v.sortObjects)}ms(_,I,0,v.sortObjects),h.finish(),v.sortObjects===!0&&h.sort(ee,se),Te=K.enabled===!1||K.isPresenting===!1||K.hasDepthSensing()===!1,Te&&Ce.addToRenderList(h,_),this.info.render.frame++,j===!0&&$.beginShadows();let H=A.state.shadowsArray;de.render(H,_,I),j===!0&&$.endShadows(),this.info.autoReset===!0&&this.info.reset();let k=h.opaque,b=h.transmissive;if(A.setupLights(),I.isArrayCamera){let te=I.cameras;if(b.length>0)for(let Ae=0,Me=te.length;Ae<Me;Ae++){let _e=te[Ae];pa(k,b,_,_e)}Te&&Ce.render(_);for(let Ae=0,Me=te.length;Ae<Me;Ae++){let _e=te[Ae];da(h,_,_e,_e.viewport)}}else b.length>0&&pa(k,b,_,I),Te&&Ce.render(_),da(h,_,I);L!==null&&(S.updateMultisampleRenderTarget(L),S.updateRenderTargetMipmap(L)),_.isScene===!0&&_.onAfterRender(v,_,I),Je.resetDefaultState(),E=-1,x=null,C.pop(),C.length>0?(A=C[C.length-1],j===!0&&$.setGlobalState(v.clippingPlanes,A.state.camera)):A=null,w.pop(),w.length>0?h=w[w.length-1]:h=null};function ms(_,I,H,k){if(_.visible===!1)return;if(_.layers.test(I.layers)){if(_.isGroup)H=_.renderOrder;else if(_.isLOD)_.autoUpdate===!0&&_.update(I);else if(_.isLight)A.pushLight(_),_.castShadow&&A.pushShadow(_);else if(_.isSprite){if(!_.frustumCulled||V.intersectsSprite(_)){k&&Pe.setFromMatrixPosition(_.matrixWorld).applyMatrix4(Ee);let Ae=Y.update(_),Me=_.material;Me.visible&&h.push(_,Ae,Me,H,Pe.z,null)}}else if((_.isMesh||_.isLine||_.isPoints)&&(!_.frustumCulled||V.intersectsObject(_))){let Ae=Y.update(_),Me=_.material;if(k&&(_.boundingSphere!==void 0?(_.boundingSphere===null&&_.computeBoundingSphere(),Pe.copy(_.boundingSphere.center)):(Ae.boundingSphere===null&&Ae.computeBoundingSphere(),Pe.copy(Ae.boundingSphere.center)),Pe.applyMatrix4(_.matrixWorld).applyMatrix4(Ee)),Array.isArray(Me)){let _e=Ae.groups;for(let Ie=0,Ue=_e.length;Ie<Ue;Ie++){let xe=_e[Ie],Ke=Me[xe.materialIndex];Ke&&Ke.visible&&h.push(_,Ae,Ke,H,Pe.z,xe)}}else Me.visible&&h.push(_,Ae,Me,H,Pe.z,null)}}let te=_.children;for(let Ae=0,Me=te.length;Ae<Me;Ae++)ms(te[Ae],I,H,k)}function da(_,I,H,k){let b=_.opaque,te=_.transmissive,Ae=_.transparent;A.setupLightsView(H),j===!0&&$.setGlobalState(v.clippingPlanes,H),k&&ge.viewport(P.copy(k)),b.length>0&&Zr(b,I,H),te.length>0&&Zr(te,I,H),Ae.length>0&&Zr(Ae,I,H),ge.buffers.depth.setTest(!0),ge.buffers.depth.setMask(!0),ge.buffers.color.setMask(!0),ge.setPolygonOffset(!1)}function pa(_,I,H,k){if((H.isScene===!0?H.overrideMaterial:null)!==null)return;A.state.transmissionRenderTarget[k.id]===void 0&&(A.state.transmissionRenderTarget[k.id]=new Lt(1,1,{generateMipmaps:!0,type:Fe.has("EXT_color_buffer_half_float")||Fe.has("EXT_color_buffer_float")?hi:Et,minFilter:ii,samples:4,stencilBuffer:o,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:Ne.workingColorSpace}));let te=A.state.transmissionRenderTarget[k.id],Ae=k.viewport||P;te.setSize(Ae.z,Ae.w);let Me=v.getRenderTarget();v.setRenderTarget(te),v.getClearColor(z),W=v.getClearAlpha(),W<1&&v.setClearColor(16777215,.5),v.clear(),Te&&Ce.render(H);let _e=v.toneMapping;v.toneMapping=Vt;let Ie=k.viewport;if(k.viewport!==void 0&&(k.viewport=void 0),A.setupLightsView(k),j===!0&&$.setGlobalState(v.clippingPlanes,k),Zr(_,H,k),S.updateMultisampleRenderTarget(te),S.updateRenderTargetMipmap(te),Fe.has("WEBGL_multisampled_render_to_texture")===!1){let Ue=!1;for(let xe=0,Ke=I.length;xe<Ke;xe++){let tt=I[xe],it=tt.object,It=tt.geometry,qe=tt.material,ve=tt.group;if(qe.side===_t&&it.layers.test(k.layers)){let _i=qe.side;qe.side=ot,qe.needsUpdate=!0,ma(it,H,k,It,qe,ve),qe.side=_i,qe.needsUpdate=!0,Ue=!0}}Ue===!0&&(S.updateMultisampleRenderTarget(te),S.updateRenderTargetMipmap(te))}v.setRenderTarget(Me),v.setClearColor(z,W),Ie!==void 0&&(k.viewport=Ie),v.toneMapping=_e}function Zr(_,I,H){let k=I.isScene===!0?I.overrideMaterial:null;for(let b=0,te=_.length;b<te;b++){let Ae=_[b],Me=Ae.object,_e=Ae.geometry,Ie=k===null?Ae.material:k,Ue=Ae.group;Me.layers.test(H.layers)&&ma(Me,I,H,_e,Ie,Ue)}}function ma(_,I,H,k,b,te){_.onBeforeRender(v,I,H,k,b,te),_.modelViewMatrix.multiplyMatrices(H.matrixWorldInverse,_.matrixWorld),_.normalMatrix.getNormalMatrix(_.modelViewMatrix),b.onBeforeRender(v,I,H,k,_,te),b.transparent===!0&&b.side===_t&&b.forceSinglePass===!1?(b.side=ot,b.needsUpdate=!0,v.renderBufferDirect(H,I,k,b,_,te),b.side=Nt,b.needsUpdate=!0,v.renderBufferDirect(H,I,k,b,_,te),b.side=_t):v.renderBufferDirect(H,I,k,b,_,te),_.onAfterRender(v,I,H,k,b,te)}function jr(_,I,H){I.isScene!==!0&&(I=Ye);let k=we.get(_),b=A.state.lights,te=A.state.shadowsArray,Ae=b.state.version,Me=pe.getParameters(_,b.state,te,I,H),_e=pe.getProgramCacheKey(Me),Ie=k.programs;k.environment=_.isMeshStandardMaterial?I.environment:null,k.fog=I.fog,k.envMap=(_.isMeshStandardMaterial?U:g).get(_.envMap||k.environment),k.envMapRotation=k.environment!==null&&_.envMap===null?I.environmentRotation:_.envMapRotation,Ie===void 0&&(_.addEventListener("dispose",Oe),Ie=new Map,k.programs=Ie);let Ue=Ie.get(_e);if(Ue!==void 0){if(k.currentProgram===Ue&&k.lightsStateVersion===Ae)return Ma(_,Me),Ue}else Me.uniforms=pe.getUniforms(_),_.onBeforeCompile(Me,v),Ue=pe.acquireProgram(Me,_e),Ie.set(_e,Ue),k.uniforms=Me.uniforms;let xe=k.uniforms;return(!_.isShaderMaterial&&!_.isRawShaderMaterial||_.clipping===!0)&&(xe.clippingPlanes=$.uniform),Ma(_,Me),k.needsLights=zu(_),k.lightsStateVersion=Ae,k.needsLights&&(xe.ambientLightColor.value=b.state.ambient,xe.lightProbe.value=b.state.probe,xe.directionalLights.value=b.state.directional,xe.directionalLightShadows.value=b.state.directionalShadow,xe.spotLights.value=b.state.spot,xe.spotLightShadows.value=b.state.spotShadow,xe.rectAreaLights.value=b.state.rectArea,xe.ltc_1.value=b.state.rectAreaLTC1,xe.ltc_2.value=b.state.rectAreaLTC2,xe.pointLights.value=b.state.point,xe.pointLightShadows.value=b.state.pointShadow,xe.hemisphereLights.value=b.state.hemi,xe.directionalShadowMap.value=b.state.directionalShadowMap,xe.directionalShadowMatrix.value=b.state.directionalShadowMatrix,xe.spotShadowMap.value=b.state.spotShadowMap,xe.spotLightMatrix.value=b.state.spotLightMatrix,xe.spotLightMap.value=b.state.spotLightMap,xe.pointShadowMap.value=b.state.pointShadowMap,xe.pointShadowMatrix.value=b.state.pointShadowMatrix),k.currentProgram=Ue,k.uniformsList=null,Ue}function ga(_){if(_.uniformsList===null){let I=_.currentProgram.getUniforms();_.uniformsList=Ki.seqWithValue(I.seq,_.uniforms)}return _.uniformsList}function Ma(_,I){let H=we.get(_);H.outputColorSpace=I.outputColorSpace,H.batching=I.batching,H.batchingColor=I.batchingColor,H.instancing=I.instancing,H.instancingColor=I.instancingColor,H.instancingMorph=I.instancingMorph,H.skinning=I.skinning,H.morphTargets=I.morphTargets,H.morphNormals=I.morphNormals,H.morphColors=I.morphColors,H.morphTargetsCount=I.morphTargetsCount,H.numClippingPlanes=I.numClippingPlanes,H.numIntersection=I.numClipIntersection,H.vertexAlphas=I.vertexAlphas,H.vertexTangents=I.vertexTangents,H.toneMapping=I.toneMapping}function Hu(_,I,H,k,b){I.isScene!==!0&&(I=Ye),S.resetTextureUnits();let te=I.fog,Ae=k.isMeshStandardMaterial?I.environment:null,Me=L===null?v.outputColorSpace:L.isXRRenderTarget===!0?L.texture.colorSpace:ri,_e=(k.isMeshStandardMaterial?U:g).get(k.envMap||Ae),Ie=k.vertexColors===!0&&!!H.attributes.color&&H.attributes.color.itemSize===4,Ue=!!H.attributes.tangent&&(!!k.normalMap||k.anisotropy>0),xe=!!H.morphAttributes.position,Ke=!!H.morphAttributes.normal,tt=!!H.morphAttributes.color,it=Vt;k.toneMapped&&(L===null||L.isXRRenderTarget===!0)&&(it=v.toneMapping);let It=H.morphAttributes.position||H.morphAttributes.normal||H.morphAttributes.color,qe=It!==void 0?It.length:0,ve=we.get(k),_i=A.state.lights;if(j===!0&&(fe===!0||_!==x)){let kt=_===x&&k.id===E;$.setState(k,_,kt)}let Ze=!1;k.version===ve.__version?(ve.needsLights&&ve.lightsStateVersion!==_i.state.version||ve.outputColorSpace!==Me||b.isBatchedMesh&&ve.batching===!1||!b.isBatchedMesh&&ve.batching===!0||b.isBatchedMesh&&ve.batchingColor===!0&&b.colorTexture===null||b.isBatchedMesh&&ve.batchingColor===!1&&b.colorTexture!==null||b.isInstancedMesh&&ve.instancing===!1||!b.isInstancedMesh&&ve.instancing===!0||b.isSkinnedMesh&&ve.skinning===!1||!b.isSkinnedMesh&&ve.skinning===!0||b.isInstancedMesh&&ve.instancingColor===!0&&b.instanceColor===null||b.isInstancedMesh&&ve.instancingColor===!1&&b.instanceColor!==null||b.isInstancedMesh&&ve.instancingMorph===!0&&b.morphTexture===null||b.isInstancedMesh&&ve.instancingMorph===!1&&b.morphTexture!==null||ve.envMap!==_e||k.fog===!0&&ve.fog!==te||ve.numClippingPlanes!==void 0&&(ve.numClippingPlanes!==$.numPlanes||ve.numIntersection!==$.numIntersection)||ve.vertexAlphas!==Ie||ve.vertexTangents!==Ue||ve.morphTargets!==xe||ve.morphNormals!==Ke||ve.morphColors!==tt||ve.toneMapping!==it||ve.morphTargetsCount!==qe)&&(Ze=!0):(Ze=!0,ve.__version=k.version);let jt=ve.currentProgram;Ze===!0&&(jt=jr(k,I,b));let An=!1,Ut=!1,tr=!1,nt=jt.getUniforms(),fi=ve.uniforms;if(ge.useProgram(jt.program)&&(An=!0,Ut=!0,tr=!0),k.id!==E&&(E=k.id,Ut=!0),An||x!==_){ge.buffers.depth.getReversed()?(ie.copy(_.projectionMatrix),mc(ie),gc(ie),nt.setValue(B,"projectionMatrix",ie)):nt.setValue(B,"projectionMatrix",_.projectionMatrix),nt.setValue(B,"viewMatrix",_.matrixWorldInverse);let bi=nt.map.cameraPosition;bi!==void 0&&bi.setValue(B,Se.setFromMatrixPosition(_.matrixWorld)),Le.logarithmicDepthBuffer&&nt.setValue(B,"logDepthBufFC",2/(Math.log(_.far+1)/Math.LN2)),(k.isMeshPhongMaterial||k.isMeshToonMaterial||k.isMeshLambertMaterial||k.isMeshBasicMaterial||k.isMeshStandardMaterial||k.isShaderMaterial)&&nt.setValue(B,"isOrthographic",_.isOrthographicCamera===!0),x!==_&&(x=_,Ut=!0,tr=!0)}if(b.isSkinnedMesh){nt.setOptional(B,b,"bindMatrix"),nt.setOptional(B,b,"bindMatrixInverse");let kt=b.skeleton;kt&&(kt.boneTexture===null&&kt.computeBoneTexture(),nt.setValue(B,"boneTexture",kt.boneTexture,S))}b.isBatchedMesh&&(nt.setOptional(B,b,"batchingTexture"),nt.setValue(B,"batchingTexture",b._matricesTexture,S),nt.setOptional(B,b,"batchingIdTexture"),nt.setValue(B,"batchingIdTexture",b._indirectTexture,S),nt.setOptional(B,b,"batchingColorTexture"),b._colorsTexture!==null&&nt.setValue(B,"batchingColorTexture",b._colorsTexture,S));let ir=H.morphAttributes;if((ir.position!==void 0||ir.normal!==void 0||ir.color!==void 0)&&De.update(b,H,jt),(Ut||ve.receiveShadow!==b.receiveShadow)&&(ve.receiveShadow=b.receiveShadow,nt.setValue(B,"receiveShadow",b.receiveShadow)),k.isMeshGouraudMaterial&&k.envMap!==null&&(fi.envMap.value=_e,fi.flipEnvMap.value=_e.isCubeTexture&&_e.isRenderTargetTexture===!1?-1:1),k.isMeshStandardMaterial&&k.envMap===null&&I.environment!==null&&(fi.envMapIntensity.value=I.environmentIntensity),Ut&&(nt.setValue(B,"toneMappingExposure",v.toneMappingExposure),ve.needsLights&&ku(fi,tr),te&&k.fog===!0&&ne.refreshFogUniforms(fi,te),ne.refreshMaterialUniforms(fi,k,F,J,A.state.transmissionRenderTarget[_.id]),Ki.upload(B,ga(ve),fi,S)),k.isShaderMaterial&&k.uniformsNeedUpdate===!0&&(Ki.upload(B,ga(ve),fi,S),k.uniformsNeedUpdate=!1),k.isSpriteMaterial&&nt.setValue(B,"center",b.center),nt.setValue(B,"modelViewMatrix",b.modelViewMatrix),nt.setValue(B,"normalMatrix",b.normalMatrix),nt.setValue(B,"modelMatrix",b.matrixWorld),k.isShaderMaterial||k.isRawShaderMaterial){let kt=k.uniformsGroups;for(let bi=0,Ri=kt.length;bi<Ri;bi++){let _a=kt[bi];T.update(_a,jt),T.bind(_a,jt)}}return jt}function ku(_,I){_.ambientLightColor.needsUpdate=I,_.lightProbe.needsUpdate=I,_.directionalLights.needsUpdate=I,_.directionalLightShadows.needsUpdate=I,_.pointLights.needsUpdate=I,_.pointLightShadows.needsUpdate=I,_.spotLights.needsUpdate=I,_.spotLightShadows.needsUpdate=I,_.rectAreaLights.needsUpdate=I,_.hemisphereLights.needsUpdate=I}function zu(_){return _.isMeshLambertMaterial||_.isMeshToonMaterial||_.isMeshPhongMaterial||_.isMeshStandardMaterial||_.isShadowMaterial||_.isShaderMaterial&&_.lights===!0}this.getActiveCubeFace=function(){return D},this.getActiveMipmapLevel=function(){return y},this.getRenderTarget=function(){return L},this.setRenderTargetTextures=function(_,I,H){we.get(_.texture).__webglTexture=I,we.get(_.depthTexture).__webglTexture=H;let k=we.get(_);k.__hasExternalTextures=!0,k.__autoAllocateDepthBuffer=H===void 0,k.__autoAllocateDepthBuffer||Fe.has("WEBGL_multisampled_render_to_texture")===!0&&(console.warn("THREE.WebGLRenderer: Render-to-texture extension was disabled because an external texture was provided"),k.__useRenderToTexture=!1)},this.setRenderTargetFramebuffer=function(_,I){let H=we.get(_);H.__webglFramebuffer=I,H.__useDefaultFramebuffer=I===void 0},this.setRenderTarget=function(_,I=0,H=0){L=_,D=I,y=H;let k=!0,b=null,te=!1,Ae=!1;if(_){let _e=we.get(_);if(_e.__useDefaultFramebuffer!==void 0)ge.bindFramebuffer(B.FRAMEBUFFER,null),k=!1;else if(_e.__webglFramebuffer===void 0)S.setupRenderTarget(_);else if(_e.__hasExternalTextures)S.rebindTextures(_,we.get(_.texture).__webglTexture,we.get(_.depthTexture).__webglTexture);else if(_.depthBuffer){let xe=_.depthTexture;if(_e.__boundDepthTexture!==xe){if(xe!==null&&we.has(xe)&&(_.width!==xe.image.width||_.height!==xe.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");S.setupDepthRenderbuffer(_)}}let Ie=_.texture;(Ie.isData3DTexture||Ie.isDataArrayTexture||Ie.isCompressedArrayTexture)&&(Ae=!0);let Ue=we.get(_).__webglFramebuffer;_.isWebGLCubeRenderTarget?(Array.isArray(Ue[I])?b=Ue[I][H]:b=Ue[I],te=!0):_.samples>0&&S.useMultisampledRTT(_)===!1?b=we.get(_).__webglMultisampledFramebuffer:Array.isArray(Ue)?b=Ue[H]:b=Ue,P.copy(_.viewport),G.copy(_.scissor),O=_.scissorTest}else P.copy(oe).multiplyScalar(F).floor(),G.copy(me).multiplyScalar(F).floor(),O=Be;if(ge.bindFramebuffer(B.FRAMEBUFFER,b)&&k&&ge.drawBuffers(_,b),ge.viewport(P),ge.scissor(G),ge.setScissorTest(O),te){let _e=we.get(_.texture);B.framebufferTexture2D(B.FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_CUBE_MAP_POSITIVE_X+I,_e.__webglTexture,H)}else if(Ae){let _e=we.get(_.texture),Ie=I||0;B.framebufferTextureLayer(B.FRAMEBUFFER,B.COLOR_ATTACHMENT0,_e.__webglTexture,H||0,Ie)}E=-1},this.readRenderTargetPixels=function(_,I,H,k,b,te,Ae){if(!(_&&_.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Me=we.get(_).__webglFramebuffer;if(_.isWebGLCubeRenderTarget&&Ae!==void 0&&(Me=Me[Ae]),Me){ge.bindFramebuffer(B.FRAMEBUFFER,Me);try{let _e=_.texture,Ie=_e.format,Ue=_e.type;if(!Le.textureFormatReadable(Ie)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!Le.textureTypeReadable(Ue)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}I>=0&&I<=_.width-k&&H>=0&&H<=_.height-b&&B.readPixels(I,H,k,b,be.convert(Ie),be.convert(Ue),te)}finally{let _e=L!==null?we.get(L).__webglFramebuffer:null;ge.bindFramebuffer(B.FRAMEBUFFER,_e)}}},this.readRenderTargetPixelsAsync=async function(_,I,H,k,b,te,Ae){if(!(_&&_.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Me=we.get(_).__webglFramebuffer;if(_.isWebGLCubeRenderTarget&&Ae!==void 0&&(Me=Me[Ae]),Me){let _e=_.texture,Ie=_e.format,Ue=_e.type;if(!Le.textureFormatReadable(Ie))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!Le.textureTypeReadable(Ue))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");if(I>=0&&I<=_.width-k&&H>=0&&H<=_.height-b){ge.bindFramebuffer(B.FRAMEBUFFER,Me);let xe=B.createBuffer();B.bindBuffer(B.PIXEL_PACK_BUFFER,xe),B.bufferData(B.PIXEL_PACK_BUFFER,te.byteLength,B.STREAM_READ),B.readPixels(I,H,k,b,be.convert(Ie),be.convert(Ue),0);let Ke=L!==null?we.get(L).__webglFramebuffer:null;ge.bindFramebuffer(B.FRAMEBUFFER,Ke);let tt=B.fenceSync(B.SYNC_GPU_COMMANDS_COMPLETE,0);return B.flush(),await pc(B,tt,4),B.bindBuffer(B.PIXEL_PACK_BUFFER,xe),B.getBufferSubData(B.PIXEL_PACK_BUFFER,0,te),B.deleteBuffer(xe),B.deleteSync(tt),te}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")}},this.copyFramebufferToTexture=function(_,I=null,H=0){_.isTexture!==!0&&(qi("WebGLRenderer: copyFramebufferToTexture function signature has changed."),I=arguments[0]||null,_=arguments[1]);let k=Math.pow(2,-H),b=Math.floor(_.image.width*k),te=Math.floor(_.image.height*k),Ae=I!==null?I.x:0,Me=I!==null?I.y:0;S.setTexture2D(_,0),B.copyTexSubImage2D(B.TEXTURE_2D,H,0,0,Ae,Me,b,te),ge.unbindTexture()},this.copyTextureToTexture=function(_,I,H=null,k=null,b=0){_.isTexture!==!0&&(qi("WebGLRenderer: copyTextureToTexture function signature has changed."),k=arguments[0]||null,_=arguments[1],I=arguments[2],b=arguments[3]||0,H=null);let te,Ae,Me,_e,Ie,Ue,xe,Ke,tt,it=_.isCompressedTexture?_.mipmaps[b]:_.image;H!==null?(te=H.max.x-H.min.x,Ae=H.max.y-H.min.y,Me=H.isBox3?H.max.z-H.min.z:1,_e=H.min.x,Ie=H.min.y,Ue=H.isBox3?H.min.z:0):(te=it.width,Ae=it.height,Me=it.depth||1,_e=0,Ie=0,Ue=0),k!==null?(xe=k.x,Ke=k.y,tt=k.z):(xe=0,Ke=0,tt=0);let It=be.convert(I.format),qe=be.convert(I.type),ve;I.isData3DTexture?(S.setTexture3D(I,0),ve=B.TEXTURE_3D):I.isDataArrayTexture||I.isCompressedArrayTexture?(S.setTexture2DArray(I,0),ve=B.TEXTURE_2D_ARRAY):(S.setTexture2D(I,0),ve=B.TEXTURE_2D),B.pixelStorei(B.UNPACK_FLIP_Y_WEBGL,I.flipY),B.pixelStorei(B.UNPACK_PREMULTIPLY_ALPHA_WEBGL,I.premultiplyAlpha),B.pixelStorei(B.UNPACK_ALIGNMENT,I.unpackAlignment);let _i=B.getParameter(B.UNPACK_ROW_LENGTH),Ze=B.getParameter(B.UNPACK_IMAGE_HEIGHT),jt=B.getParameter(B.UNPACK_SKIP_PIXELS),An=B.getParameter(B.UNPACK_SKIP_ROWS),Ut=B.getParameter(B.UNPACK_SKIP_IMAGES);B.pixelStorei(B.UNPACK_ROW_LENGTH,it.width),B.pixelStorei(B.UNPACK_IMAGE_HEIGHT,it.height),B.pixelStorei(B.UNPACK_SKIP_PIXELS,_e),B.pixelStorei(B.UNPACK_SKIP_ROWS,Ie),B.pixelStorei(B.UNPACK_SKIP_IMAGES,Ue);let tr=_.isDataArrayTexture||_.isData3DTexture,nt=I.isDataArrayTexture||I.isData3DTexture;if(_.isRenderTargetTexture||_.isDepthTexture){let fi=we.get(_),ir=we.get(I),kt=we.get(fi.__renderTarget),bi=we.get(ir.__renderTarget);ge.bindFramebuffer(B.READ_FRAMEBUFFER,kt.__webglFramebuffer),ge.bindFramebuffer(B.DRAW_FRAMEBUFFER,bi.__webglFramebuffer);for(let Ri=0;Ri<Me;Ri++)tr&&B.framebufferTextureLayer(B.READ_FRAMEBUFFER,B.COLOR_ATTACHMENT0,we.get(_).__webglTexture,b,Ue+Ri),_.isDepthTexture?(nt&&B.framebufferTextureLayer(B.DRAW_FRAMEBUFFER,B.COLOR_ATTACHMENT0,we.get(I).__webglTexture,b,tt+Ri),B.blitFramebuffer(_e,Ie,te,Ae,xe,Ke,te,Ae,B.DEPTH_BUFFER_BIT,B.NEAREST)):nt?B.copyTexSubImage3D(ve,b,xe,Ke,tt+Ri,_e,Ie,te,Ae):B.copyTexSubImage2D(ve,b,xe,Ke,tt+Ri,_e,Ie,te,Ae);ge.bindFramebuffer(B.READ_FRAMEBUFFER,null),ge.bindFramebuffer(B.DRAW_FRAMEBUFFER,null)}else nt?_.isDataTexture||_.isData3DTexture?B.texSubImage3D(ve,b,xe,Ke,tt,te,Ae,Me,It,qe,it.data):I.isCompressedArrayTexture?B.compressedTexSubImage3D(ve,b,xe,Ke,tt,te,Ae,Me,It,it.data):B.texSubImage3D(ve,b,xe,Ke,tt,te,Ae,Me,It,qe,it):_.isDataTexture?B.texSubImage2D(B.TEXTURE_2D,b,xe,Ke,te,Ae,It,qe,it.data):_.isCompressedTexture?B.compressedTexSubImage2D(B.TEXTURE_2D,b,xe,Ke,it.width,it.height,It,it.data):B.texSubImage2D(B.TEXTURE_2D,b,xe,Ke,te,Ae,It,qe,it);B.pixelStorei(B.UNPACK_ROW_LENGTH,_i),B.pixelStorei(B.UNPACK_IMAGE_HEIGHT,Ze),B.pixelStorei(B.UNPACK_SKIP_PIXELS,jt),B.pixelStorei(B.UNPACK_SKIP_ROWS,An),B.pixelStorei(B.UNPACK_SKIP_IMAGES,Ut),b===0&&I.generateMipmaps&&B.generateMipmap(ve),ge.unbindTexture()},this.copyTextureToTexture3D=function(_,I,H=null,k=null,b=0){return _.isTexture!==!0&&(qi("WebGLRenderer: copyTextureToTexture3D function signature has changed."),H=arguments[0]||null,k=arguments[1]||null,_=arguments[2],I=arguments[3],b=arguments[4]||0),qi('WebGLRenderer: copyTextureToTexture3D function has been deprecated. Use "copyTextureToTexture" instead.'),this.copyTextureToTexture(_,I,H,k,b)},this.initRenderTarget=function(_){we.get(_).__webglFramebuffer===void 0&&S.setupRenderTarget(_)},this.initTexture=function(_){_.isCubeTexture?S.setTextureCube(_,0):_.isData3DTexture?S.setTexture3D(_,0):_.isDataArrayTexture||_.isCompressedArrayTexture?S.setTexture2DArray(_,0):S.setTexture2D(_,0),ge.unbindTexture()},this.resetState=function(){D=0,y=0,L=null,ge.reset(),Je.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return bt}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorspace=Ne._getDrawingBufferColorSpace(e),t.unpackColorSpace=Ne._getUnpackColorSpace()}};var Jn=class extends lt{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Ot,this.environmentIntensity=1,this.environmentRotation=new Ot,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}};var os=class extends st{constructor(e=null,t=1,i=1,r,o,s,a,c,l=ut,f=ut,p,u){super(null,s,a,c,l,f,r,o,p,u),this.isDataTexture=!0,this.image={data:e,width:t,height:i},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var Vr=class extends rt{constructor(e,t,i,r=1){super(e,t,i),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=r}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){let e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}};var qn=new We,Eu=new We,ss=[],wu=new Wt,qd=new We,Kr=new ct,Wr=new ai,Zn=class extends ct{constructor(e,t,i){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new Vr(new Float32Array(i*16),16),this.instanceColor=null,this.morphTexture=null,this.count=i,this.boundingBox=null,this.boundingSphere=null;for(let r=0;r<i;r++)this.setMatrixAt(r,qd)}computeBoundingBox(){let e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new Wt),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let i=0;i<t;i++)this.getMatrixAt(i,qn),wu.copy(e.boundingBox).applyMatrix4(qn),this.boundingBox.union(wu)}computeBoundingSphere(){let e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new ai),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let i=0;i<t;i++)this.getMatrixAt(i,qn),Wr.copy(e.boundingSphere).applyMatrix4(qn),this.boundingSphere.union(Wr)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){let i=t.morphTargetInfluences,r=this.morphTexture.source.data.data,o=i.length+1,s=e*o+1;for(let a=0;a<i.length;a++)i[a]=r[s+a]}raycast(e,t){let i=this.matrixWorld,r=this.count;if(Kr.geometry=this.geometry,Kr.material=this.material,Kr.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Wr.copy(this.boundingSphere),Wr.applyMatrix4(i),e.ray.intersectsSphere(Wr)!==!1))for(let o=0;o<r;o++){this.getMatrixAt(o,qn),Eu.multiplyMatrices(i,qn),Kr.matrixWorld=Eu,Kr.raycast(e,ss);for(let s=0,a=ss.length;s<a;s++){let c=ss[s];c.instanceId=o,c.object=this,t.push(c)}ss.length=0}}setColorAt(e,t){this.instanceColor===null&&(this.instanceColor=new Vr(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),t.toArray(this.instanceColor.array,e*3)}setMatrixAt(e,t){t.toArray(this.instanceMatrix.array,e*16)}setMorphAt(e,t){let i=t.morphTargetInfluences,r=i.length+1;this.morphTexture===null&&(this.morphTexture=new os(new Float32Array(r*this.count),r,this.count,dn,xt));let o=this.morphTexture.source.data.data,s=0;for(let l=0;l<i.length;l++)s+=i[l];let a=this.geometry.morphTargetsRelative?1:1-s,c=r*e;o[c]=a,o.set(i,c+1)}updateMorphTargets(){}dispose(){return this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null),this}};var Yr=class extends st{constructor(e,t,i,r,o,s,a,c,l){super(e,t,i,r,o,s,a,c,l),this.isCanvasTexture=!0,this.needsUpdate=!0}};typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"170"}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="170");var Cu={frameSHA256:"04a0f3dabcf446d71c101e7530381488648161d02d7a681fc52d51d44e1b7bc2",kits:[{height:3.99902,crown:[-.29634,3.99902,.2527],parts:23,position:"kfnsNfcF+v56NtgFif5xO7wIIPnjOtsIrPgSPlIDFf6gPjMDh/6pOU8AHvkbOW4Ah/6pOU8AFf6gPjMDif5xO7wI+v56NtgFkfnsNfcFIPnjOtsIrPgSPlIDHvkbOW4AFf6gPjMDrPgSPlIDIPnjOtsIif5xO7wI+v56NtgFkfnsNfcFHvkbOW4Ah/6pOU8ACvhHIosAlgK0ItsAbQKzJuMA4fdGJpMABfhSJsf7kQK/Jhf8ugLAIg/8LvhTIr/7ugLAIg/8kQK/Jhf8bQKzJuMAlgK0ItsACvhHIosA4fdGJpMABfhSJsf7LvhTIr/7kQK/Jhf8BfhSJsf74fdGJpMAbQKzJuMAlgK0ItsACvhHIosALvhTIr/7ugLAIg/8eveGJVEA0AIeJuQAigIVKyEBNPd8Ko4AbPe4KvX7wgJQK4j8CANaJkv8svfBJbj7CANaJkv8wgJQK4j8igIVKyEB0AIeJuQAeveGJVEANPd8Ko4AbPe4KvX7svfBJbj7wgJQK4j8bPe4KvX7NPd8Ko4AigIVKyEB0AIeJuQAeveGJVEAsvfBJbj7CANaJkv8Kfc2KVkAogLoKSwBTgLaLpQB1fYpLsAAJPeOLiv8nAI/L//88AJNKpj8ePebKcT78AJNKpj8nAI/L//8TgLaLpQBogLoKSwBKfc2KVkA1fYpLsAAJPeOLiv8ePebKcT7nAI/L//8JPeOLiv81fYpLsAATgLaLpQBogLoKSwBKfc2KVkAePebKcT78AJNKpj82vbyLGkASAKoLa0B6gGXMjUCffbhMfEA9fZoMmP8YwIdM6f9wAIuLh/9U/d5Ldv7wAIuLh/9YwIdM6f96gGXMjUCSAKoLa0B2vbyLGkAffbhMfEA9fZoMmP8U/d5Ldv7YwIdM6f99fZoMmP8ffbhMfEA6gGXMjUCSAKoLa0B2vbyLGkAU/d5Ldv7wAIuLh/9Xfa1MI0ACwJlMU0CqQFRNusC+/WhNSsBn/Y/Nqb8TQLvNmb+rwIDMsf9AfdTMQj8rwIDMsf9TQLvNmb+qQFRNusCCwJlMU0CXfa1MI0A+/WhNSsBn/Y/Nqb8AfdTMQj8TQLvNmb+n/Y/Nqb8+/WhNSsBqQFRNusCCwJlMU0CXfa1MI0AAfdTMQj8rwIDMsf9ZgCeNQ8Aa/zNMj0Kbf8MM3wLaAPdNU0B8QO3MqMA9v/lL9IK9PymL5QJ7wB3MmX/9PymL5QJ9v/lL9IKbf8MM3wLa/zNMj0KZgCeNQ8AaAPdNU0B8QO3MqMA7wB3MmX/9v/lL9IK8QO3MqMAaAPdNU0Bbf8MM3wLa/zNMj0KZgCeNQ8A7wB3MmX/9PymL5QJW/2XMaUI//vIOU0KtP4BOmwLEADRMcMJBv8bMWsMqv1LORQO9foSOfUMUfzhMEwL9foSOfUMqv1LORQOtP4BOmwL//vIOU0KW/2XMaUIEADRMcMJBv8bMWsMUfzhMEwLqv1LORQOBv8bMWsMEADRMcMJtP4BOmwL//vIOU0KW/2XMaUIUfzhMEwL9foSOfUMC/+UPN8NJP35PsQNT/7VPS0Lcf7JOnYLXP0MOjoOjvyiPKcPSPrtPQ8OXfuqPksLK/wUPN4JlPu9OcELavrhOlgOrfkiPKYLJ//bPG0NKv8ePfUMFf9aPXsM6P6OPQQMpf63PZMLLv87PHwNOP/kOxINKf+QO6YMAv9EOzsMxP4BO9QL9f4UPA0OyP6XOzAOhv4hO0YOMf61OlAOzf1YOkwOy/6cPFgOdf6iPMMODf6mPB0Pl/2nPGIPFf2mPJEPm/28PuMNCP5qPvcNZf4GPgEOsv6UPQAO6f4XPfUNQf41Po4LJP6GPvkL9/3DPmwMvP3sPuEMdf3+PlUNnf5CO0cLtv7FOyULuv5NPBELqv7VPAsLhv5ZPRULrf36Oc0N8/38OVcNK/4TOtwMVP4+OmAMa/58OucLvfwhPKQP6fyiO4cPEP0pO1IPMP27OggPSv1bOqkOGf2/PkAOB/1wPq8O7/wPPg0P0vyfPVgPsvwkPYsPofwDP+0NHPz1PgsOmfvRPh4OHPuXPiUOq/pKPiAO5P0lPgwLbP1mPvoK6/yVPvgKZfywPgUL3/u3PiELLf7mOgIL2f0QO54KeP1FO0wKDv2DOw8KnfzJO+oJF/3COdwNzPyQOXUNffx1OQgNLfx0OZgM3vuMOSoMIvxNPKoPufv4O5MPVfunO2QP+fpbOx4PqvoZO8QOjPrQPYMO4PqmPegOQPtxPTkPq/szPXYPG/ztPJsPovvzPqkL7fsmPxAMPPxAP30MjPxCP+0M2vwqP1sNlvxpPNsJAP2+PPIJZP0PPSEKv/1bPWcKDv6dPcEKF/yzOZkLnfzBOXsLIP3lOWgLnP0eOmALDv5rOmUL1PqROnkOTPtQOosOzfshOo4OU/wGOoEO2vz+OWQOG/pzPT4OA/rxPGAO/vlpPHUOD/rhO3oOM/pcO3AOC/u8PrgLxfq6Pi4MjfqjPqkMZfp4PiUNTfo6Pp4N/PuVPOIJ0PsUPf4JqfuNPTMKiPv7PX4Kb/tbPtwKoPv3OUULsvtGOtYKyvunOngK5vsXOy4KB/ySO/oJd/qAOvcNlfowOowNwvrzORkN/frKOaQMRPu4OTAMkvnbOxkMjvmYO5AMpPlbOwoN0PkoO4ENE/r+OvIN9fm1PbENt/lyPUoNj/kmPd8MgfnSPHMMi/l7PAoM7PpePjoLh/oBPjYLMvqVPT8L8fkfPVULxPmiPHgLo/sQPPQJIvsOPCMKq/oQPGgKQ/oUPMIK7vkaPC0LHfv6OaMLsfpMOo4LU/qwOoQLB/oiO4ULz/mfO5AL/f5fPX8Nk/4UPvoL6/25PnAN9P6pPf4M0P7nPXsMb/5gPnUMN/6YPvQMXP5YPnwNuf7jPYENof4qPvoMQv+CPAUN6/5/O6kL2P43PYALQv8oPI0MJf/ROxgM//4RPI8L+f6lPIELF/8APfwLO//DPH8MLf9nPAMMEP+6O6YNHP5NOtoNuf63OksM1/4yO8INhf63OtMNZv5cOlkNm/6AOtIM8P4BO8AMDv9YOzUNxv7ROk0NrP4bPIQORf0jPIUPuf2uOrcORv4bPPEOzf0ePEgPd/2eO1oPn/0gOxQPHf4dO7oOb/6YO6gO+/2ZOw8Pof4gPWsOjv15PlwOOf0oPWwPWP6hPXgO+/0WPnMOff0ZPs0OYf2nPSkPwf0tPS4POv4rPdcO5f2rPdwOPvxvPXYPkvzBPmYO9vopPpEOWvzxPTQPd/xjPtgOA/ylPocOePtyPpUOWvv7PfUOyfu8PUIP5/s8PvAOKP0nP+gM0P2CPnILKPz6PoMLbP0LP2YMpf3TPugLS/3EPmoLu/zsPnALgPwmP/ML1/w1P2wMF/0KP+YLQP4cPa0KU/5lO9YKC/0fPPAJWv6KPKUKYf71O7MK9P2cO3EKhf3bOyMKf/12PBUK5/3LPFQK+f0yPFcKAv4hOtsLZf23OWoNZfyKOQUM3P3kOV4Mp/3AOeQMFv2LOfMMwPx8OXsM9/yhOe4Lgv3UOeALU/2hOWoMxPxUOtAOUPzKO54PHPvNOuEOoPzCOi4PefxAO3QP4/trO3oPe/sVOzoPpPuSOvIOM/xpOuwODPzkOkIPrvuXPJUPZvpRPa8OefqZO9gOM/vbPGIPxPoaPRUPV/rAPNIOXvosPOAO0frrOzEPOvtAPHEPwPqEPC4PVPwsP4ANU/v/PhsMt/qUPqoN+fs6PwsNovsrP5IMEfv2PqEM3PrSPigNNvvhPqUNwvsVP5cNZfsVPxsNnf3pPaQKaPzsPOcJ9PthPrUKPv2hPUsK1fxLPQsKQPx1PREKGfz0PVcKhfxNPpkKFf0kPpMKrfzSPUMKw/2NOvQKJvz1OR8Le/xHOw8KQP1EOvAKtfwROv4KQvxSOq4KXvzEOlIK7/z6OkMKXv27OpAK0vx6OpUKkfy7OQIO6Po0OhMOkPuPOZ0M/fvKORUObvvyORsOFPvjOZ4NTPurOR8N4vuBORkNOfyQOZINofusOZ8N4fl/OwUOzvk2PdwNd/k0PIAMwPkRPAQOufmlPPYNlPnlPG0NdvmNPPgMffnzOwYNofm2O4kNjPlPPIINAPr+PTsNnPppPqwLqfn8PN8LHvo2PrMMUvpaPiwMNPr/PbIL4vmDPcMLq/lePVAMyPm1PcUM8/nlPTgMAPsIPs4KdPuSPAEKDfqbPAILGvuWPXEKQfsYPSsK7PqYPD4KcvqaPJQKSfoePd0KnPqZPcsKvfocPXYKf/uOOxkKKvs8OikLGPqWOxoLWPsPO1wKO/udOrgKvfqgOhILYPoUOw0LfvqLO64K9/qIO1cK1PoKO6kKzvr9ORUMJvqiOosNu/lXOwYMgvoeOpIMSfpWOhAN6fnPOgsNxfkMO4cMAPrSOgQMXfpeOgkMF/qLOosM/Pl+MokJKfgSNbP+8fQQNT3/xPZ8MhMKpvZOL1cJ0/TiMYD+DPjkMfb93/lQL80IDPjkMfb90/TiMYD+8fQQNT3/KfgSNbP+/Pl+MokJxPZ8MhMKpvZOL1cJ3/lQL80I0/TiMYD+pvZOL1cJxPZ8MhMK8fQQNT3/KfgSNbP+/Pl+MokJ3/lQL80IDPjkMfb9uvl/ORkJh/kjMcQHofYhMUAI1fZ9OZUJUPcFOXEMHPepMBwLAvqrMKAKNfoHOfULAvqrMKAKHPepMBwLofYhMUAIh/kjMcQHuvl/ORkJ1fZ9OZUJUPcFOXEMNfoHOfULHPepMBwLUPcFOXEM1fZ9OZUJofYhMUAIh/kjMcQHuvl/ORkJNfoHOfULAvqrMKAKt/UgPLYLPvePOQkL4fa6O+gIG/d0PkkKm/f3PUQNsffxOroNE/rQOSwMkvlNOjEJfflTPboI7/m1PmwLTPqJPI0NdvskPL8KrvULPC4LvfX3O6cK5fXkOyUKJfbTO60JevbFO0IJufWaPHcL1PUQPTYLB/Z+PfUKUPbgPbYKrfYzPnwK1PWAPBMMCPbePGkMU/Y1PbUMsfaCPfQMH/fEPSQN2PXiOysMEfalO5kMX/ZtO/sMwfY8O04NM/cSO44NzfbWOScLa/YxOkcLHPadOmYL4/UXO4MLwfWZO54LyvY/Ox4Jw/bKOmcJy/ZiOsAJ4/YIOiUKCvfBOZQK6vYePukJyPa3PZUJtvZCPU8JtPbEPBkJw/ZAPPcIaPc+PtoMQPdzPmEMI/eTPt8LE/eePlcLEPeUPs4KlvdyO+ANhPf6O+4NfPeCPOUNffcIPcUNh/eGPY4NNPeYOZELN/e3ORcMRffrOZUMX/cyOggNg/eLOmsNsfddOUALLfhCOXYLq/hBOasLKvlZOdwLo/mJOQcMRPdlO70Is/cXO6kIKvjROqoIpPiXOsIIHflqOu8Ic/dyPuAJ1fdcPoIJPvgyPjQJqvj3PfcIFvmsPc4I/fdLPhUNZPiNPtcMzfi5PooMNPnPPjIMlvnOPtILJPgnO+8NmvhmOwwOEfmrOxAOg/n1O/wN7fk/PNANuvnSOZUMWPnoOfIM7/gROkENg/hNOn0NGPiYOqYNMPn4OV8Jyfi3OZ4JYPiLOeoJ+fd1OUMKl/d2OaMKCvkdPYYIk/jePGkIHfiYPGQIqvdPPHkIQPcEPKUIfPnnPjULAfkBP/4KgvgCP8oKBPjrPpkKi/e7Pm0K6fnePLcNevktPcwNBPlzPcoNivitPbINEPjZPYUNQ/omOowMZfqNOuAMd/oBOyYNefqAO1sNa/oEPH4NxfkGOpsJ7fnRORMKCvqxOZYKGvqmOR4LHfqwOacLl/nSPJUIqflKPIYIsvnBO48Isfk8O7AIpvm+OuYI+fmsPuMK9/mNPl4K6PlZPt8Jz/kRPm0Jqvm5PQoJY/oFPVcNa/p5PQ4NYvriPbUMSvo7PlAMJPqDPuELgPs5PEYLcPtNPM0LSPtgPE8MCPtwPMgMs/p+PDMNgPoROvgL3fpkOr4LJvvGOoALWfs0Oz8LdPuqO/4KDvqAOlAJffrCOoAJ2/oPO78JJftmOwsKWvvDO2EK+vkyPeYIbPoIPScJzvrWPHoJHfuePNsJVftiPEkKYfpuPk0Lw/oTPi4LEfumPQ8LS/stPfIKbfurPNcKv/WDOxQLZ/ZKO4AJm/YROrMK3PVoO4QKFfZVO/wJYvbTOtkJdPZpOkEKOfZ9Os8K7vX6OvAKGvbiOl4KuPWGPO0KgPbVPR8KYPZMPFgJ4PUAPaEKI/ZxPVwKXvZdPc0JU/bZPIoJDfZiPNIJ1PV2PFsKDPbxPA8K3vX8PNML7/YFPrMMpvZMPgULIfZiPSgMffa8PXQMxPYyPiwMq/ZKPpoLS/btPUwLCPZ7PZELWvbgPeUL/fVCPIkMGveXO6wNDvdMPWkNRvYIPP0MpvbOO2ANBvcrPK8NAve/PJgNnfb7PDINQfahPOYMmfZlPFYN6vVZOxMMxvbnObILB/evOjYNG/bPOvoLZfZSOtkLyvYWOj8M3/ZZOsMMkvbbOuUMMvYVO4MMcvaLOmQM7fc0Ok8NrPdtOcoLRfmSOW4Mz/faOdwMufeWOVkMMvhdOQoMvPhpOUEM0/iwOcoMX/jnORYNRPiUOZYMZ/ewOS4KM/fpOvsIt/gbOiQJSPcEOrYJNvduOk8JrfeUOvEIMPhOOv8IQvjgOWsJ0fe8OcUJt/ceOlAJJ/eMPLsIR/cVPoIJn/hyPaEII/cbPeYILvefPSkJsvfwPSAJJvi5PdQIG/gvPY4InPfhPJcIn/dxPdAIhffUPvYKzveOPqQMHvn5PpoLk/fYPosLrPfAPhwMO/jNPlYMrfjxPvwLlPgKP2ULCvj+Pi0LHvj0PsYLAPhiPcsNDPitOw0OhPmTPPQN/vfVPP0NAvhCPBQOi/j5OyMOCvlHPBoOBfnhPAIOgvgmPfQNg/iRPBsOjvjSOtQN5vkvOvMMBvq4O7oNB/mKOqANe/lTOlQNAPqkOksNCvopO48NkfliO94NEvkVO+YNjvnTOqUNEPhLOdoKYPm2OdAJqPlwOX4LgPhSOXkK8vh2OR8KgvmDOVkKmvlsOeoKJPlGOUcLmvg6ORALEPlQOa4KqfewO4EIIfmXPGcILvniOqoIJPj9O1sIo/hKPFIIK/kCPGEIMPluO3cIq/gdO4AIKPhjO3IIqvizO1kI6feyPgYKgfnXPqsKQPkPPiYJcfjaPjMK+/jnPmsKdPmuPhwKXvlqPpkJzvhdPl8JWviUPqsJ6fiwPt8JdvgpPlEN+/laPXoNxvmTPkcM/vj2PXYNgfmwPYMN9/nWPSYN5fk/Pr4MXfmIPrAM6/hkPgkNdvklPiQNzvr3OxwNrfpuOlYMdfu+O4gL2vprO+sMz/rmOqcMCvvSOhkMTvtEO9QLWfvOOxoMIPvhO6IMIftTO2UMh/r4OW8LP/o+OsEJT/tIO6IKgvr6OdoKavoROkkKsPqIOgAKDPvhOkwKJvvJOuQK4vpXOikL0/pkOpAKIPr4OgsJE/qsPMgIMPsBPOwJLPqFO9wIKPoZPMYIh/p2PBUJ6Po8PHcJ7PqjO48JkPpJO0MJlPrfOx4JJ/qVPT4JZ/pdPsMKQ/vqPGIKTvrrPbIJZPouPjUKyPryPZwKEvt1PXsK/PovPfIJm/ppPZAJvPq5PRAKkvozPsILxvr6PPUMbvvBPGALuvrbPTQMy/pxPZsMGfvvPHkMUfvbPPALP/tKPYQL9frHPaULE/tiPRcMYfoQNDgBW/54NCIBAf5pOG0DBvoBOIQDvvn+OQ8AuP1mOvj/E/51Nqz9GPoNNsP9E/51Nqz9uP1mOvj/Af5pOG0DW/54NCIBYfoQNDgBBvoBOIQDvvn+OQ8AGPoNNsP9uP1mOvj/vvn+OQ8ABvoBOIQDAf5pOG0DW/54NCIBYfoQNDgBGPoNNsP9E/51Nqz9qQGBEk8CUwakE2ECgQJqI88A1/1HIr0ABf7YIfb7rgL7Igj8gQY1E5r91wESEoj9gQY1E5r9rgL7Igj8gQJqI88AUwakE2ECqQGBEk8C1/1HIr0ABf7YIfb71wESEoj9rgL7Igj8Bf7YIfb71/1HIr0AgQJqI88AUwakE2ECqQGBEk8C1wESEoj9gQY1E5r91wUtA+T64gkpBPT6SQZ8Et8BPgJ/Ec8B4QE6Ewv+7AU2FBr+hAnjBTD3egXnBCD3hAnjBTD37AU2FBr+SQZ8Et8B4gkpBPT61wUtA+T6PgJ/Ec8B4QE6Ewv+egXnBCD37AU2FBr+4QE6Ewv+PgJ/Ec8BSQZ8Et8B4gkpBPT61wUtA+T6egXnBCD3hAnjBTD3HAMJALD8sQwHAAv8sgyCBBL8HgOEBLf8qgKOBAL2PgyMBF31PQwRAFf1qQITAPz1PQwRAFf1PgyMBF31sgyCBBL8sQwHAAv8HAMJALD8HgOEBLf8qgKOBAL2qQITAPz1PgyMBF31qgKOBAL2HgOEBLf8sgyCBBL8sQwHAAv8HAMJALD8qQITAPz1PQwRAFf1gAMWAHgCFA0UANMBFA2PBMkBgAORBG4CHQOEBK78sQyCBAn8sQwHABT8HQMJALn8sQwHABT8sQyCBAn8FA2PBMkBFA0UANMBgAMWAHgCgAORBG4CHQOEBK78HQMJALn8sQyCBAn8HQOEBK78gAORBG4CFA2PBMkBFA0UANMBgAMWAHgCHQMJALn8sQwHABT8h/ZAEh7/TPvNEWj/u/z9Ib8A9vdwInUASfjOIq/7Dv1bIvn7nvsrEqH62faeElj6nvsrEqH6Dv1bIvn7u/z9Ib8ATPvNEWj/h/ZAEh7/9vdwInUASfjOIq/72faeElj6Dv1bIvn7SfjOIq/79vdwInUAu/z9Ib8ATPvNEWj/h/ZAEh7/2faeElj6nvsrEqH6DfaeA6H1L/o6A+H17vrmEL3+zPZJEX7+N/eFEwL7WfsiE0L7mvp3BWXyePbaBSXymvp3BWXyWfsiE0L77vrmEL3+L/o6A+H1DfaeA6H1zPZJEX7+N/eFEwL7ePbaBSXyWfsiE0L7N/eFEwL7zPZJEX7+7vrmEL3+L/o6A+H1DfaeA6H1ePbaBSXymvp3BWXyT/MVABL34/wVALj35PyQBLD3UPOQBAv3w/OEBFbwV/2EBPvwV/0KAAPxw/MJAF7wV/0KAAPxV/2EBPvw5PyQBLD34/wVALj3T/MVABL3UPOQBAv3w/OEBFbww/MJAF7wV/2EBPvww/OEBFbwUPOQBAv35PyQBLD34/wVALj3T/MVABL3w/MJAF7wV/0KAAPx7fIAAMb8gfwAAGv9gPx7BHv97PJ7BNb8T/OQBBf34/yQBLz35PwVAKz3UPMVAAb35PwVAKz34/yQBLz3gPx7BHv9gfwAAGv97fIAAMb87PJ7BNb8T/OQBBf3UPMVAAb34/yQBLz3T/OQBBf37PJ7BNb8gPx7BHv9gfwAAGv97fIAAMb8UPMVAAb35PwVAKz3Jfp0MyEF4f7xMwYFov6rNpwG5vkvNrgGtfmJN14Ecf4GOEIEsP5LNasC9PnPNMcCsP5LNasCcf4GOEIEov6rNpwG4f7xMwYFJfp0MyEF5vkvNrgGtfmJN14E9PnPNMcCcf4GOEIEtfmJN14E5vkvNrgGov6rNpwG4f7xMwYFJfp0MyEF9PnPNMcCsP5LNasC9vg3OkMIzv7QOiIInv7mPFkJxvhMPHoJVvhjPxwELv78P/oDXv7mPcQChvhNPeUCXv7mPcQCLv78P/oDnv7mPFkJzv7QOiII9vg3OkMIxvhMPHoJVvhjPxwEhvhNPeUCLv78P/oDVvhjPxwExvhMPHoJnv7mPFkJzv7QOiII9vg3OkMIhvhNPeUCXv7mPcQC",triangles:"AAABAAIAAgADAAAABAAFAAYABgAHAAQACAAJAAoACgALAAgADAANAA4ADgAPAAwAEAARABIAEgATABAAFAAVABYAFgAXABQAGAAZABoAGgAbABgAHAAdAB4AHgAfABwAIAAhACIAIgAjACAAJAAlACYAJgAnACQAKAApACoAKgArACgALAAtAC4ALgAvACwAMAAxADIAMgAzADAANAA1ADYANgA3ADQAOAA5ADoAOgA7ADgAPAA9AD4APgA/ADwAQABBAEIAQgBDAEAARABFAEYARgBHAEQASABJAEoASgBLAEgATABNAE4ATgBPAEwAUABRAFIAUgBTAFAAVABVAFYAVgBXAFQAWABZAFoAWgBbAFgAXABdAF4AXgBfAFwAYABhAGIAYgBjAGAAZABlAGYAZgBnAGQAaABpAGoAagBrAGgAbABtAG4AbgBvAGwAcABxAHIAcgBzAHAAdAB1AHYAdgB3AHQAeAB5AHoAegB7AHgAfAB9AH4AfgB/AHwAgACBAIIAggCDAIAAhACFAIYAhgCHAIQAiACJAIoAigCLAIgAjACNAI4AjgCPAIwAkACRAJIAkgCTAJAAlACVAJYAlgCXAJQAmACZAJoAmgCbAJgAnACdAJ4AngCfAJwAoAChAKIAogCjAKAApAClAKYApgCnAKQAqACpAKoAqgCrAKgArACtAK4ArgCvAKwAsACxALIAsgCzALAAtAC1ALYAtgC3ALQAuAC5ALoAugC7ALgAvAC9AL4AvgC/ALwAwADMAOQAwgDlANAAwQDgAOkAzABiAeQA5QBjAdAA4ABkAekAzADNAGIBzQBlAWIB5QDmAGMB5gBnAWMB4ADhAGQB4QBpAWQBzQDOAGUBzgBmAWUB5gDnAGcB5wBoAWcB4QDiAGkB4gBqAWkBzgDPAGYBzwBjAWYB5wDoAGgB6ABkAWgB4gDjAGoB4wBiAWoB0ABjAc8A6QBkAegA5ABiAeMAYgFlAWoBYwFnAWYBZAFpAWgBZgFrAWUBaAFrAWcBagFrAWkBZQFrAWoBZwFrAWYBaQFrAWgBwADRAMwAwwDqANUAwgDQAO4A0QBsAcwA6gBtAdUA0ABuAe4A0QDSAGwB0gBvAWwB6gDrAG0B6wBxAW0B0ADPAG4BzwBzAW4B0gDTAG8B0wBwAW8B6wDsAHEB7AByAXEBzwDOAHMBzgB0AXMB0wDUAHAB1ABtAXAB7ADtAHIB7QBuAXIBzgDNAHQBzQBsAXQB1QBtAdQA7gBuAe0AzABsAc0AbAFvAXQBbQFxAXABbgFzAXIBcAF1AW8BcgF1AXEBdAF1AXMBbwF1AXQBcQF1AXABcwF1AXIBwADWANEAxADvANoAwwDVAPMA1gB2AdEA7wB3AdoA1QB4AfMA1gDXAHYB1wB5AXYB7wDwAHcB8AB7AXcB1QDUAHgB1AB9AXgB1wDYAHkB2AB6AXkB8ADxAHsB8QB8AXsB1ADTAH0B0wB+AX0B2ADZAHoB2QB3AXoB8QDyAHwB8gB4AXwB0wDSAH4B0gB2AX4B2gB3AdkA8wB4AfIA0QB2AdIAdgF5AX4BdwF7AXoBeAF9AXwBegF/AXkBfAF/AXsBfgF/AX0BeQF/AX4BewF/AXoBfQF/AXwBwADbANYAxQD0AN8AxADaAPgA2wCAAdYA9ACBAd8A2gCCAfgA2wDcAIAB3ACDAYAB9AD1AIEB9QCFAYEB2gDZAIIB2QCHAYIB3ADdAIMB3QCEAYMB9QD2AIUB9gCGAYUB2QDYAIcB2ACIAYcB3QDeAIQB3gCBAYQB9gD3AIYB9wCCAYYB2ADXAIgB1wCAAYgB3wCBAd4A+ACCAfcA1gCAAdcAgAGDAYgBgQGFAYQBggGHAYYBhAGJAYMBhgGJAYUBiAGJAYcBgwGJAYgBhQGJAYQBhwGJAYYBwADkANsAwQD5AOAAxQDfAP0A5ACKAdsA+QCLAeAA3wCMAf0A5ADjAIoB4wCNAYoB+QD6AIsB+gCPAYsB3wDeAIwB3gCRAYwB4wDiAI0B4gCOAY0B+gD7AI8B+wCQAY8B3gDdAJEB3QCSAZEB4gDhAI4B4QCLAY4B+wD8AJAB/ACMAZAB3QDcAJIB3ACKAZIB4ACLAeEA/QCMAfwA2wCKAdwAigGNAZIBiwGPAY4BjAGRAZABjgGTAY0BkAGTAY8BkgGTAZEBjQGTAZIBjwGTAY4BkQGTAZABxQD9ABsBwQD+APkAxgAXAQIB/QCUARsB/gCVAfkAFwGWAQIB/QD8AJQB/ACXAZQB/gD/AJUB/wCZAZUBFwEYAZYBGAGbAZYB/AD7AJcB+wCYAZcB/wAAAZkBAAGaAZkBGAEZAZsBGQGcAZsB+wD6AJgB+gCVAZgBAAEBAZoBAQGWAZoBGQEaAZwBGgGUAZwB+QCVAfoAAgGWAQEBGwGUARoBlAGXAZwBlQGZAZgBlgGbAZoBmAGdAZcBmgGdAZkBnAGdAZsBlwGdAZwBmQGdAZgBmwGdAZoBwQDpACABwgADAeUAxwAcAQcB6QCeASABAwGfAeUAHAGgAQcB6QDoAJ4B6AChAZ4BAwEEAZ8BBAGjAZ8BHAEdAaABHQGlAaAB6ADnAKEB5wCiAaEBBAEFAaMBBQGkAaMBHQEeAaUBHgGmAaUB5wDmAKIB5gCfAaIBBQEGAaQBBgGgAaQBHgEfAaYBHwGeAaYB5QCfAeYABwGgAQYBIAGeAR8BngGhAaYBnwGjAaIBoAGlAaQBogGnAaEBpAGnAaMBpgGnAaUBoQGnAaYBowGnAaIBpQGnAaQBwgDuACUBwwAIAeoAyAAhAQwB7gCoASUBCAGpAeoAIQGqAQwB7gDtAKgB7QCrAagBCAEJAakBCQGtAakBIQEiAaoBIgGvAaoB7QDsAKsB7ACsAasBCQEKAa0BCgGuAa0BIgEjAa8BIwGwAa8B7ADrAKwB6wCpAawBCgELAa4BCwGqAa4BIwEkAbABJAGoAbAB6gCpAesADAGqAQsBJQGoASQBqAGrAbABqQGtAawBqgGvAa4BrAGxAasBrgGxAa0BsAGxAa8BqwGxAbABrQGxAawBrwGxAa4BwwDzACoBxAANAe8AyQAmAREB8wCyASoBDQGzAe8AJgG0AREB8wDyALIB8gC1AbIBDQEOAbMBDgG3AbMBJgEnAbQBJwG5AbQB8gDxALUB8QC2AbUBDgEPAbcBDwG4AbcBJwEoAbkBKAG6AbkB8QDwALYB8ACzAbYBDwEQAbgBEAG0AbgBKAEpAboBKQGyAboB7wCzAfAAEQG0ARABKgGyASkBsgG1AboBswG3AbYBtAG5AbgBtgG7AbUBuAG7AbcBugG7AbkBtQG7AboBtwG7AbYBuQG7AbgBxAD4AC8BxQASAfQAygArARYB+AC8AS8BEgG9AfQAKwG+ARYB+AD3ALwB9wC/AbwBEgETAb0BEwHBAb0BKwEsAb4BLAHDAb4B9wD2AL8B9gDAAb8BEwEUAcEBFAHCAcEBLAEtAcMBLQHEAcMB9gD1AMAB9QC9AcABFAEVAcIBFQG+AcIBLQEuAcQBLgG8AcQB9AC9AfUAFgG+ARUBLwG8AS4BvAG/AcQBvQHBAcABvgHDAcIBwAHFAb8BwgHFAcEBxAHFAcMBvwHFAcQBwQHFAcABwwHFAcIBxQAbARIBxgAwARcBygAWATQBGwHGARIBMAHHARcBFgHIATQBGwEaAcYBGgHJAcYBMAExAccBMQHLAccBFgEVAcgBFQHNAcgBGgEZAckBGQHKAckBMQEyAcsBMgHMAcsBFQEUAc0BFAHOAc0BGQEYAcoBGAHHAcoBMgEzAcwBMwHIAcwBFAETAc4BEwHGAc4BFwHHARgBNAHIATMBEgHGARMBxgHJAc4BxwHLAcoByAHNAcwBygHPAckBzAHPAcsBzgHPAc0ByQHPAc4BywHPAcoBzQHPAcwBwQAgAf4AxwA1ARwBxgACATkBIAHQAf4ANQHRARwBAgHSATkBIAEfAdABHwHTAdABNQE2AdEBNgHVAdEBAgEBAdIBAQHXAdIBHwEeAdMBHgHUAdMBNgE3AdUBNwHWAdUBAQEAAdcBAAHYAdcBHgEdAdQBHQHRAdQBNwE4AdYBOAHSAdYBAAH/ANgB/wDQAdgBHAHRAR0BOQHSATgB/gDQAf8A0AHTAdgB0QHVAdQB0gHXAdYB1AHZAdMB1gHZAdUB2AHZAdcB0wHZAdgB1QHZAdQB1wHZAdYBwgAlAQMByAA6ASEBxwAHAT4BJQHaAQMBOgHbASEBBwHcAT4BJQEkAdoBJAHdAdoBOgE7AdsBOwHfAdsBBwEGAdwBBgHhAdwBJAEjAd0BIwHeAd0BOwE8Ad8BPAHgAd8BBgEFAeEBBQHiAeEBIwEiAd4BIgHbAd4BPAE9AeABPQHcAeABBQEEAeIBBAHaAeIBIQHbASIBPgHcAT0BAwHaAQQB2gHdAeIB2wHfAd4B3AHhAeAB3gHjAd0B4AHjAd8B4gHjAeEB3QHjAeIB3wHjAd4B4QHjAeABwwAqAQgByQA/ASYByAAMAUMBKgHkAQgBPwHlASYBDAHmAUMBKgEpAeQBKQHnAeQBPwFAAeUBQAHpAeUBDAELAeYBCwHrAeYBKQEoAecBKAHoAecBQAFBAekBQQHqAekBCwEKAesBCgHsAesBKAEnAegBJwHlAegBQQFCAeoBQgHmAeoBCgEJAewBCQHkAewBJgHlAScBQwHmAUIBCAHkAQkB5AHnAewB5QHpAegB5gHrAeoB6AHtAecB6gHtAekB7AHtAesB5wHtAewB6QHtAegB6wHtAeoBxAAvAQ0BygBEASsByQARAUgBLwHuAQ0BRAHvASsBEQHwAUgBLwEuAe4BLgHxAe4BRAFFAe8BRQHzAe8BEQEQAfABEAH1AfABLgEtAfEBLQHyAfEBRQFGAfMBRgH0AfMBEAEPAfUBDwH2AfUBLQEsAfIBLAHvAfIBRgFHAfQBRwHwAfQBDwEOAfYBDgHuAfYBKwHvASwBSAHwAUcBDQHuAQ4B7gHxAfYB7wHzAfIB8AH1AfQB8gH3AfEB9AH3AfMB9gH3AfUB8QH3AfYB8wH3AfIB9QH3AfQBygA0AU0BxgBOATABywBJAVIBNAH4AU0BTgH5ATABSQH6AVIBNAEzAfgBMwH7AfgBTgFPAfkBTwH9AfkBSQFKAfoBSgH/AfoBMwEyAfsBMgH8AfsBTwFQAf0BUAH+Af0BSgFLAf8BSwEAAv8BMgExAfwBMQH5AfwBUAFRAf4BUQH6Af4BSwFMAQACTAH4AQACMAH5ATEBUgH6AVEBTQH4AUwB+AH7AQAC+QH9AfwB+gH/Af4B/AEBAvsB/gEBAv0BAAIBAv8B+wEBAgAC/QEBAvwB/wEBAv4BxgA5AU4BxwBTATUBywBSAVcBOQECAk4BUwEDAjUBUgEEAlcBOQE4AQICOAEFAgICUwFUAQMCVAEHAgMCUgFRAQQCUQEJAgQCOAE3AQUCNwEGAgUCVAFVAQcCVQEIAgcCUQFQAQkCUAEKAgkCNwE2AQYCNgEDAgYCVQFWAQgCVgEEAggCUAFPAQoCTwECAgoCNQEDAjYBVwEEAlYBTgECAk8BAgIFAgoCAwIHAgYCBAIJAggCBgILAgUCCAILAgcCCgILAgkCBQILAgoCBwILAgYCCQILAggCxwA+AVMByABYAToBywBXAVwBPgEMAlMBWAENAjoBVwEOAlwBPgE9AQwCPQEPAgwCWAFZAQ0CWQERAg0CVwFWAQ4CVgETAg4CPQE8AQ8CPAEQAg8CWQFaARECWgESAhECVgFVARMCVQEUAhMCPAE7ARACOwENAhACWgFbARICWwEOAhICVQFUARQCVAEMAhQCOgENAjsBXAEOAlsBUwEMAlQBDAIPAhQCDQIRAhACDgITAhICEAIVAg8CEgIVAhECFAIVAhMCDwIVAhQCEQIVAhACEwIVAhICyABDAVgByQBdAT8BywBcAWEBQwEWAlgBXQEXAj8BXAEYAmEBQwFCARYCQgEZAhYCXQFeARcCXgEbAhcCXAFbARgCWwEdAhgCQgFBARkCQQEaAhkCXgFfARsCXwEcAhsCWwFaAR0CWgEeAh0CQQFAARoCQAEXAhoCXwFgARwCYAEYAhwCWgFZAR4CWQEWAh4CPwEXAkABYQEYAmABWAEWAlkBFgIZAh4CFwIbAhoCGAIdAhwCGgIfAhkCHAIfAhsCHgIfAh0CGQIfAh4CGwIfAhoCHQIfAhwCyQBIAV0BygBNAUQBywBhAUkBSAEgAl0BTQEhAkQBYQEiAkkBSAFHASACRwEjAiACTQFMASECTAElAiECYQFgASICYAEnAiICRwFGASMCRgEkAiMCTAFLASUCSwEmAiUCYAFfAScCXwEoAicCRgFFASQCRQEhAiQCSwFKASYCSgEiAiYCXwFeASgCXgEgAigCRAEhAkUBSQEiAkoBXQEgAl4BIAIjAigCIQIlAiQCIgInAiYCJAIpAiMCJgIpAiUCKAIpAicCIwIpAigCJQIpAiQCJwIpAiYCKgIrAiwCLAItAioCLgIvAjACMAIxAi4CMgIzAjQCNAI1AjICNgI3AjgCOAI5AjYCOgI7AjwCPAI9AjoCPgI/AkACQAJBAj4CQgJDAkQCRAJFAkICRgJHAkgCSAJJAkYCSgJLAkwCTAJNAkoCTgJPAlACUAJRAk4CUgJTAlQCVAJVAlICVgJXAlgCWAJZAlYCWgJmAn4CXAJ/AmoCWwJ6AoMCZgL8An4CfwL9AmoCegL+AoMCZgJnAvwCZwL/AvwCfwKAAv0CgAIBA/0CegJ7Av4CewIDA/4CZwJoAv8CaAIAA/8CgAKBAgEDgQICAwEDewJ8AgMDfAIEAwMDaAJpAgADaQL9AgADgQKCAgIDggL+AgIDfAJ9AgQDfQL8AgQDagL9AmkCgwL+AoICfgL8An0C/AL/AgQD/QIBAwAD/gIDAwIDAAMFA/8CAgMFAwEDBAMFAwMD/wIFAwQDAQMFAwADAwMFAwIDWgJrAmYCXQKEAm8CXAJqAogCawIGA2YChAIHA28CagIIA4gCawJsAgYDbAIJAwYDhAKFAgcDhQILAwcDagJpAggDaQINAwgDbAJtAgkDbQIKAwkDhQKGAgsDhgIMAwsDaQJoAg0DaAIOAw0DbQJuAgoDbgIHAwoDhgKHAgwDhwIIAwwDaAJnAg4DZwIGAw4DbwIHA24CiAIIA4cCZgIGA2cCBgMJAw4DBwMLAwoDCAMNAwwDCgMPAwkDDAMPAwsDDgMPAw0DCQMPAw4DCwMPAwoDDQMPAwwDWgJwAmsCXgKJAnQCXQJvAo0CcAIQA2sCiQIRA3QCbwISA40CcAJxAhADcQITAxADiQKKAhEDigIVAxEDbwJuAhIDbgIXAxIDcQJyAhMDcgIUAxMDigKLAhUDiwIWAxUDbgJtAhcDbQIYAxcDcgJzAhQDcwIRAxQDiwKMAhYDjAISAxYDbQJsAhgDbAIQAxgDdAIRA3MCjQISA4wCawIQA2wCEAMTAxgDEQMVAxQDEgMXAxYDFAMZAxMDFgMZAxUDGAMZAxcDEwMZAxgDFQMZAxQDFwMZAxYDWgJ1AnACXwKOAnkCXgJ0ApICdQIaA3ACjgIbA3kCdAIcA5ICdQJ2AhoDdgIdAxoDjgKPAhsDjwIfAxsDdAJzAhwDcwIhAxwDdgJ3Ah0DdwIeAx0DjwKQAh8DkAIgAx8DcwJyAiEDcgIiAyEDdwJ4Ah4DeAIbAx4DkAKRAiADkQIcAyADcgJxAiIDcQIaAyIDeQIbA3gCkgIcA5ECcAIaA3ECGgMdAyIDGwMfAx4DHAMhAyADHgMjAx0DIAMjAx8DIgMjAyEDHQMjAyIDHwMjAx4DIQMjAyADWgJ+AnUCWwKTAnoCXwJ5ApcCfgIkA3UCkwIlA3oCeQImA5cCfgJ9AiQDfQInAyQDkwKUAiUDlAIpAyUDeQJ4AiYDeAIrAyYDfQJ8AicDfAIoAycDlAKVAikDlQIqAykDeAJ3AisDdwIsAysDfAJ7AigDewIlAygDlQKWAioDlgImAyoDdwJ2AiwDdgIkAywDegIlA3sClwImA5YCdQIkA3YCJAMnAywDJQMpAygDJgMrAyoDKAMtAycDKgMtAykDLAMtAysDJwMtAywDKQMtAygDKwMtAyoDXwKXArUCWwKYApMCYAKxApwClwIuA7UCmAIvA5MCsQIwA5wClwKWAi4DlgIxAy4DmAKZAi8DmQIzAy8DsQKyAjADsgI1AzADlgKVAjEDlQIyAzEDmQKaAjMDmgI0AzMDsgKzAjUDswI2AzUDlQKUAjIDlAIvAzIDmgKbAjQDmwIwAzQDswK0AjYDtAIuAzYDkwIvA5QCnAIwA5sCtQIuA7QCLgMxAzYDLwMzAzIDMAM1AzQDMgM3AzEDNAM3AzMDNgM3AzUDMQM3AzYDMwM3AzIDNQM3AzQDWwKDAroCXAKdAn8CYQK2AqECgwI4A7oCnQI5A38CtgI6A6ECgwKCAjgDggI7AzgDnQKeAjkDngI9AzkDtgK3AjoDtwI/AzoDggKBAjsDgQI8AzsDngKfAj0DnwI+Az0DtwK4Aj8DuAJAAz8DgQKAAjwDgAI5AzwDnwKgAj4DoAI6Az4DuAK5AkADuQI4A0ADfwI5A4ACoQI6A6ACugI4A7kCOAM7A0ADOQM9AzwDOgM/Az4DPANBAzsDPgNBAz0DQANBAz8DOwNBA0ADPQNBAzwDPwNBAz4DXAKIAr8CXQKiAoQCYgK7AqYCiAJCA78CogJDA4QCuwJEA6YCiAKHAkIDhwJFA0IDogKjAkMDowJHA0MDuwK8AkQDvAJJA0QDhwKGAkUDhgJGA0UDowKkAkcDpAJIA0cDvAK9AkkDvQJKA0kDhgKFAkYDhQJDA0YDpAKlAkgDpQJEA0gDvQK+AkoDvgJCA0oDhAJDA4UCpgJEA6UCvwJCA74CQgNFA0oDQwNHA0YDRANJA0gDRgNLA0UDSANLA0cDSgNLA0kDRQNLA0oDRwNLA0YDSQNLA0gDXQKNAsQCXgKnAokCYwLAAqsCjQJMA8QCpwJNA4kCwAJOA6sCjQKMAkwDjAJPA0wDpwKoAk0DqAJRA00DwALBAk4DwQJTA04DjAKLAk8DiwJQA08DqAKpAlEDqQJSA1EDwQLCAlMDwgJUA1MDiwKKAlADigJNA1ADqQKqAlIDqgJOA1IDwgLDAlQDwwJMA1QDiQJNA4oCqwJOA6oCxAJMA8MCTANPA1QDTQNRA1ADTgNTA1IDUANVA08DUgNVA1EDVANVA1MDTwNVA1QDUQNVA1ADUwNVA1IDXgKSAskCXwKsAo4CZALFArACkgJWA8kCrAJXA44CxQJYA7ACkgKRAlYDkQJZA1YDrAKtAlcDrQJbA1cDxQLGAlgDxgJdA1gDkQKQAlkDkAJaA1kDrQKuAlsDrgJcA1sDxgLHAl0DxwJeA10DkAKPAloDjwJXA1oDrgKvAlwDrwJYA1wDxwLIAl4DyAJWA14DjgJXA48CsAJYA68CyQJWA8gCVgNZA14DVwNbA1oDWANdA1wDWgNfA1kDXANfA1sDXgNfA10DWQNfA14DWwNfA1oDXQNfA1wDXwK1AqwCYALKArECZAKwAs4CtQJgA6wCygJhA7ECsAJiA84CtQK0AmADtAJjA2ADygLLAmEDywJlA2EDsAKvAmIDrwJnA2IDtAKzAmMDswJkA2MDywLMAmUDzAJmA2UDrwKuAmcDrgJoA2cDswKyAmQDsgJhA2QDzALNAmYDzQJiA2YDrgKtAmgDrQJgA2gDsQJhA7ICzgJiA80CrAJgA60CYANjA2gDYQNlA2QDYgNnA2YDZANpA2MDZgNpA2UDaANpA2cDYwNpA2gDZQNpA2QDZwNpA2YDWwK6ApgCYQLPArYCYAKcAtMCugJqA5gCzwJrA7YCnAJsA9MCugK5AmoDuQJtA2oDzwLQAmsD0AJvA2sDnAKbAmwDmwJxA2wDuQK4Am0DuAJuA20D0ALRAm8D0QJwA28DmwKaAnEDmgJyA3EDuAK3Am4DtwJrA24D0QLSAnAD0gJsA3ADmgKZAnIDmQJqA3IDtgJrA7cC0wJsA9ICmAJqA5kCagNtA3IDawNvA24DbANxA3ADbgNzA20DcANzA28DcgNzA3EDbQNzA3IDbwNzA24DcQNzA3ADXAK/Ap0CYgLUArsCYQKhAtgCvwJ0A50C1AJ1A7sCoQJ2A9gCvwK+AnQDvgJ3A3QD1ALVAnUD1QJ5A3UDoQKgAnYDoAJ7A3YDvgK9AncDvQJ4A3cD1QLWAnkD1gJ6A3kDoAKfAnsDnwJ8A3sDvQK8AngDvAJ1A3gD1gLXAnoD1wJ2A3oDnwKeAnwDngJ0A3wDuwJ1A7wC2AJ2A9cCnQJ0A54CdAN3A3wDdQN5A3gDdgN7A3oDeAN9A3cDegN9A3kDfAN9A3sDdwN9A3wDeQN9A3gDewN9A3oDXQLEAqICYwLZAsACYgKmAt0CxAJ+A6IC2QJ/A8ACpgKAA90CxALDAn4DwwKBA34D2QLaAn8D2gKDA38DpgKlAoADpQKFA4ADwwLCAoEDwgKCA4ED2gLbAoMD2wKEA4MDpQKkAoUDpAKGA4UDwgLBAoIDwQJ/A4ID2wLcAoQD3AKAA4QDpAKjAoYDowJ+A4YDwAJ/A8EC3QKAA9wCogJ+A6MCfgOBA4YDfwODA4IDgAOFA4QDggOHA4EDhAOHA4MDhgOHA4UDgQOHA4YDgwOHA4IDhQOHA4QDXgLJAqcCZALeAsUCYwKrAuICyQKIA6cC3gKJA8UCqwKKA+ICyQLIAogDyAKLA4gD3gLfAokD3wKNA4kDqwKqAooDqgKPA4oDyALHAosDxwKMA4sD3wLgAo0D4AKOA40DqgKpAo8DqQKQA48DxwLGAowDxgKJA4wD4ALhAo4D4QKKA44DqQKoApADqAKIA5ADxQKJA8YC4gKKA+ECpwKIA6gCiAOLA5ADiQONA4wDigOPA44DjAORA4sDjgORA40DkAORA48DiwORA5ADjQORA4wDjwORA44DZALOAucCYALoAsoCZQLjAuwCzgKSA+cC6AKTA8oC4wKUA+wCzgLNApIDzQKVA5ID6ALpApMD6QKXA5MD4wLkApQD5AKZA5QDzQLMApUDzAKWA5UD6QLqApcD6gKYA5cD5ALlApkD5QKaA5kDzALLApYDywKTA5YD6gLrApgD6wKUA5gD5QLmApoD5gKSA5oDygKTA8sC7AKUA+sC5wKSA+YCkgOVA5oDkwOXA5YDlAOZA5gDlgObA5UDmAObA5cDmgObA5kDlQObA5oDlwObA5YDmQObA5gDYALTAugCYQLtAs8CZQLsAvEC0wKcA+gC7QKdA88C7AKeA/EC0wLSApwD0gKfA5wD7QLuAp0D7gKhA50D7ALrAp4D6wKjA54D0gLRAp8D0QKgA58D7gLvAqED7wKiA6ED6wLqAqMD6gKkA6MD0QLQAqAD0AKdA6AD7wLwAqID8AKeA6ID6gLpAqQD6QKcA6QDzwKdA9AC8QKeA/AC6AKcA+kCnAOfA6QDnQOhA6ADngOjA6IDoAOlA58DogOlA6EDpAOlA6MDnwOlA6QDoQOlA6ADowOlA6IDYQLYAu0CYgLyAtQCZQLxAvYC2AKmA+0C8gKnA9QC8QKoA/YC2ALXAqYD1wKpA6YD8gLzAqcD8wKrA6cD8QLwAqgD8AKtA6gD1wLWAqkD1gKqA6kD8wL0AqsD9AKsA6sD8ALvAq0D7wKuA60D1gLVAqoD1QKnA6oD9AL1AqwD9QKoA6wD7wLuAq4D7gKmA64D1AKnA9UC9gKoA/UC7QKmA+4CpgOpA64DpwOrA6oDqAOtA6wDqgOvA6kDrAOvA6sDrgOvA60DqQOvA64DqwOvA6oDrQOvA6wDYgLdAvICYwL3AtkCZQL2AvsC3QKwA/IC9wKxA9kC9gKyA/sC3QLcArAD3AKzA7AD9wL4ArED+AK1A7ED9gL1ArID9QK3A7ID3ALbArMD2wK0A7MD+AL5ArUD+QK2A7UD9QL0ArcD9AK4A7cD2wLaArQD2gKxA7QD+QL6ArYD+gKyA7YD9ALzArgD8wKwA7gD2QKxA9oC+wKyA/oC8gKwA/MCsAOzA7gDsQO1A7QDsgO3A7YDtAO5A7MDtgO5A7UDuAO5A7cDswO5A7gDtQO5A7QDtwO5A7YDYwLiAvcCZALnAt4CZQL7AuMC4gK6A/cC5wK7A94C+wK8A+MC4gLhAroD4QK9A7oD5wLmArsD5gK/A7sD+wL6ArwD+gLBA7wD4QLgAr0D4AK+A70D5gLlAr8D5QLAA78D+gL5AsED+QLCA8ED4ALfAr4D3wK7A74D5QLkAsAD5AK8A8AD+QL4AsID+AK6A8ID3gK7A98C4wK8A+QC9wK6A/gCugO9A8IDuwO/A74DvAPBA8ADvgPDA70DwAPDA78DwgPDA8EDvQPDA8IDvwPDA74DwQPDA8ADxAPFA8YDxgPHA8QDyAPJA8oDygPLA8gDzAPNA84DzgPPA8wD0APRA9ID0gPTA9AD1APVA9YD1gPXA9QD2APZA9oD2gPbA9gD3APdA94D3gPfA9wD4APhA+ID4gPjA+AD5APlA+YD5gPnA+QD6APpA+oD6gPrA+gD7APtA+4D7gPvA+wD8APxA/ID8gPzA/AD9AP1A/YD9gP3A/QD+AP5A/oD+gP7A/gD/AP9A/4D/gP/A/wDAAQBBAIEAgQDBAAEBAQFBAYEBgQHBAQECAQJBAoECgQLBAgEDAQNBA4EDgQPBAwEEAQRBBIEEgQTBBAEFAQVBBYEFgQXBBQEGAQZBBoEGgQbBBgEHAQdBB4EHgQfBBwEIAQhBCIEIgQjBCAEJAQlBCYEJgQnBCQEKAQpBCoEKgQrBCgELAQtBC4ELgQvBCwEMAQxBDIEMgQzBDAENAQ1BDYENgQ3BDQEOAQ5BDoEOgQ7BDgEPAQ9BD4EPgQ/BDwEQARBBEIEQgRDBEAERARFBEYERgRHBEQESARJBEoESgRLBEgETARNBE4ETgRPBEwEUARRBFIEUgRTBFAEVARVBFYEVgRXBFQEWARZBFoEWgRbBFgEXARdBF4EXgRfBFwEYARhBGIEYgRjBGAEZARlBGYEZgRnBGQEaARpBGoEagRrBGgEbARtBG4EbgRvBGwEcARxBHIEcgRzBHAEdAR1BHYEdgR3BHQEeAR5BHoEegR7BHgEfAR9BH4EfgR/BHwEgASBBIIEggSDBIAEhASFBIYEhgSHBIQEiASJBIoEigSLBIgEjASNBI4EjgSPBIwEkASRBJIEkgSTBJAElASVBJYElgSXBJQEmASZBJoEmgSbBJgEnASdBJ4EngSfBJwEoAShBKIEogSjBKAEpASlBKYEpgSnBKQEqASpBKoEqgSrBKgErAStBK4ErgSvBKwEsASxBLIEsgSzBLAEtAS1BLYEtgS3BLQEuAS5BLoEugS7BLgEvAS9BL4EvgS/BLwEwATBBMIEwgTDBMAExATFBMYExgTHBMQEyATJBMoEygTLBMgE",material:"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBg==",light:"AAAAAAMDAwMAAAAACgoKCh0dHR0AAAAADQ0NDQAAAAAAAAAACwsLCxoaGhoAAAAADAwMDAAAAAAAAAAACgoKChsbGxsAAAAACwsLCwAAAAAAAAAACgoKChsbGxsAAAAACwsLCwAAAAAAAAAACQkJCRsbGxsAAAAACwsLCwAAAAAAAAAACQkJCRwcHBwAAAAAHR0dHQAAAAAJCQkJAAAAAAAAAAAFBQUFAAAAAAoKCgodHR0dAAAAAAAAAAAFBQUFABgAAAAOHBIAAAIFAAAAAAAAAAAAAAAAAAAAAAIGCQwUEAsGAQMIDREVAAAAAAAAAAAAAAkDAAAAGBgWFBIbHR8fHgIGCQ0QAAAAAAAAAAAAAA0MCgcFHBsZFhIVFxkZGQAAAAAAAAAAAAAAAAAAABoWEg0IFhkbHB0AAAIIDQAAAAAAAAAAAAAFBAQEAxoXEw8KEQ8NCwgAAAAAAQAAAAAAAQIRAQIHDAwHBwAAAAAAAAAAAAAAAAAAAAAAAAAAAAYAAAMAAAAAAAQUDwoQExEMCA4WGx4ZGh0eHBkcFgcSEQwLDxQVEQAAAAAAAAAAAAAAAAAAAAAAAAAAAAgBAAIGAwAAABEZCxUXFRANEBMcGR4cGxweHx4dAAAKAAAABAcDAQAAAAAAAAAAAAAAAAAAAAAAAAAACRcKDhMTDwoJDxoVDRkYExASFxUMAAQGAAABBwoDAAAAAAAAAAAAAAAAAAAAAAAAAAAbGxsbAAAAAAAAAAAEBAQEDg4ODgAAAAAAAAAABgYGBgAAAAAbGxsbDg4ODgAAAAAOAAAWHQQAAAASBgALCAUBABEUFhcXExYZHB0ODAsJBwAAAAQJAAAAAAATDgkEAB8fHh0aCg8UGBsAAAAAAAAAAAAAAAAAAAATDwsGAR4dGxkWBQYGBwcAAAAAAAAAAAAAAAAAAAAUFhgYGAwRFRgbAAAAAAEAAAAAAAAAAAAADwsIBAAJDA4QEQAAAAADAAAAAAAAAAAAAAAAAAAADQcCAAAGAAACAAAAAAAADhMDERIOCAcLDRYeGhkcHh0aGBwSDBoRDxIWGBYUCAADAgAAAAUHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8ABAoKBQAABRsfGB0fHhsaGx0ZCwwVEAwMERURAAABAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFBEFFBMOCQoQDxsPFRgUERQYGhYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACgACBgQAAAAADAYACggCAAAGBAAAAAADAwMDAAAAAAoKCgodHR0dAAAAAA8PDw8AAAAAAAAAAAYGBgYaGhoaAAAAAAAAAAAAAAAAAAAAAAYGBgYeHh4eAAAAAAwMDAwAAAAAAAAAAA0NDQ0ZGRkZAAAAAAwMDAwAAAAAAAAAAA0NDQ0ZGRkZAAAAAAwMDAwAAAAAAAAAAA4ODg4ZGRkZAAAAAAAAAAACAgICAAAAAA4ODg4cHBwcAAAAAA4ODg4AAAAAAAAAAAwMDAwZGRkZAAAAAA0NDQ0AAAAAAAAAAAwMDAwaGhoaAAAAAAAAAAADAwMDAAAAAAoKCgodHR0dAAAAAAAAAAADAwMDAAAAAAoKCgodHR0dAAAAAA==",shades:"TjsvUj8yV0I1WkU4Xkg6Yks8ZU4/aFBBbFNDb1VFclhHdFpJd1xLel5NfGBOf2JQgmRShGZThmhViWpWi2xYjW5Zj29bkXFclHNelnRfmHZgmnhinHljnntkn3xmoX5nZ1ACbVUCclkCd10CfGECgGQDhWgDiWsDjW4DkXIDlHUEmHcEnHoEn30EooAEpoIFqYUFrIcFr4oFsowFtY4Gt5EGupMGvZUGwJcGwpkHxZsHx54HyqAHzKEHz6MI0aUIZ2BabWZfcmtjd29ofHRsgHhwhXx0iYB4jYR7kYh/lIuCmI+FnJKIn5WLopiOppuRqZ6UrKGXr6SZsqectaqft6yhuq+kvbGmwLSowrarxbmtx7uvyr6xzMC0z8K20cW4AgJaAgJfAwJjAwNoAwNsBANwBAN0BAR4BAR7BQR/BQSCBQSFBQWIBgWLBgWOBgWRBgaUBwaXBwaZBwacCAefCAehCAekCAemCQeoCQirCQitCQivCgixCgm0Cgm2Cgm4ZwICbQICcgICdwMCfAMCgAMDhQMDiQQDjQQDkQQDlAQEmAQEnAUEnwUEogUEpgUFqQYFrAYFrwYFsgYFtQcGtwcGugcGvQcGwAcGwggHxQgHxwgHyggHzAkHzwkI0QkINSEXOCMZOyUbPicdQCkeQysgRS0hSC8iSjAkTDIlTjMmUDUnUjYoVDgpVjkqWDosWjstXD0uXT4uXz8vYUAwYkExZEMyZUQzZ0U0aEY1akc2a0g2bUk3bko4b0s5cUw5TjQeUjggVzsiWj0kXkAmYkMoZUUpaEgrbEosb0wuck4vdFAxd1IyelQzfFY1f1g2glo3hFs4hl05iV86i2A8jWI9j2Q+kWU/lGdAlmhBmGpCmmtDnG1Enm5Fn29FoXFG"},{height:4.11804,crown:[-.05275,4.11804,.29418],parts:23,position:"mgQMAET+Kg4LAGj9Kg6GBGb9mgSGBEP+FgSEBIb4pg2EBKn3pQ0JAKv3FgQKAIj4pQ0JAKv3pg2EBKn3Kg6GBGb9Kg4LAGj9mgQMAET+mgSGBEP+FgSEBIb4FgQKAIj4pg2EBKn3FgSEBIb4mgSGBEP+Kg6GBGb9Kg4LAGj9mgQMAET+FgQKAIj4pQ0JAKv3zvfxEh3/h/wTEgv/lP+rIhgA3PqJIyoA2PrXI1/7kf/6Ik77g/xhEkH6yvc/E1P6g/xhEkH6kf/6Ik77lP+rIhgAh/wTEgv/zvfxEh3/3PqJIyoA2PrXI1/7yvc/E1P6kf/6Ik772PrXI1/73PqJIyoAlP+rIhgAh/wTEgv/zvfxEh3/yvc/E1P6g/xhEkH6OfXRA6H1UPkRA5L1CPw1EW3+8ff1EXz+SfgcFPH6YPxdE+L6qPk4BQfykPX4BRbyqPk4BQfyYPxdE+L6CPw1EW3+UPkRA5L1OfXRA6H18ff1EXz+SfgcFPH6kPX4BRbyYPxdE+L6SfgcFPH68ff1EXz+CPw1EW3+UPkRA5L1OfXRA6H1kPX4BRbyqPk4BQfyW/INAMP26/sOAKD36/uJBJv3W/KIBL729vKABA3whfyBBOnwhfwGAO/w9vIGABLwhfwGAO/whfyBBOnw6/uJBJv36/sOAKD3W/INAMP2W/KIBL729vKABA3w9vIGABLwhfyBBOnw9vKABA3wW/KIBL726/uJBJv36/sOAKD3W/INAMP29vIGABLwhfwGAO/w1/EAAHj8Z/sBAFX9Zvt7BF/91vF7BIL8WvKIBMb26vuJBKP36/sOAJj3XPINALv26/sOAJj36vuJBKP3Zvt7BF/9Z/sBAFX91/EAAHj81vF7BIL8WvKIBMb2XPINALv26vuJBKP3WvKIBMb21vF7BIL8Zvt7BF/9Z/sBAFX91/EAAHj8XPINALv26/sOAJj3W/w0N08FtgE9N0UGKAEvPC0JzfsmPDYIwPxuP80CGwJ3P8MDqQKGOtwATv18Oub/qQKGOtwAGwJ3P8MDKAEvPC0JtgE9N0UGW/w0N08FzfsmPDYIwPxuP80CTv18Oub/GwJ3P8MDwPxuP80CzfsmPDYIKAEvPC0JtgE9N0UGW/w0N08FTv18Oub/qQKGOtwA6fo0IzoAdgU1I83/dwU1J+P/6vozJ1EAuPpOJ4X7RQVPJxj7RQVQIwH7uPpOI2/7RQVQIwH7RQVPJxj7dwU1J+P/dgU1I83/6fo0IzoA6vozJ1EAuPpOJ4X7uPpOI2/7RQVPJxj7uPpOJ4X76vozJ1EAdwU1J+P/dgU1I83/6fo0IzoAuPpOI2/7RQVQIwH7dvqAJhcA0wWBJtX/1QWZKzIAePqYK3QAXfrsK9z7ugXtK5r7uAXVJjz7W/rVJn77uAXVJjz7ugXtK5r71QWZKzIA0wWBJtX/dvqAJhcAePqYK3QAXfrsK9z7W/rVJn77ugXtK5r7XfrsK9z7ePqYK3QA1QWZKzIA0wWBJtX/dvqAJhcAW/rVJn77uAXVJjz7WfpWKjwA3gVRKi0A4QVjL8IAXPpoL9EAVvruLz382wXpLy782AXXKpn7U/rcKqj72AXXKpn72wXpLy784QVjL8IA3gVRKi0AWfpWKjwAXPpoL9EAVvruLz38U/rcKqj72wXpLy78VvruLz38XPpoL9EA4QVjL8IA3gVRKi0AWfpWKjwAU/rcKqj72AXXKpn7R/oyLnQAywUcLssAzwUoM4wBS/o+MzUBb/rsM6f88gXWM/787gXKLj38a/rgLub77gXKLj388gXWM/78zwUoM4wBywUcLssAR/oyLnQAS/o+MzUBb/rsM6f8a/rgLub78gXWM/78b/rsM6f8S/o+MzUBzwUoM4wBywUcLssAR/oyLnQAa/rgLub77gXKLj38EPoSMs0A3gXlMY0B4wXsNm4CFfoZN60BYvrkNyb9MAa3N+b9KwavMgb9XfrcMkX8KwavMgb9MAa3N+b94wXsNm4C3gXlMY0BEPoSMs0AFfoZN60BYvrkNyb9XfrcMkX8MAa3N+b9YvrkNyb9FfoZN60B4wXsNm4C3gXlMY0BEPoSMs0AXfrcMkX8KwavMgb9RgS5NrX/3ACzM30KYARnM4ULyQdtNr0AxwfjMr7/XgTdL4YK2gApMH4JRAQvM7f+2gApMH4JXgTdL4YKYARnM4UL3ACzM30KRgS5NrX/yQdtNr0AxwfjMr7/RAQvM7f+XgTdL4YKxwfjMr7/yQdtNr0AYARnM4UL3ACzM30KRgS5NrX/RAQvM7f+2gApMH4JgwFAMn8IrgHROmYK1wSNOlQLrQT7MWwJtgNQMYQM4QPiOWsOtwAmOn4NjQCVMZcLtwAmOn4N4QPiOWsO1wSNOlQLrgHROmYKgwFAMn8IrQT7MWwJtgNQMYQMjQCVMZcL4QPiOWsOtgNQMYQMrQT7MWwJ1wSNOlQLrgHROmYKgwFAMn8IjQCVMZcLtwAmOn4NnwX1PNsNIQShP/gN0QRfPkQLfARXO4QLmAO4OmEOYANfPeYPLwELP5AOEwKqP7QLSwIDPS8KigHBOhwM2gADPNEODABtPToMuQU5PWcNuwV+PfAMowW/PXoMcwX8PQgMLAUyPqALqAWaPHUNmAVEPAoNcQX3O6AMMwW0OzkM4QR+O9oLeQV6PAsOPAUFPDIO6wSaO08OhwQ9O2EOFQTxOmcObQUFPVsOJgUWPc4OygQpPTMPXQQ7PYUP4wNOPcEPjwRRPwkO7gTuPhIOOwV8PhEOdAX/PQgOlQV7PfUN3gS+PqYL2QQQPxQMwwRRP4sMmwSAPwYNZQSbP4ENtgTIO1IL4ARGPC4L+ATMPBoL/gRVPRcL8ATdPSUL2gOcOuwNEgSWOm8NQASmOu8MYgTNOm8MdgQJO/ULeQPYPNwPjANUPLsPmQPYO4IPoANoOzMPnwMHO9IOGQRmP3UOBwQZP+QO6gO7PkQPwwNPPpAPlQPaPccPpgO+Py8OJAPGP1sOoAK2P3wOHQKRP5AOoQFYP5cOcgTAPi8LBQQUPyoLjQNXPzYLEAOHP1ELkAKjP3sLMgSBOxkL3AO6O74KfQP/O3cKGANPPEcKsQKnPC8KPwN9OgsO4gJZOqwNhQJOOkgNKwJdOuIM1gGDOn0M6QIcPfMPcQLaPOgP/AGaPMQPkAFgPIgPLgEtPDYPeQHhPvwOzwGoPlcPLgJjPp0PkwITPs4P+gK7PeYPbALlPwoMyQIJQGgMJgMUQM0MgAMFQDMN1QPfP5gNwgJGPSIKOgOIPS0KrgPIPVEKGwQCPo0KfQQ1Pt8KBQKkOuYLhwKcOroLCwOsOpkLjgPROoULCgQKO34LOQGiO+YOpgFOO+sOHgILO98OmwLbOsQOGwO/OpkO9QCaPsMOywAcPucOswCWPfsOrQANPf4OuwCFPPAO0QHGPykMmQHMP6YMawG8PyYNSQGVP6YNNQFZPyAOMgKKPTgKHwIOPloKEgKKPpMKCwL6PuIKDAJbP0MLkgH8OqALpAFJOzELwQGnO9EK6AETPIQKFgKIPE4KzQCkO28O0gBSOwEO6AARO4oNDwHiOg8NRgHHOpQM8v8pPa4M8P/kPCUNCACjPJsNOABmPAwOfwAwPHUOygDkPjsOeACuPtwNOgBrPnUNEwAePgsNAwDIPaAMlgFxP64LIwElP7QLwADIPsYLbwBdPuMLMgDoPQoMyAEUPVQKTgEnPZAK4QA5PeIKhQBMPUYLPgBdPboLHAEROwsMvAB0OwMMbwDmOwQMNwBjPA0MFgDnPB8MpwXCPX8NNAWOPggM0ARDP48NnQUQPgANdgVVPoEMKgXcPocMCAUaPwsNMQXSPo8NegVPPokNYAWcPgUNugXfPP0MFwX2O6sLRgWrPYcLoAWKPIYMaAU7PBQMQAWDPJALUAUXPYQLiQVpPfoLsAUkPXkMhgXOPP8LegUePKINVgTcOu0N1gQ1O1AMLwWhO8INzAQ0O9wNkwTiOmUNvgQAO9oMJQVyO78MXAXBOzENAwVGO1ANPwWKPIkO+wPFPK8PGwRHO9QO5wSYPAAPeQSsPGQPEwQ6PH4PHQS5OzUPjwSkO80O8gQRPLMOiwQjPCYPWwWNPXMOhAQOP4QOFwTJPZkPKwUYPogO4gSbPo4OcASwPvUOSwRCPlMPlwS6PU0PBAWmPeoOxQQyPvgOLQM3Pr8PmgN9P6kO8QEoP/8OVwO0PnoPfAMjPxwPDQN3P9gOfQJbP/UOVwLoPlcPwQKXPpgP6gISP0QPFQTSPx0NeAQdP5cL7QLXP9YLRQSuP5QMZwRxPxEM/wNzP50LeQOyP7MLVgPyPzwMugPwP6sM5QO+Px8MlwSuPcUKZwT5O+kKKwPqPCkKmQQaPboKiQSGPMYKCQRBPI8KngOSPE4KrwMsPUEKKQRvPXYKIgTUPHYK/wPBOvQLfgNnOpENVgJsOkoM3gOHOnoMsgNpOgUNHQNLOiMNuQJNOrUM5gJsOiMMdQOJOgYMTgNbOpUMHwMVOwcP/wKTPOIPlAHPO0YPFwOFO2kPDAMGPLMPgQJIPMkPBgIGPJUPEQJ/O0gPlwJAOzMPjQK9O40PgAJ4PewPRAFpPisPFAG0PFAPDQLQPccPogEhPoYPIgHcPU8PEgFIPVsPgQHzPJ8P/AE2PdQPiQGOPZ8PVQP2P8sNLQL7P4QMrAGhPyEO8gIVQGANjgIXQPIM+QH5PxANzQHbP5sNNQLZPw8OxQL2P/INXQIHQIANFwSTPs8KrALPPTMKjAJNPw4LpQNcPoAKKgMaPksKnwJcPmIKlALdPqwKFAMiP+IKmgPjPs0KHgOkPogKugM6OxYLEQLlOmwLfgIrPFYKLgMHOyALngLrOjwLLwI/O/kKVAKtO5sK6QLLO30KVAN6O74KwAJQO9EKvgKLOj8OMwFFO34OlgGQOvgMMgKwOmIOrAHvOngORAHxOgQOZgGzOoAN8QFyOmoNVQJwOtkNxgGkOvYNZQC3PI4OlABsPmkO8f+DPRgNWwBLPZEOawDfPYUOQwAnPgEOCwDYPY8N+v8+PZwNIgD5PBsOJQCUPRYO1QAtP8UNVQGGPygMMQBEPnMM7QBiPzsNGAGAP7AM3gAuPzkMfADBPlIMTgChPuQMhgDwPlYNqAAcP8UMkAEbP0ALsAGdPWYKbADYPYwLjgGpPuAKmAEoPpcKMQG2PbEKxADKPRULuQBRPmELHAG+PkgLIAE/Pu8KkwGZPHsKJwFUO5ELUADVPKILYAEgPMIKOwGyOyALyQDHO4cLgABKPI0LpwC8PCsLFAGoPMgK5gAwPB0L2gAfO4YMdwDUOwwOAwCgPJYMogBIOwoNgQCGO44NNQANPJQNDgBSPBUNMQATPIwMegCQO4YMSwDGOxANK/9JM8MJPPyfNu/+t/jaNvX/pvuDM8kKJfsAMNcJNvhWMwP/vPscM/39qv7FL9EIvPscM/39NvhWMwP/t/jaNvX/PPyfNu/+K/9JM8MJpvuDM8kKJfsAMNcJqv7FL9EINvhWMwP/JfsAMNcJpvuDM8kKt/jaNvX/PPyfNu/+K/9JM8MJqv7FL9EIvPscM/39cP9vOsEJUv70McwHJvsoMrgIRfykOq0KHv3ROcMN//tVMc8LKv8hMeMKSQCdOdcMKv8hMeMK//tVMc8LJvsoMrgIUv70McwHcP9vOsEJRfykOq0KHv3ROcMNSQCdOdcM//tVMc8LHv3ROcMNRfykOq0KJvsoMrgIUv70McwHcP9vOsEJSQCdOdcMKv8hMeMK3PsfPTgNEv2BOjAMqvzcPEcKR/1xP88LEP6tPqsO7v2gO+gOBQBxOgENPf80OyUKXv9BPukJOwBgP6AMogAFPYkOcQHCPJgLwfsWPbEMwPsLPSkM2PsAPaILCPz0PCILT/zoPK0K4fudPQIN//sWPscMNPyEPogMfvzlPkkM2/w0PwoMC/x1PZgNUPzHPe4NqvwRPjcOFf1SPnAOjf2GPpcOBPzVPKUNQ/yMPAYOlvxGPFoO/PwGPJ0OcP3OO80Oq/zOOmEMVvwuO5IMFPydO8IM6vsYPO4M1vuaPBYNj/xfPHcKhfzmO7cKjvx2OwcLqfwTO2IL1fzBOscLBf0nP3AL0fzKPhkLrfxdPs4Km/zjPZAKmvxiPWMK2P0AP00Op/1BP94NgP1uP2MNYv2FP98MT/2GP1cM5P0gPBkP3/2nPDMP4v0wPTQP6/23PR4P+v04PvAOGP2AOroMLP2UOkANTP28Or8Nef34OjMOr/1FO5cOhv1COlYMA/4aOnwMh/4KOqEMC/8UOsUMjP83OuUMAP2DPAsKZf0uPOQJ1P3gO9MJS/6aO9gJxP5gO/QJk/1wP10L6P1aP/MKRP4vP5YKo/7wPkkKAv+gPg8Kc/79PngO2P47PzIOPP9lP90Nmv95P3wN8P94PxENa/7JOxIP6f78OyUPZf83PCEP2v94PAQPRQC+PNEOuf9yOnQNZP+IOt0NCP+zOjoOqf7yOocOSv5CO8EO2f7lOlgKdP6nOp4KEf59OvMKsv1oOlULXP1qOsAL4v4YPr4JZP7mPasJ6P2qPbAJcv1pPcwJB/0kPf8Jx/+gP3oMSf/IP1QMxv7XPy8MQf7OPwsMwf2rP+sLTABePcUO6P+zPewOeP8CPv0OAv9HPvgOiP6BPtwORwC7OmANewAYO7cNnwCFOwMOsgD+O0AOswCAPG4OdP/hOoMKpf+gOvIKzf9zOm4L6/9cOvIL/v9bOnoMaf/BPbcJbf87PZ0Ja/+xPJwJYf8qPLIJUv+qO+EJNABiPxcMIQBOP5ALAAAlPxEL1P/pPp4Knf+cPjoKvgCDPVoOxwD8PRkOvgBrPskNowDOPm4NdwAhPwoNiwHMPB8MjAHWPKgMdQHhPC8NRAHtPK8N/QD5PCQOcQCtOsYMzgD9OocMGAFdO0gMTQHMOwkMawFEPM4Lv/9bOzkKOACQO2EKowDQO5kK/AAbPOIKQgFsPDgL3P8TPgQKUQDbPTMKtgCbPXYKCgFVPcoKSQEMPSwLoQATP28M9wCzPj4MOAFEPg8MYwHJPeILdgFHPboLxPuQPIwMOPxqPOQKc/wWO/gLzvt+PPgL9ftyPGkLM/ztOzULR/x6O5ILHvyHOycM4/sHPFkM/Pv3O8ILz/uUPXgMnPzjPq0LQ/xvPdAK+fsRPjEMPvyCPuwLZ/x0PlcLSfz3PQwLAfyBPVQL2vuOPeMLE/wKPpoLGfz0PWANV/3VPjEO5vxDP5UMbfxOPrQN2fyaPvsNIf0PP7MN+/w1PygNi/zmPt4MRvx1PiMNqfzLPnQNO/wrPQQOZv1TPPcOef0LPtUOi/zhPGoO8PyYPLwOYP3nPAYPZv18PfsO/fzIPaUOkfx8PV4O7/wwPb8OB/xOPIENtfzVOuwMMv13O3QOKPzDO1gNY/xDOyYNzPz3OnsN9vwuOwAOufyzOzQOVPz8O+INhPxwO7MNDv7pOmgOkf1HOuEMO/8+OlYN2/2aOvQNsf1kOnANG/4oOg8Nq/4lOjcN1/5eOsENcf6XOh0OQf5ROpwNJf2xOlUL6/wFPEEKXv4WOy4KAP0QO+kK7fyDO4sKW/2nOyQK2P1WOx0K7f3eOn4Kg/28OuIKZv0qO3gK/fyqPSEKVf0eP/4Kgv50PuwJCv01PlYKKP2zPqEKsf36Po4KF/7APjIK+P09PuQJdP35PfYJi/2DPjgKzf26P3UMPf5MPxIOdv+xP+sM6/2xPwcNEf6LP5MNp/6IP7wNEf+qP1gN6f7RP8cMWf7UP58Mff69PzQNdf4GPhsPYv5OPDwP6P8XPQcPbf52PUMPZv7iPE8P6f6OPEgPbP/SPDYPc/9sPSoP9v69PTEP7v4lPUwPyv5uO+QO9//DOtINUAA3PK8ONf8iO58Om//oOkIOJAAvOy8OQgCsO3oO2P/pO9oOVf+lO+wOwv9fO5gO1v0xOuULD/+WOr4KgP8oOlsMPP43OngLpf5ZOhQLO/9WOj4LYf8xOskL8/4NOjEMY/4QOgkMz/4lOpwLZP3LPMkJ6v6UPZQJ1/7cO7YJ4P0QPZoJZP5UPYgJ5v4APYIJ4P5rPI0JV/4kPKAJ2f11PKYJXv68PIQJEv6jP3oLu/+aP+8LP//4PmgKof69P5kLMf+6P8ELm/9+P2ELcf9HP9wK2/5KP7MKdf6EPxALC/+QPzQL7/7MPqIOYgDdPY8OJwAxP3sNdP+MPrMO8v87Pq0OYABePkUOTADRPugNyf8lP+4NYP8DP1IO5/+4PlgOCQFzPAEOsAD/OiQNfQFNPFgMAwHrO8QN5QBtO3kNDgFgO+QMVAHRO58McwFUPO0MSwFgPHwNOQHYOzYNZwCfOjsM9v8NO58KNAHtO3ALUgCtOqgLLADSOh0LdABIO9UK3wCUOxwLBwFtO60LwgD8OvILowAWO10L0//WO/sJ5v+OPdoJEQG3PM0K5/9mPNYJ7f/6PMoJXQBJPRQKwgAAPWYKuwBlPHIKUAAaPCsKXQCyPBEKGwBrPl0KlwANP+QLRgGTPVALVgC0PtAKgADqPlUL6QCePqoLJAEfPngL+ADmPe4KkwAvPpwKyQBxPh0L2gDLPtkMFAF4Pe0NiAFSPUQMBgFoPj4NGQH1PZwNVwFwPWcNfgFjPdgMagHbPXcMLwFaPqkMUAHrPQ8N6/1VNcIA2wFcNXcBagFKOcYDev1DORADEv5QO6//AgJXO2QAcwJqNxb+g/5jN2D9cwJqNxb+AgJXO2QAagFKOcYD2wFcNXcB6/1VNcIAev1DORADEv5QO6//g/5jN2D9AgJXO2QAEv5QO6//ev1DORADagFKOcYD2wFcNXcB6/1VNcIAg/5jN2D9cwJqNxb+9wNCEjUArAgtE/3/bAXEI8r/twDZIgIAgwDAIjb7OAWrI/76eAgUEzL7wwMpEmr7eAgUEzL7OAWrI/76bAXEI8r/rAgtE/3/9wNCEjUAtwDZIgIAgwDAIjb7wwMpEmr7OAWrI/76gwDAIjb7twDZIgIAbAXEI8r/rAgtE/3/9wNCEjUAwwMpEmr7eAgUEzL70QYOA5z25QraA2v2jAgAEl7/eAQ0EY//4wNWEwj89wciFNj7UAr8BeXyPAYwBRXzUAr8BeXy9wciFNj7jAgAEl7/5QraA2v20QYOA5z2eAQ0EY//4wNWEwj8PAYwBRXz9wciFNj74wNWEwj8eAQ0EY//jAgAEl7/5QraA2v20QYOA5z2PAYwBRXzUAr8BeXyFgQKAIf4pQ0JAKr3pg2EBKr3FgSEBIf4ewOFBNbxCw2FBPnwCw0KAPjwewMLANXxCw0KAPjwCw2FBPnwpg2EBKr3pQ0JAKr3FgQKAIf4FgSEBIf4ewOFBNbxewMLANXxCw2FBPnwewOFBNbxFgSEBIf4pg2EBKr3pQ0JAKr3FgQKAIf4ewMLANXxCw0KAPjwzPu9MIACSwPKMNkDkwI3N58HFPsqN0YG1vvLOfIBVQPXOUsDDgRqM4T/j/xdMyz+DgRqM4T/VQPXOUsDkwI3N58HSwPKMNkDzPu9MIACFPsqN0YG1vvLOfIBj/xdMyz+VQPXOUsD1vvLOfIBFPsqN0YGkwI3N58HSwPKMNkDzPu9MIACj/xdMyz+DgRqM4T/s/uAO5QHewGKO54IIAG0PnoKWPuqPm8JRPzaQTAEDALjQToFZwK5Pl4Dn/ywPlQCZwK5Pl4DDALjQToFIAG0PnoKewGKO54Is/uAO5QHWPuqPm8JRPzaQTAEn/ywPlQCDALjQToFRPzaQTAEWPuqPm8JIAG0PnoKewGKO54Is/uAO5QHn/ywPlQCZwK5Pl4D",triangles:"AAABAAIAAgADAAAABAAFAAYABgAHAAQACAAJAAoACgALAAgADAANAA4ADgAPAAwAEAARABIAEgATABAAFAAVABYAFgAXABQAGAAZABoAGgAbABgAHAAdAB4AHgAfABwAIAAhACIAIgAjACAAJAAlACYAJgAnACQAKAApACoAKgArACgALAAtAC4ALgAvACwAMAAxADIAMgAzADAANAA1ADYANgA3ADQAOAA5ADoAOgA7ADgAPAA9AD4APgA/ADwAQABBAEIAQgBDAEAARABFAEYARgBHAEQASABJAEoASgBLAEgATABNAE4ATgBPAEwAUABRAFIAUgBTAFAAVABVAFYAVgBXAFQAWABZAFoAWgBbAFgAXABdAF4AXgBfAFwAYABhAGIAYgBjAGAAZABlAGYAZgBnAGQAaABpAGoAagBrAGgAbABtAG4AbgBvAGwAcABxAHIAcgBzAHAAdAB1AHYAdgB3AHQAeAB5AHoAegB7AHgAfAB9AH4AfgB/AHwAgACBAIIAggCDAIAAhACFAIYAhgCHAIQAiACJAIoAigCLAIgAjACNAI4AjgCPAIwAkACRAJIAkgCTAJAAlACVAJYAlgCXAJQAmACZAJoAmgCbAJgAnACdAJ4AngCfAJwAoAChAKIAogCjAKAApAClAKYApgCnAKQAqACpAKoAqgCrAKgArACtAK4ArgCvAKwAsACxALIAsgCzALAAtAC1ALYAtgC3ALQAuAC5ALoAugC7ALgAvAC9AL4AvgC/ALwAwADBAMIAwgDDAMAAxADFAMYAxgDHAMQAyADJAMoAygDLAMgAzADNAM4AzgDPAMwA0ADRANIA0gDTANAA1ADVANYA1gDXANQA2ADZANoA2gDbANgA3ADdAN4A3gDfANwA4ADhAOIA4gDjAOAA5ADlAOYA5gDnAOQA6ADpAOoA6gDrAOgA7ADtAO4A7gDvAOwA8ADxAPIA8gDzAPAA9AD1APYA9gD3APQA+AD5APoA+gD7APgA/AD9AP4A/gD/APwAAAEBAQIBAgEDAQABBAEFAQYBBgEHAQQBCAEJAQoBCgELAQgBDAENAQ4BDgEPAQwBEAERARIBEgETARABFAEVARYBFgEXARQBGAEZARoBGgEbARgBHAEdAR4BHgEfARwBIAEhASIBIgEjASABJAElASYBJgEnASQBKAEpASoBKgErASgBLAEtAS4BLgEvASwBMAExATIBMgEzATABNAE1ATYBNgE3ATQBOAFEAVwBOgFdAUgBOQFYAWEBRAHaAVwBXQHbAUgBWAHcAWEBRAFFAdoBRQHdAdoBXQFeAdsBXgHfAdsBWAFZAdwBWQHhAdwBRQFGAd0BRgHeAd0BXgFfAd8BXwHgAd8BWQFaAeEBWgHiAeEBRgFHAd4BRwHbAd4BXwFgAeABYAHcAeABWgFbAeIBWwHaAeIBSAHbAUcBYQHcAWABXAHaAVsB2gHdAeIB2wHfAd4B3AHhAeAB3gHjAd0B4AHjAd8B4gHjAeEB3QHjAeIB3wHjAd4B4QHjAeABOAFJAUQBOwFiAU0BOgFIAWYBSQHkAUQBYgHlAU0BSAHmAWYBSQFKAeQBSgHnAeQBYgFjAeUBYwHpAeUBSAFHAeYBRwHrAeYBSgFLAecBSwHoAecBYwFkAekBZAHqAekBRwFGAesBRgHsAesBSwFMAegBTAHlAegBZAFlAeoBZQHmAeoBRgFFAewBRQHkAewBTQHlAUwBZgHmAWUBRAHkAUUB5AHnAewB5QHpAegB5gHrAeoB6AHtAecB6gHtAekB7AHtAesB5wHtAewB6QHtAegB6wHtAeoBOAFOAUkBPAFnAVIBOwFNAWsBTgHuAUkBZwHvAVIBTQHwAWsBTgFPAe4BTwHxAe4BZwFoAe8BaAHzAe8BTQFMAfABTAH1AfABTwFQAfEBUAHyAfEBaAFpAfMBaQH0AfMBTAFLAfUBSwH2AfUBUAFRAfIBUQHvAfIBaQFqAfQBagHwAfQBSwFKAfYBSgHuAfYBUgHvAVEBawHwAWoBSQHuAUoB7gHxAfYB7wHzAfIB8AH1AfQB8gH3AfEB9AH3AfMB9gH3AfUB8QH3AfYB8wH3AfIB9QH3AfQBOAFTAU4BPQFsAVcBPAFSAXABUwH4AU4BbAH5AVcBUgH6AXABUwFUAfgBVAH7AfgBbAFtAfkBbQH9AfkBUgFRAfoBUQH/AfoBVAFVAfsBVQH8AfsBbQFuAf0BbgH+Af0BUQFQAf8BUAEAAv8BVQFWAfwBVgH5AfwBbgFvAf4BbwH6Af4BUAFPAQACTwH4AQACVwH5AVYBcAH6AW8BTgH4AU8B+AH7AQAC+QH9AfwB+gH/Af4B/AEBAvsB/gEBAv0BAAIBAv8B+wEBAgAC/QEBAvwB/wEBAv4BOAFcAVMBOQFxAVgBPQFXAXUBXAECAlMBcQEDAlgBVwEEAnUBXAFbAQICWwEFAgICcQFyAQMCcgEHAgMCVwFWAQQCVgEJAgQCWwFaAQUCWgEGAgUCcgFzAQcCcwEIAgcCVgFVAQkCVQEKAgkCWgFZAQYCWQEDAgYCcwF0AQgCdAEEAggCVQFUAQoCVAECAgoCWAEDAlkBdQEEAnQBUwECAlQBAgIFAgoCAwIHAgYCBAIJAggCBgILAgUCCAILAgcCCgILAgkCBQILAgoCBwILAgYCCQILAggCPQF1AZMBOQF2AXEBPgGPAXoBdQEMApMBdgENAnEBjwEOAnoBdQF0AQwCdAEPAgwCdgF3AQ0CdwERAg0CjwGQAQ4CkAETAg4CdAFzAQ8CcwEQAg8CdwF4ARECeAESAhECkAGRARMCkQEUAhMCcwFyARACcgENAhACeAF5ARICeQEOAhICkQGSARQCkgEMAhQCcQENAnIBegEOAnkBkwEMApIBDAIPAhQCDQIRAhACDgITAhICEAIVAg8CEgIVAhECFAIVAhMCDwIVAhQCEQIVAhACEwIVAhICOQFhAZgBOgF7AV0BPwGUAX8BYQEWApgBewEXAl0BlAEYAn8BYQFgARYCYAEZAhYCewF8ARcCfAEbAhcClAGVARgClQEdAhgCYAFfARkCXwEaAhkCfAF9ARsCfQEcAhsClQGWAR0ClgEeAh0CXwFeARoCXgEXAhoCfQF+ARwCfgEYAhwClgGXAR4ClwEWAh4CXQEXAl4BfwEYAn4BmAEWApcBFgIZAh4CFwIbAhoCGAIdAhwCGgIfAhkCHAIfAhsCHgIfAh0CGQIfAh4CGwIfAhoCHQIfAhwCOgFmAZ0BOwGAAWIBQAGZAYQBZgEgAp0BgAEhAmIBmQEiAoQBZgFlASACZQEjAiACgAGBASECgQElAiECmQGaASICmgEnAiICZQFkASMCZAEkAiMCgQGCASUCggEmAiUCmgGbAScCmwEoAicCZAFjASQCYwEhAiQCggGDASYCgwEiAiYCmwGcASgCnAEgAigCYgEhAmMBhAEiAoMBnQEgApwBIAIjAigCIQIlAiQCIgInAiYCJAIpAiMCJgIpAiUCKAIpAicCIwIpAigCJQIpAiQCJwIpAiYCOwFrAaIBPAGFAWcBQQGeAYkBawEqAqIBhQErAmcBngEsAokBawFqASoCagEtAioChQGGASsChgEvAisCngGfASwCnwExAiwCagFpAS0CaQEuAi0ChgGHAS8ChwEwAi8CnwGgATECoAEyAjECaQFoAS4CaAErAi4ChwGIATACiAEsAjACoAGhATICoQEqAjICZwErAmgBiQEsAogBogEqAqEBKgItAjICKwIvAi4CLAIxAjACLgIzAi0CMAIzAi8CMgIzAjECLQIzAjICLwIzAi4CMQIzAjACPAFwAacBPQGKAWwBQgGjAY4BcAE0AqcBigE1AmwBowE2Ao4BcAFvATQCbwE3AjQCigGLATUCiwE5AjUCowGkATYCpAE7AjYCbwFuATcCbgE4AjcCiwGMATkCjAE6AjkCpAGlATsCpQE8AjsCbgFtATgCbQE1AjgCjAGNAToCjQE2AjoCpQGmATwCpgE0AjwCbAE1Am0BjgE2Ao0BpwE0AqYBNAI3AjwCNQI5AjgCNgI7AjoCOAI9AjcCOgI9AjkCPAI9AjsCNwI9AjwCOQI9AjgCOwI9AjoCPQGTAYoBPgGoAY8BQgGOAawBkwE+AooBqAE/Ao8BjgFAAqwBkwGSAT4CkgFBAj4CqAGpAT8CqQFDAj8CjgGNAUACjQFFAkACkgGRAUECkQFCAkECqQGqAUMCqgFEAkMCjQGMAUUCjAFGAkUCkQGQAUICkAE/AkICqgGrAUQCqwFAAkQCjAGLAUYCiwE+AkYCjwE/ApABrAFAAqsBigE+AosBPgJBAkYCPwJDAkICQAJFAkQCQgJHAkECRAJHAkMCRgJHAkUCQQJHAkYCQwJHAkICRQJHAkQCOQGYAXYBPwGtAZQBPgF6AbEBmAFIAnYBrQFJApQBegFKArEBmAGXAUgClwFLAkgCrQGuAUkCrgFNAkkCegF5AUoCeQFPAkoClwGWAUsClgFMAksCrgGvAU0CrwFOAk0CeQF4AU8CeAFQAk8ClgGVAUwClQFJAkwCrwGwAU4CsAFKAk4CeAF3AVACdwFIAlAClAFJApUBsQFKArABdgFIAncBSAJLAlACSQJNAkwCSgJPAk4CTAJRAksCTgJRAk0CUAJRAk8CSwJRAlACTQJRAkwCTwJRAk4COgGdAXsBQAGyAZkBPwF/AbYBnQFSAnsBsgFTApkBfwFUArYBnQGcAVICnAFVAlICsgGzAVMCswFXAlMCfwF+AVQCfgFZAlQCnAGbAVUCmwFWAlUCswG0AVcCtAFYAlcCfgF9AVkCfQFaAlkCmwGaAVYCmgFTAlYCtAG1AVgCtQFUAlgCfQF8AVoCfAFSAloCmQFTApoBtgFUArUBewFSAnwBUgJVAloCUwJXAlYCVAJZAlgCVgJbAlUCWAJbAlcCWgJbAlkCVQJbAloCVwJbAlYCWQJbAlgCOwGiAYABQQG3AZ4BQAGEAbsBogFcAoABtwFdAp4BhAFeArsBogGhAVwCoQFfAlwCtwG4AV0CuAFhAl0ChAGDAV4CgwFjAl4CoQGgAV8CoAFgAl8CuAG5AWECuQFiAmECgwGCAWMCggFkAmMCoAGfAWACnwFdAmACuQG6AWICugFeAmICggGBAWQCgQFcAmQCngFdAp8BuwFeAroBgAFcAoEBXAJfAmQCXQJhAmACXgJjAmICYAJlAl8CYgJlAmECZAJlAmMCXwJlAmQCYQJlAmACYwJlAmICPAGnAYUBQgG8AaMBQQGJAcABpwFmAoUBvAFnAqMBiQFoAsABpwGmAWYCpgFpAmYCvAG9AWcCvQFrAmcCiQGIAWgCiAFtAmgCpgGlAWkCpQFqAmkCvQG+AWsCvgFsAmsCiAGHAW0ChwFuAm0CpQGkAWoCpAFnAmoCvgG/AWwCvwFoAmwChwGGAW4ChgFmAm4CowFnAqQBwAFoAr8BhQFmAoYBZgJpAm4CZwJrAmoCaAJtAmwCagJvAmkCbAJvAmsCbgJvAm0CaQJvAm4CawJvAmoCbQJvAmwCQgGsAcUBPgHGAagBQwHBAcoBrAFwAsUBxgFxAqgBwQFyAsoBrAGrAXACqwFzAnACxgHHAXECxwF1AnECwQHCAXICwgF3AnICqwGqAXMCqgF0AnMCxwHIAXUCyAF2AnUCwgHDAXcCwwF4AncCqgGpAXQCqQFxAnQCyAHJAXYCyQFyAnYCwwHEAXgCxAFwAngCqAFxAqkBygFyAskBxQFwAsQBcAJzAngCcQJ1AnQCcgJ3AnYCdAJ5AnMCdgJ5AnUCeAJ5AncCcwJ5AngCdQJ5AnQCdwJ5AnYCPgGxAcYBPwHLAa0BQwHKAc8BsQF6AsYBywF7Aq0BygF8As8BsQGwAXoCsAF9AnoCywHMAXsCzAF/AnsCygHJAXwCyQGBAnwCsAGvAX0CrwF+An0CzAHNAX8CzQGAAn8CyQHIAYECyAGCAoECrwGuAX4CrgF7An4CzQHOAYACzgF8AoACyAHHAYICxwF6AoICrQF7Aq4BzwF8As4BxgF6AscBegJ9AoICewJ/An4CfAKBAoACfgKDAn0CgAKDAn8CggKDAoECfQKDAoICfwKDAn4CgQKDAoACPwG2AcsBQAHQAbIBQwHPAdQBtgGEAssB0AGFArIBzwGGAtQBtgG1AYQCtQGHAoQC0AHRAYUC0QGJAoUCzwHOAYYCzgGLAoYCtQG0AYcCtAGIAocC0QHSAYkC0gGKAokCzgHNAYsCzQGMAosCtAGzAYgCswGFAogC0gHTAYoC0wGGAooCzQHMAYwCzAGEAowCsgGFArMB1AGGAtMBywGEAswBhAKHAowChQKJAogChgKLAooCiAKNAocCigKNAokCjAKNAosChwKNAowCiQKNAogCiwKNAooCQAG7AdABQQHVAbcBQwHUAdkBuwGOAtAB1QGPArcB1AGQAtkBuwG6AY4CugGRAo4C1QHWAY8C1gGTAo8C1AHTAZAC0wGVApACugG5AZECuQGSApEC1gHXAZMC1wGUApMC0wHSAZUC0gGWApUCuQG4AZICuAGPApIC1wHYAZQC2AGQApQC0gHRAZYC0QGOApYCtwGPArgB2QGQAtgB0AGOAtEBjgKRApYCjwKTApICkAKVApQCkgKXApEClAKXApMClgKXApUCkQKXApYCkwKXApIClQKXApQCQQHAAdUBQgHFAbwBQwHZAcEBwAGYAtUBxQGZArwB2QGaAsEBwAG/AZgCvwGbApgCxQHEAZkCxAGdApkC2QHYAZoC2AGfApoCvwG+AZsCvgGcApsCxAHDAZ0CwwGeAp0C2AHXAZ8C1wGgAp8CvgG9AZwCvQGZApwCwwHCAZ4CwgGaAp4C1wHWAaAC1gGYAqACvAGZAr0BwQGaAsIB1QGYAtYBmAKbAqACmQKdApwCmgKfAp4CnAKhApsCngKhAp0CoAKhAp8CmwKhAqACnQKhApwCnwKhAp4CogKjAqQCpAKlAqICpgKnAqgCqAKpAqYCqgKrAqwCrAKtAqoCrgKvArACsAKxAq4CsgKzArQCtAK1ArICtgK3ArgCuAK5ArYCugK7ArwCvAK9AroCvgK/AsACwALBAr4CwgLDAsQCxALFAsICxgLHAsgCyALJAsYCygLLAswCzALNAsoCzgLPAtAC0ALRAs4C0gLeAvYC1AL3AuIC0wLyAvsC3gJ0A/YC9wJ1A+IC8gJ2A/sC3gLfAnQD3wJ3A3QD9wL4AnUD+AJ5A3UD8gLzAnYD8wJ7A3YD3wLgAncD4AJ4A3cD+AL5AnkD+QJ6A3kD8wL0AnsD9AJ8A3sD4ALhAngD4QJ1A3gD+QL6AnoD+gJ2A3oD9AL1AnwD9QJ0A3wD4gJ1A+EC+wJ2A/oC9gJ0A/UCdAN3A3wDdQN5A3gDdgN7A3oDeAN9A3cDegN9A3kDfAN9A3sDdwN9A3wDeQN9A3gDewN9A3oD0gLjAt4C1QL8AucC1ALiAgAD4wJ+A94C/AJ/A+cC4gKAAwAD4wLkAn4D5AKBA34D/AL9An8D/QKDA38D4gLhAoAD4QKFA4AD5ALlAoED5QKCA4ED/QL+AoMD/gKEA4MD4QLgAoUD4AKGA4UD5QLmAoID5gJ/A4ID/gL/AoQD/wKAA4QD4ALfAoYD3wJ+A4YD5wJ/A+YCAAOAA/8C3gJ+A98CfgOBA4YDfwODA4IDgAOFA4QDggOHA4EDhAOHA4MDhgOHA4UDgQOHA4YDgwOHA4IDhQOHA4QD0gLoAuMC1gIBA+wC1QLnAgUD6AKIA+MCAQOJA+wC5wKKAwUD6ALpAogD6QKLA4gDAQMCA4kDAgONA4kD5wLmAooD5gKPA4oD6QLqAosD6gKMA4sDAgMDA40DAwOOA40D5gLlAo8D5QKQA48D6gLrAowD6wKJA4wDAwMEA44DBAOKA44D5QLkApAD5AKIA5AD7AKJA+sCBQOKAwQD4wKIA+QCiAOLA5ADiQONA4wDigOPA44DjAORA4sDjgORA40DkAORA48DiwORA5ADjQORA4wDjwORA44D0gLtAugC1wIGA/EC1gLsAgoD7QKSA+gCBgOTA/EC7AKUAwoD7QLuApID7gKVA5IDBgMHA5MDBwOXA5MD7ALrApQD6wKZA5QD7gLvApUD7wKWA5UDBwMIA5cDCAOYA5cD6wLqApkD6gKaA5kD7wLwApYD8AKTA5YDCAMJA5gDCQOUA5gD6gLpApoD6QKSA5oD8QKTA/ACCgOUAwkD6AKSA+kCkgOVA5oDkwOXA5YDlAOZA5gDlgObA5UDmAObA5cDmgObA5kDlQObA5oDlwObA5YDmQObA5gD0gL2Au0C0wILA/IC1wLxAg8D9gKcA+0CCwOdA/IC8QKeAw8D9gL1ApwD9QKfA5wDCwMMA50DDAOhA50D8QLwAp4D8AKjA54D9QL0Ap8D9AKgA58DDAMNA6EDDQOiA6ED8ALvAqMD7wKkA6MD9ALzAqAD8wKdA6ADDQMOA6IDDgOeA6ID7wLuAqQD7gKcA6QD8gKdA/MCDwOeAw4D7QKcA+4CnAOfA6QDnQOhA6ADngOjA6IDoAOlA58DogOlA6EDpAOlA6MDnwOlA6QDoQOlA6ADowOlA6ID1wIPAy0D0wIQAwsD2AIpAxQDDwOmAy0DEAOnAwsDKQOoAxQDDwMOA6YDDgOpA6YDEAMRA6cDEQOrA6cDKQMqA6gDKgOtA6gDDgMNA6kDDQOqA6kDEQMSA6sDEgOsA6sDKgMrA60DKwOuA60DDQMMA6oDDAOnA6oDEgMTA6wDEwOoA6wDKwMsA64DLAOmA64DCwOnAwwDFAOoAxMDLQOmAywDpgOpA64DpwOrA6oDqAOtA6wDqgOvA6kDrAOvA6sDrgOvA60DqQOvA64DqwOvA6oDrQOvA6wD0wL7AjID1AIVA/cC2QIuAxkD+wKwAzIDFQOxA/cCLgOyAxkD+wL6ArAD+gKzA7ADFQMWA7EDFgO1A7EDLgMvA7IDLwO3A7ID+gL5ArMD+QK0A7MDFgMXA7UDFwO2A7UDLwMwA7cDMAO4A7cD+QL4ArQD+AKxA7QDFwMYA7YDGAOyA7YDMAMxA7gDMQOwA7gD9wKxA/gCGQOyAxgDMgOwAzEDsAOzA7gDsQO1A7QDsgO3A7YDtAO5A7MDtgO5A7UDuAO5A7cDswO5A7gDtQO5A7QDtwO5A7YD1AIAAzcD1QIaA/wC2gIzAx4DAAO6AzcDGgO7A/wCMwO8Ax4DAAP/AroD/wK9A7oDGgMbA7sDGwO/A7sDMwM0A7wDNAPBA7wD/wL+Ar0D/gK+A70DGwMcA78DHAPAA78DNAM1A8EDNQPCA8ED/gL9Ar4D/QK7A74DHAMdA8ADHQO8A8ADNQM2A8IDNgO6A8ID/AK7A/0CHgO8Ax0DNwO6AzYDugO9A8IDuwO/A74DvAPBA8ADvgPDA70DwAPDA78DwgPDA8EDvQPDA8IDvwPDA74DwQPDA8AD1QIFAzwD1gIfAwED2wI4AyMDBQPEAzwDHwPFAwEDOAPGAyMDBQMEA8QDBAPHA8QDHwMgA8UDIAPJA8UDOAM5A8YDOQPLA8YDBAMDA8cDAwPIA8cDIAMhA8kDIQPKA8kDOQM6A8sDOgPMA8sDAwMCA8gDAgPFA8gDIQMiA8oDIgPGA8oDOgM7A8wDOwPEA8wDAQPFAwIDIwPGAyIDPAPEAzsDxAPHA8wDxQPJA8gDxgPLA8oDyAPNA8cDygPNA8kDzAPNA8sDxwPNA8wDyQPNA8gDywPNA8oD1gIKA0ED1wIkAwYD3AI9AygDCgPOA0EDJAPPAwYDPQPQAygDCgMJA84DCQPRA84DJAMlA88DJQPTA88DPQM+A9ADPgPVA9ADCQMIA9EDCAPSA9EDJQMmA9MDJgPUA9MDPgM/A9UDPwPWA9UDCAMHA9IDBwPPA9IDJgMnA9QDJwPQA9QDPwNAA9YDQAPOA9YDBgPPAwcDKAPQAycDQQPOA0ADzgPRA9YDzwPTA9ID0APVA9QD0gPXA9ED1APXA9MD1gPXA9UD0QPXA9YD0wPXA9ID1QPXA9QD1wItAyQD2AJCAykD3AIoA0YDLQPYAyQDQgPZAykDKAPaA0YDLQMsA9gDLAPbA9gDQgNDA9kDQwPdA9kDKAMnA9oDJwPfA9oDLAMrA9sDKwPcA9sDQwNEA90DRAPeA90DJwMmA98DJgPgA98DKwMqA9wDKgPZA9wDRANFA94DRQPaA94DJgMlA+ADJQPYA+ADKQPZAyoDRgPaA0UDJAPYAyUD2APbA+AD2QPdA9wD2gPfA94D3APhA9sD3gPhA90D4APhA98D2wPhA+AD3QPhA9wD3wPhA94D0wIyAxAD2QJHAy4D2AIUA0sDMgPiAxADRwPjAy4DFAPkA0sDMgMxA+IDMQPlA+IDRwNIA+MDSAPnA+MDFAMTA+QDEwPpA+QDMQMwA+UDMAPmA+UDSANJA+cDSQPoA+cDEwMSA+kDEgPqA+kDMAMvA+YDLwPjA+YDSQNKA+gDSgPkA+gDEgMRA+oDEQPiA+oDLgPjAy8DSwPkA0oDEAPiAxED4gPlA+oD4wPnA+YD5APpA+gD5gPrA+UD6APrA+cD6gPrA+kD5QPrA+oD5wPrA+YD6QPrA+gD1AI3AxUD2gJMAzMD2QIZA1ADNwPsAxUDTAPtAzMDGQPuA1ADNwM2A+wDNgPvA+wDTANNA+0DTQPxA+0DGQMYA+4DGAPzA+4DNgM1A+8DNQPwA+8DTQNOA/EDTgPyA/EDGAMXA/MDFwP0A/MDNQM0A/ADNAPtA/ADTgNPA/IDTwPuA/IDFwMWA/QDFgPsA/QDMwPtAzQDUAPuA08DFQPsAxYD7APvA/QD7QPxA/AD7gPzA/ID8AP1A+8D8gP1A/ED9AP1A/MD7wP1A/QD8QP1A/AD8wP1A/ID1QI8AxoD2wJRAzgD2gIeA1UDPAP2AxoDUQP3AzgDHgP4A1UDPAM7A/YDOwP5A/YDUQNSA/cDUgP7A/cDHgMdA/gDHQP9A/gDOwM6A/kDOgP6A/kDUgNTA/sDUwP8A/sDHQMcA/0DHAP+A/0DOgM5A/oDOQP3A/oDUwNUA/wDVAP4A/wDHAMbA/4DGwP2A/4DOAP3AzkDVQP4A1QDGgP2AxsD9gP5A/4D9wP7A/oD+AP9A/wD+gP/A/kD/AP/A/sD/gP/A/0D+QP/A/4D+wP/A/oD/QP/A/wD1gJBAx8D3AJWAz0D2wIjA1oDQQMABB8DVgMBBD0DIwMCBFoDQQNAAwAEQAMDBAAEVgNXAwEEVwMFBAEEIwMiAwIEIgMHBAIEQAM/AwMEPwMEBAMEVwNYAwUEWAMGBAUEIgMhAwcEIQMIBAcEPwM+AwQEPgMBBAQEWANZAwYEWQMCBAYEIQMgAwgEIAMABAgEPQMBBD4DWgMCBFkDHwMABCADAAQDBAgEAQQFBAQEAgQHBAYEBAQJBAMEBgQJBAUECAQJBAcEAwQJBAgEBQQJBAQEBwQJBAYE3AJGA18D2AJgA0ID3QJbA2QDRgMKBF8DYAMLBEIDWwMMBGQDRgNFAwoERQMNBAoEYANhAwsEYQMPBAsEWwNcAwwEXAMRBAwERQNEAw0ERAMOBA0EYQNiAw8EYgMQBA8EXANdAxEEXQMSBBEERANDAw4EQwMLBA4EYgNjAxAEYwMMBBAEXQNeAxIEXgMKBBIEQgMLBEMDZAMMBGMDXwMKBF4DCgQNBBIECwQPBA4EDAQRBBAEDgQTBA0EEAQTBA8EEgQTBBEEDQQTBBIEDwQTBA4EEQQTBBAE2AJLA2AD2QJlA0cD3QJkA2kDSwMUBGADZQMVBEcDZAMWBGkDSwNKAxQESgMXBBQEZQNmAxUEZgMZBBUEZANjAxYEYwMbBBYESgNJAxcESQMYBBcEZgNnAxkEZwMaBBkEYwNiAxsEYgMcBBsESQNIAxgESAMVBBgEZwNoAxoEaAMWBBoEYgNhAxwEYQMUBBwERwMVBEgDaQMWBGgDYAMUBGEDFAQXBBwEFQQZBBgEFgQbBBoEGAQdBBcEGgQdBBkEHAQdBBsEFwQdBBwEGQQdBBgEGwQdBBoE2QJQA2UD2gJqA0wD3QJpA24DUAMeBGUDagMfBEwDaQMgBG4DUANPAx4ETwMhBB4EagNrAx8EawMjBB8EaQNoAyAEaAMlBCAETwNOAyEETgMiBCEEawNsAyMEbAMkBCMEaANnAyUEZwMmBCUETgNNAyIETQMfBCIEbANtAyQEbQMgBCQEZwNmAyYEZgMeBCYETAMfBE0DbgMgBG0DZQMeBGYDHgQhBCYEHwQjBCIEIAQlBCQEIgQnBCEEJAQnBCMEJgQnBCUEIQQnBCYEIwQnBCIEJQQnBCQE2gJVA2oD2wJvA1ED3QJuA3MDVQMoBGoDbwMpBFEDbgMqBHMDVQNUAygEVAMrBCgEbwNwAykEcAMtBCkEbgNtAyoEbQMvBCoEVANTAysEUwMsBCsEcANxAy0EcQMuBC0EbQNsAy8EbAMwBC8EUwNSAywEUgMpBCwEcQNyAy4EcgMqBC4EbANrAzAEawMoBDAEUQMpBFIDcwMqBHIDagMoBGsDKAQrBDAEKQQtBCwEKgQvBC4ELAQxBCsELgQxBC0EMAQxBC8EKwQxBDAELQQxBCwELwQxBC4E2wJaA28D3AJfA1YD3QJzA1sDWgMyBG8DXwMzBFYDcwM0BFsDWgNZAzIEWQM1BDIEXwNeAzMEXgM3BDMEcwNyAzQEcgM5BDQEWQNYAzUEWAM2BDUEXgNdAzcEXQM4BDcEcgNxAzkEcQM6BDkEWANXAzYEVwMzBDYEXQNcAzgEXAM0BDgEcQNwAzoEcAMyBDoEVgMzBFcDWwM0BFwDbwMyBHADMgQ1BDoEMwQ3BDYENAQ5BDgENgQ7BDUEOAQ7BDcEOgQ7BDkENQQ7BDoENwQ7BDYEOQQ7BDgEPAQ9BD4EPgQ/BDwEQARBBEIEQgRDBEAERARFBEYERgRHBEQESARJBEoESgRLBEgETARNBE4ETgRPBEwEUARRBFIEUgRTBFAEVARVBFYEVgRXBFQEWARZBFoEWgRbBFgEXARdBF4EXgRfBFwEYARhBGIEYgRjBGAEZARlBGYEZgRnBGQEaARpBGoEagRrBGgEbARtBG4EbgRvBGwEcARxBHIEcgRzBHAEdAR1BHYEdgR3BHQEeAR5BHoEegR7BHgEfAR9BH4EfgR/BHwEgASBBIIEggSDBIAEhASFBIYEhgSHBIQEiASJBIoEigSLBIgEjASNBI4EjgSPBIwEkASRBJIEkgSTBJAElASVBJYElgSXBJQEmASZBJoEmgSbBJgEnASdBJ4EngSfBJwEoAShBKIEogSjBKAEpASlBKYEpgSnBKQEqASpBKoEqgSrBKgErAStBK4ErgSvBKwEsASxBLIEsgSzBLAEtAS1BLYEtgS3BLQEuAS5BLoEugS7BLgEvAS9BL4EvgS/BLwEwATBBMIEwgTDBMAExATFBMYExgTHBMQEyATJBMoEygTLBMgE",material:"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgICAgICAgICAgICAgICAgICAgICAgICAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgICAgICAgICAgICAgICAgICAgICAgICAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwICAgICAgICAgICAgICAgICAgICAgICAgEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQICAgICAgICAgICAgICAgICAgICAgICAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBA==",light:"DAwMDAAAAAAAAAAADQ0NDRkZGRkAAAAACwsLCwAAAAAAAAAAERERERgYGBgAAAAAAAAAAAEBAQEAAAAAERERERoaGhoAAAAADg4ODgAAAAAAAAAACwsLCxkZGRkAAAAADg4ODgAAAAAAAAAACwsLCxoaGhoAAAAAAAAAAAAAAAAAAAAACgoKCh0dHR0AAAAADAwMDAAAAAAAAAAADQ0NDRoaGhoAAAAACwsLCwAAAAAAAAAADQ0NDRoaGhoAAAAACgoKCgAAAAAAAAAADQ0NDRsbGxsAAAAACQkJCQAAAAAAAAAADAwMDBsbGxsAAAAACQkJCQAAAAAAAAAADAwMDBsbGxsAAAAAHBwcHAAAAAAJCQkJAAAAAAAAAAAKCgoKAAAAAAoKCgobGxsbAAAAAAAAAAAKCgoKABQAAAAMHhMAAAYKAAAAAAAAAAAAAAAAAAAAAAABBQgQCwYAAAAECA0QAAAAAAAAAAAAAAcBAAAAFBQTEQ8YGx0eHwADCAwQAAAAAAAAAAAAAAwLCgkIHRsYFREVFhcXFgAAAAAAAAAAAAABAAAAABwZFRALFxodHh4AAAQKDgAAAAAAAQAAAAAKCgoJBx0bGBQPExIRDw0AAAADBwAAAAAFAAAMAAACBwYBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAAQCwQKDw0HAwkTGB0WFxsdGxgaEgMRDgkJDRITDgAAAAAAAAAAAAAAAAAAAAAAAAAAAAYDAAEFBAAAABAbDRUYFxIPEBQZGR8aGhweHhwdAAALAAAABQYCAQAAAAAAAAAAAAAAAAAAAAAAAAAADRoPEhcYFA8OEx0XEhwaFhUXGhkOAAkJAwEFDA0HAAABAAAAAAAAAAADBQAABAQAAAAaGhoaAAAAAAAAAAABAQEBEREREQAAAAAAAAAAAgICAgAAAAAaGhoaEREREQAAAAARAAAZHAIAAAAPAgAPDAkGAhQXGRoaFRgaHBwQDgsJBgAAAQcMAAAAAAAWEg4JBB4fHx4cCA0SFhkAAAAAAAAAAAAAAAAAAAAWEg0IAxwbGRcTAwICAgIAAAAAAAAAAAAAAAAAAAATFhgZGQcMERUZAAAAAAAAAAAAAAAAAAAADQsIBAEFBwoMDgAAAAAAAAAAAAAAAAAAAAAAAAAACgUAAAAKAAAGAwAAAAQAEhYHFBYSDQsPERgeHBsdHx4cGx0TCxkRDhEVGBYUCgACBAAAAAUIAgAAAAAAAAAAAAAAAAAAAAAAAAAAAxIDCQ4OCQMDCRweFx4eHBoaGx0WCAcSDQgIDRINAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFhEGFRMOCgwREBkKEhUQDRAVFxMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAABBQIAAAAACQEABgQAAAADAAAAAAAAAAAAAAAAAAoKCgodHR0dAAAAAA0NDQ0AAAAAAAAAAAgICAgbGxsbAAAAAAAAAAAEBAQEAAAAAAgICAgeHh4eAAAAAAwMDAwAAAAAAAAAAA0NDQ0ZGRkZAAAAAAAAAAAAAAAAAAAAAAoKCgodHR0dAAAAAAAAAAAAAAAAAAAAAAoKCgodHR0dAAAAAA==",shades:"Z2BabWZfcmtjd29ofHRsgHhwhXx0iYB4jYR7kYh/lIuCmI+FnJKIn5WLopiOppuRqZ6UrKGXr6SZsqectaqft6yhuq+kvbGmwLSowrarxbmtx7uvyr6xzMC0z8K20cW4Ai0CAjACAzICAzUCAzcCBDkDBDwDBD4DBEADBUIDBUMEBUUEBUcEBkkEBkoEBkwFBk4FB08FB1EFB1IFCFQGCFUGCFYGCFgGCVkGCVoHCVwHCV0HCl4HCmAHCmEICmIIZVBBalRFcFhIdFxMeWBPfmRSgmdVhmtYim5ajnFdkXRflXdimHpknHxnn39pooJrpYRtqIdvq4lxrotzsY51tJB3t5J5uZR7vJd9vpl+wZuAw52Cxp+DyKGFy6OHzaWIZwICbQICcgICdwMCfAMCgAMDhQMDiQQDjQQDkQQDlAQEmAQEnAUEnwUEogUEpgUFqQYFrAYFrwYFsgYFtQcGtwcGugcGvQcGwAcGwggHxQgHxwgHyggHzAkHzwkI0QkIAgICAgICAwICAwMCAwMCBAMDBAMDBAQDBAQDBQQDBQQEBQQEBQUEBgUEBgUEBgUFBgYFBwYFBwYFBwYFCAcGCAcGCAcGCAcGCQcGCQgHCQgHCQgHCggHCgkHCgkICgkI"}]};var Xr=n=>Uint8Array.from(atob(n),e=>e.charCodeAt(0)),Su=.2,Pu=.15,cs=4;function Du(n,e){return Math.sin(e*(.0028+n%3*2e-4)+n*2.4)}function jd(n,e){let t=new Float32Array(n.length),i=new Float32Array(n.length),r=[[0,0,0],[0,0,0]],o=[0,0],s=e===0?144:264,a=410;for(let c=0;c<n.length;c+=3){let l=n[c],f=n[c+1],p=n[c+2];if(f<.025){let M=+(l>0);r[M][0]+=l,r[M][2]+=p,o[M]++}let u=Math.max(0,Math.min(1,(f-.32)/2.45)),d=u*u*(3-2*u);t[c]=Su*d,i[c+1]=-Pu*d;let m=c/3-s;if(m>=0&&m<2*a){let M=m%a,h=M<24?0:M<48?Math.max(0,Math.min(1,(f-3.1)/.48)):1,A=m<a?h:-h;t[c+1]=.13*A,t[c+2]=.23*A}}return r.forEach((c,l)=>{c[0]/=o[l],c[2]/=o[l]}),{sway:t,dip:i,shoes:r}}var as=Cu.kits.map((n,e)=>{let t=Xr(n.shades),i=new Uint32Array(t.length/3);for(let o=0;o<i.length;o++)i[o]=(4278190080|t[o*3+2]<<16|t[o*3+1]<<8|t[o*3])>>>0;let r=Float32Array.from(new Int16Array(Xr(n.position).buffer),o=>o/4096);return{height:n.height,crown:n.crown,parts:n.parts,position:r,...jd(r,e),triangles:new Uint16Array(Xr(n.triangles).buffer),material:Xr(n.material),light:Xr(n.light),shades:t,rgba:i}}),cn=n=>as[n%as.length];function sa(n,e){let[t,i,r]=cn(n).crown;return[t+Su*e,i-Pu*e*e,r]}var $d=as.map(()=>new Map);function yu(n,e){let t=cn(n);if(e===0)return t.position;let i=$d[n];if(!i.has(e)){let r=e/cs;i.set(e,t.position.map((o,s)=>o+t.sway[s]*r+t.dip[s]*r*r))}return i.get(e)}function Tu(n,e){let t={morphTargetInfluences:[0,0]},i=Float32Array.from({length:256},(p,u)=>{let d=u/255;return d<=.04045?d/12.92:((d+.055)/1.055)**2.4}),r=as.map(p=>{let u=new Mt;u.setAttribute("position",new rt(p.position,3)),u.morphTargetsRelative=!0,u.morphAttributes.position=[p.sway,p.dip].map(M=>new rt(M,3));let d=new Float32Array(p.position.length);p.material.forEach((M,h)=>{let A=(M*32+p.light[h])*3;for(let w=0;w<3;w++)d[h*3+w]=i[p.shades[A+w]]}),u.setAttribute("color",new rt(d,3)),u.setIndex(new rt(p.triangles,1));let m=new Zn(u,new Yt({vertexColors:!0,side:_t}),Math.ceil(e/2));return m.setMorphAt(0,t),m.frustumCulled=!1,m.count=0,n.add(m),m}),o=document.createElement("canvas");o.width=o.height=32;let s=o.getContext("2d"),a=s.createRadialGradient(16,16,1,16,16,16);a.addColorStop(0,"rgba(13,12,11,.36)"),a.addColorStop(1,"rgba(13,12,11,0)"),s.fillStyle=a,s.fillRect(0,0,32,32);let c=new Yt({map:new Yr(o),transparent:!0,depthWrite:!1}),l=new Zn(new Vi(2.65,2.25).rotateX(-Math.PI/2),c,e);l.frustumCulled=!1,l.count=0,n.add(l);let f=new lt;return{place(p){for(let u of r)u.count=0;l.count=0;for(let{index:u,foot:d,heading:m,sway:M=0}of p){let h=r[u%r.length];f.position.copy(d),f.rotation.y=m,f.updateMatrix(),t.morphTargetInfluences[0]=M,t.morphTargetInfluences[1]=M*M,h.setMorphAt(h.count,t),h.setMatrixAt(h.count++,f.matrix),f.position.y+=.012,f.updateMatrix(),l.setMatrixAt(l.count++,f.matrix)}for(let u of r)u.count&&(u.instanceMatrix.needsUpdate=!0,u.morphTexture.needsUpdate=!0);l.count&&(l.instanceMatrix.needsUpdate=!0)},dispose(){for(let p of r)n.remove(p),p.geometry.dispose(),p.material.dispose(),p.dispose();n.remove(l),c.map.dispose(),c.dispose(),l.geometry.dispose(),l.dispose()}}}function Bu(n,e){if(!n)return null;let t;try{t=new zr({canvas:n,alpha:!0,antialias:!0,powerPreference:"low-power"})}catch{return null}t.autoClear=!1,t.setClearColor(0,0);let i=new Jn,r=new Jn,o=new ft,s=new Bi,a=new Yt({colorWrite:!1,side:_t}),c=new ct(new Mt,a);c.frustumCulled=!1,r.add(c);let l,f;function p(u,d,m,M,h){if(t.getContext().isContextLost())return n.hidden=!0,!1;if(!h.length)return n.hidden=!0,!0;(n.width!==m||n.height!==M)&&t.setSize(m,M,!1),n.hidden=!1,o.fov=u.fov*180/Math.PI,o.aspect=u.aspect,o.near=.1,o.far=1e4,o.position.fromArray(u.position),o.quaternion.fromArray(u.rotation),o.scale.fromArray(u.scale),o.updateProjectionMatrix(),o.updateMatrixWorld();let A=o.near,w=o.far,C=d.reduce((N,D)=>N+D.faces.reduce((y,L)=>y+Math.max(0,L.length-2)*3,0),0);(!l||l.count<C)&&(c.geometry.dispose(),c.geometry=new Mt,l=new rt(new Float32Array(Math.max(C*2,512)*3),3).setUsage(fc),c.geometry.setAttribute("position",l));let v=0;for(let N of d)for(let D of N.faces)for(let y=2;y<D.length;y++)for(let L of[D[0],D[y-1],D[y]])l.setXYZ(v++,2*L.x/m-1,1-2*L.y/M,(w+A-2*w*A*L.q)/(w-A));return l.needsUpdate=!0,c.geometry.setDrawRange(0,C),f||(f=Tu(i,e)),f?.place(h),t.clear(),t.render(r,s),t.render(i,o),!0}return{draw:p,hide(){n.hidden=!0},dispose(){f?.dispose(),c.geometry.dispose(),a.dispose(),t.dispose()}}}var Aa=Ea(bu(),1),Nu=Ea(Lu(),1),ds=Math.PI*2,us=new R(0,1,0),ln=.1,jn=[],Jr=(n,e,t)=>Math.max(e,Math.min(t,n)),Ht=(n,e,t)=>new R(n,e,t),hs=n=>n?.length===3&&n.every(Number.isFinite),fs={high:{distance:50,pixels:72},medium:{distance:39,pixels:56},low:{distance:29,pixels:42}},ep=new Intl.NumberFormat("tr-TR");function tp(n,e,t,i,r=0){let{triangles:o,light:s,material:a,rgba:c,height:l,shoes:f}=cn(t),p=yu(t,r);i*=1.96/l;let u=Math.cos(n),d=Math.sin(n),m=Math.cos(e),M=Math.sin(e),h=p.length/3,A=new Float32Array(h),w=new Float32Array(h),C=new Float32Array(h),v=1/0,N=-1/0,D=1/0,y=-1/0;for(let Q=0;Q<h;Q++){let J=p[Q*3],F=p[Q*3+1],ee=p[Q*3+2],se=u*ee-d*J;A[Q]=(u*J+d*ee)*i,w[Q]=(M*se-m*F)*i,C[Q]=m*se+M*F,v=Math.min(v,A[Q]),N=Math.max(N,A[Q]),D=Math.min(D,w[Q]),y=Math.max(y,w[Q])}let L=Math.floor(v)-1,E=Math.floor(D)-1,x=document.createElement("canvas");x.width=Math.ceil(N)-L+1,x.height=Math.ceil(y)-E+1;let P=x.getContext("2d"),G=P.createImageData(x.width,x.height),O=new Float32Array(x.width*x.height).fill(-1/0),z=new Uint32Array(G.data.buffer);for(let Q=0;Q<o.length;Q+=3){let J=o[Q],F=o[Q+1],ee=o[Q+2],se=A[F]-A[J],oe=w[F]-w[J],me=A[ee]-A[J],Be=w[ee]-w[J],V=se*Be-oe*me;if(Math.abs(V)<1e-7)continue;let j=Math.ceil(Math.min(A[J],A[F],A[ee])-.5),fe=Math.floor(Math.max(A[J],A[F],A[ee])-.5),ie=Math.ceil(Math.min(w[J],w[F],w[ee])-.5),Ee=Math.floor(Math.max(w[J],w[F],w[ee])-.5);for(let Se=ie;Se<=Ee;Se++)for(let Pe=j;Pe<=fe;Pe++){let Ye=Pe+.5-A[J],Te=Se+.5-w[J],ze=(Ye*Be-Te*me)/V,B=(se*Te-oe*Ye)/V,Xe=1-ze-B;if(Xe<0||ze<0||B<0)continue;let Fe=Xe*C[J]+ze*C[F]+B*C[ee],Le=(Se-E)*x.width+Pe-L;if(Fe<=O[Le])continue;O[Le]=Fe;let ge=Math.round(Xe*s[J]+ze*s[F]+B*s[ee]);z[Le]=c[a[J]*32+ge]}}P.putImageData(G,0,0);let W=([Q,J,F])=>({x:(u*Q+d*F)*i-L,y:(M*(u*F-d*Q)-m*J)*i-E});return{tile:x,pixels:i,shoes:f.map(W),crown:W(sa(t,r/cs))}}function ip(n,e,t,i,r,o,s){let[a,c]=n.shoes,[l,f]=e,p=(a.x+c.x)/2,u=(a.y+c.y)/2,d=(l.x+f.x)/2,m=(l.y+f.y)/2,M=n.crown.x-p,h=n.crown.y-u,A=c.x-p,w=c.y-u,C=(n.pixels*.18)**2,v=M*M+A*A+C,N=M*h+A*w,D=h*h+w*w+C,y=v*D-N*N;function L(E,x,P,G){let O=M*P+A*G+C*E,z=h*P+w*G+C*x;return[(O*D-z*N)/y,(z*v-O*N)/y]}return[i,o]=L(i,o,t.x-d,f.x-d),[r,s]=L(r,s,t.y-m,f.y-m),{ax:i,ay:r,bx:o,by:s,x:d-i*p-o*u,y:m-r*p-s*u}}function fa(n,e,t){let i=[],r=n.at(-1),o=e(r);for(let s of n){let a=e(s);o>=0!=a>=0&&i.push(t(r,s,o/(o-a))),a>=0&&i.push(s),r=s,o=a}return i}function np(n,e,t){let i=new R().fromArray(n.position),r=new Ct().fromArray(n.rotation).invert(),o=new R().fromArray(n.scale),s=t/(2*Math.tan(n.fov/2)),a=s*e/(t*n.aspect);function c(u){let d=u.clone().sub(i).applyQuaternion(r).divide(o);return d.z=-d.z,d}function l(u){return{x:e*.5+a*u.x/u.z,y:t*.5-s*u.y/u.z,q:1/u.z}}function f(u){let d=c(u);return d.z>=ln?l(d):null}function p(u){return fa(u.map(c),d=>d.z-ln,(d,m,M)=>d.clone().lerp(m,M)).map(l)}return{eye:i,local:c,screen:l,project:f,polygon:p,width:e,height:t,fx:a,fy:s}}function ps(n){let e={left:1/0,top:1/0,right:-1/0,bottom:-1/0,nearQ:0,farQ:1/0};for(let t of n)e.left=Math.min(e.left,t.x),e.right=Math.max(e.right,t.x),e.top=Math.min(e.top,t.y),e.bottom=Math.max(e.bottom,t.y),e.nearQ=Math.max(e.nearQ,t.q),e.farQ=Math.min(e.farQ,t.q);return e}var qr=(n,e)=>n.left<e.right&&e.left<n.right&&n.top<e.bottom&&e.top<n.bottom;function Fu(n,e=new Path2D){e.moveTo(n[0].x,n[0].y);for(let t=1;t<n.length;t++)e.lineTo(n[t].x,n[t].y);return e.closePath(),e}function Ou(n){let e=n.slice().sort((i,r)=>i.x-r.x||i.y-r.y),t=i=>{let r=[];for(let o of i){for(;r.length>=2;){let[s,a]=r.slice(-2);if((a.x-s.x)*(o.y-s.y)>(a.y-s.y)*(o.x-s.x))break;r.pop()}r.push(o)}return r.pop(),r};return t(e).concat(t(e.reverse()))}function Uu(n){let[e,t]=n;for(let i of n.slice(2)){let r=(t.x-e.x)*(i.y-e.y)-(i.x-e.x)*(t.y-e.y);if(Math.abs(r)<1e-7)continue;let o=((t.q-e.q)*(i.y-e.y)-(i.q-e.q)*(t.y-e.y))/r,s=((t.x-e.x)*(i.q-e.q)-(i.x-e.x)*(t.q-e.q))/r;return a=>e.q+(a.x-e.x)*o+(a.y-e.y)*s}return()=>e.q}function Qu(n,e){let t=new Path2D;return t.rect(-1,-1,n.width+2,n.height+2),Fu(e,t)}var rp=[[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]],{centerX:$n,centerZ:er,halfRing:Ii,halfDeck:aa}=Aa.default;function op(n,e){let t=[],i={left:0,top:0,right:n.width,bottom:n.height};function r(a,c,l,f,p){let u=Array.from({length:8},(A,w)=>{let C=Ht((w&1?.5:-.5)*c,(w&2?.5:-.5)*l,(w&4?.5:-.5)*f);return p&&C.applyQuaternion(p),n.local(C.add(a))});if(u.every(A=>A.z<ln))return;let d=rp.map(A=>fa(A.map(w=>u[w]),w=>w.z-ln,(w,C,v)=>w.clone().lerp(C,v)).map(n.screen)).filter(A=>A.length>=3),m=d.flat(),M=ps(m);if(!qr(M,i))return;let h=m.filter(A=>Math.abs(A.q-1/ln)<1e-6);h.length>=3&&d.push(Ou(h)),t.push({b:M,faces:d,all:Qu(n,Ou(m))})}let o=e.floor,s=.785/5;r(Ht($n,o-.049,er),aa*2,.102,aa*2),r(Ht($n,o-.28,er),Ii*2+.8,.56,Ii*2+.8);for(let a of[-1,1]){for(let c of[-1,1]){let l=new Ct().setFromAxisAngle(us,a*c*Math.PI/4);r(Ht($n+a*(Ii-.32),o+1.65,er+c*(Ii-.32)),1,3.3,.5,l)}for(let c=0;c<4;c++){let l=o+.48+c*.75;r(Ht($n+a*Ii,l,er),s,s,2*Ii),r(Ht($n,l,er+a*Ii),2*Ii,s,s)}}for(let[a,c]of(e.fighters||jn).entries()){if(!hs(c)||Math.max(Math.abs(c[0]),Math.abs(c[2]))>Ii+1)continue;let l=new R().fromArray(c),f=e.fighters[1-a],p=hs(f)?Math.atan2(f[0]-c[0],f[2]-c[2]):Math.atan2(-c[0],-c[2]),u=new Ct().setFromAxisAngle(us,p),d=Jr(c[1]-o,.6,4.5),m=(h,A,w)=>Ht(h*d,(A-1)*d,w*d).applyQuaternion(u).add(l),M=(h,A,w,C)=>{let v=A.clone().sub(h);r(h.clone().lerp(A,.5),w,v.length()+.04,C,new Ct().setFromUnitVectors(us,v.normalize()))};r(l,d*.18,d*.23,d*.18,u),r(m(0,.69,-.025),d*.34,d*.4,d*.21,u);for(let[h,A]of[-1,1].entries()){let w=e.contacts?.[a]?.[h],C=hs(w)?new R().fromArray(w):m(A*.135,.035,A*.095);M(m(A*.09,.52,0),C,d*.13,d*.14),M(m(A*.16,.83,0),m(A*.22,.64,.09),d*.12,d*.13),M(m(A*.22,.64,.09),m(A*.13,.87,.17),d*.12,d*.13),r(m(A*.13,.87,.17),d*.17,d*.17,d*.17,u)}}return t}function Gu(n,e,t,i,r){for(let o of t)if(!(o.b.nearQ<=i.farQ||!qr(o.b,i))){if(o.b.farQ>=i.nearQ){n.clip(o.all,"evenodd");continue}for(let s of o.faces){let a=fa(s,c=>c.q-r(c)-1e-7,(c,l,f)=>({x:c.x+(l.x-c.x)*f,y:c.y+(l.y-c.y)*f,q:c.q+(l.q-c.q)*f}));a.length>=3&&qr(ps(a),i)&&n.clip(Qu(e,a),"evenodd")}}}var ca=Math.max(cn(0).height,cn(1).height),QS=aa-1.5;var la=Nu.default.waitingSeats(Aa.default);function sp(n,e,t,i,r){let o=e,s=n.eye.y-(o+ca*.5),a=i.distance**2-s**2,c=Math.min(t,la.length);for(let l=0;l<c;l++){let{x:f,z:p,heading:u}=la[l];(f-n.eye.x)**2+(p-n.eye.z)**2<=a&&r(l,Ht(f,o,p),u)}}function ap(n,e,t,i,r,o,s,a){let c=Jr(o*.105,6,24),l=Jr(c*.9,10,16),f=r-c-3-(a?2*(l+3):0);if(n.beginPath(),n.arc(i,f,c,0,ds),n.fillStyle="#17232c",n.fill(),n.save(),n.clip(),t?.naturalWidth){let C=Math.min(t.naturalWidth,t.naturalHeight);n.drawImage(t,(t.naturalWidth-C)/2,(t.naturalHeight-C)/2,C,C,i-c,f-c,2*c,2*c)}else n.fillStyle="#fff",n.font="bold "+Math.round(c)+'px "Segoe UI"',n.textAlign="center",n.fillText((e?.nickname||e?.uniqueId||"?").slice(0,1),i,f+c*.36);if(n.restore(),n.strokeStyle=a?"#d6bd8c":s?"#fb7875":"#78adff",n.lineWidth=1.5,n.stroke(),!a)return;let p="#"+a;n.font="bold "+l+'px "Segoe UI"',n.textAlign="left";let u=n.measureText(p).width+6,d=i+c*.65;n.fillStyle="#e7cd97",n.fillRect(d,f-l*.65,u,l+3),n.fillStyle="#18212a",n.fillText(p,d+3,f+l*.36);let m=e?.uniqueId?"@"+e.uniqueId.replace(/^@/,""):e?.nickname||"",M=m.length>20?m.slice(0,19)+"\u2026":m;n.textAlign="center";let h=Math.min(146,n.measureText(M).width+8);n.fillStyle="#101923",n.fillRect(i-h/2,f+c-1,h,l+3),n.fillStyle="#fff",n.fillText(M,i,f+c+l-1,140);let A=ep.format(e?.fps??e?.coins??0)+" FPS";n.font="600 "+Jr(l-1,9,14)+'px "Segoe UI"',n.textAlign="center";let w=n.measureText(A).width+6;n.fillStyle="#16212b",n.fillRect(i-w*.5,f+c+l+2,w,l+3),n.fillStyle="#ffe5ad",n.fillText(A,i,f+c+2*l+2)}function cp(n){if(!n)return null;let e=Array.from({length:64},(d,m)=>{let M=(m+.2+.6*Math.random())*ds/64,h=30+Math.random()*8;return Ht($n+h*Math.sin(M),3.8+Math.random()*4,er+h*Math.cos(M))}),t=Array.from({length:12},(d,m)=>{let M=m===0?n:n.cloneNode(!1);return m&&(M.removeAttribute("id"),n.before(M)),M.width=M.height=36,{tile:M,ctx:M.getContext("2d"),site:null,fade:null}}),i=Math.floor(Math.random()*e.length),r=!1,o=0,s=null,a=null,c=0;function l({tile:d,ctx:m,site:M}){if(!M||!s){d.hidden=!0;return}let h=s.project(Ht(M.x,M.y+c,M.z));if(!h||h.x<0||h.y<0||h.x>=s.width||h.y>=s.height){d.hidden=!0;return}let A=Math.floor(h.x)-18,w=Math.floor(h.y)-18,C=Jr(s.fy*h.q*.38,5,15),v={left:h.x-C,right:h.x+C,top:h.y-C,bottom:h.y+C,nearQ:h.q,farQ:h.q};m.clearRect(0,0,36,36),m.save(),m.translate(-A,-w),Gu(m,s,a,v,()=>h.q);let N=m.createRadialGradient(h.x,h.y,0,h.x,h.y,C);N.addColorStop(0,"white"),N.addColorStop(.29,"white"),N.addColorStop(.54,"rgba(205,227,255,.68)"),N.addColorStop(1,"rgba(167,205,255,0)"),m.fillStyle=N,m.fillRect(v.left,v.top,C*2,C*2),m.restore(),d.style.transform="translate("+A+"px,"+w+"px)",d.hidden=!1}function f(d){d.fade?.cancel(),d.fade=null,d.site=null,d.tile.hidden=!0}function p(){i=(i+9)%e.length,t.forEach((d,m)=>{f(d);let M=Math.floor(m/3),h=m%3;d.site=e[(i+M*16+2*h)%e.length],l(d);let A=d.tile.animate([{opacity:0},{opacity:1,offset:.07},{opacity:.94,offset:.38},{opacity:0}],{delay:h*48+Math.random()*40,duration:200+Math.random()*60,fill:"both"});d.fade=A,A.onfinish=()=>{d.fade===A&&f(d)}}),o=setTimeout(p,420+Math.random()*260)}function u(d){r!==d&&(r=d,r?o=setTimeout(p,220):(clearTimeout(o),t.forEach(f)))}return{setEnabled:u,setView(d,m,M){s=d,a=m,c=M;for(let h of t)h.site&&l(h)},dispose(){u(!1);for(let{tile:d}of t)d!==n&&d.remove()}}}window.createRingside=function(e){let t=e?.getContext("2d");if(!t)return null;let i=Bu(e.id==="ringside"?document.getElementById("stadium"):null,la.length),r=cp(document.getElementById("phone-flash")),o,s=jn,a=fs.high,c=0,l=!1,f="",p,u=0,d,m,M,h=new Map,A=new Map,w=new Map,C=0;function v(){!c&&!l&&o&&(c=requestAnimationFrame(E))}function N(P){P&&!u&&(u=setInterval(v,80)),!P&&u&&(clearInterval(u),u=0)}function D(){for(;!l&&C<4&&w.size;){let[P,{img:G,urls:O}]=w.entries().next().value;w.delete(P);let z=0;C++;let W=()=>{G.onload=null,G.onerror=null,C--,v(),D()};G.onload=W,G.onerror=()=>{!l&&++z<O.length?G.src=O[z]:W()},G.src=O[0]}}function y(P){let G=[...new Set([P?.portrait,P?.profilePictureUrl,...P?.profilePictureUrls||jn])].filter(W=>typeof W=="string"&&/^(https:|file:)/i.test(W));if(!G.length)return null;let O=G.join(`
`);if(h.has(O))return h.get(O);if(h.size>=512){let W=h.keys().next().value;w.delete(W),h.delete(W)}let z=new Image;return z.referrerPolicy="no-referrer",h.set(O,z),w.set(O,{img:z,urls:G}),D(),z}function L(P,G,O,z){let W=(Math.round(P*8/Math.PI)%16+16)%16,Q=Math.round(G*8),J=[a.pixels,W,Q,O,z].join("/"),F=A.get(J);return F?A.delete(J):(A.size>=256&&A.delete(A.keys().next().value),F=tp(W*Math.PI/8,Q/8,O,a.pixels,z)),A.set(J,F),F}function E(P=performance.now()){if(c=0,l||!o||!Number.isFinite(o.floor))return;let G=innerWidth,O=innerHeight;if(!G||!O)return;e.width!==G&&(e.width=G),e.height!==O&&(e.height=O),t.clearRect(0,0,G,O),(d!==f||m?.width!==G||m?.height!==O)&&(m=np(o,G,O),M=op(m,o),d=f),r?.setView(m,M,o.floor);let z={left:0,top:0,right:G,bottom:O},W=[],Q=0;function J(oe,me){let Be=m.polygon(oe);if(Be.length<3)return;let V=ps(Be);if(!qr(V,z))return;let j=Fu(Be);W.push({b:V,at:Uu(Be),depth:Be.reduce((fe,ie)=>fe+1/ie.q,0)/Be.length,paint(){t.fillStyle=me,t.fill(j)}})}let F=[];sp(m,o.floor,s.length,a,(oe,me,Be)=>{let V=m.local(Ht(me.x,me.y+ca*.5,me.z)),j=ca*.65;V.z+j<ln||Math.abs(V.x)>j+(V.z+j)*G/(2*m.fx)||Math.abs(V.y)>j+(V.z+j)*O/(2*m.fy)||F.push({index:oe,foot:me,heading:Be,sway:Du(oe,P)})});let ee=i?.draw(o,M,G,O,F);function se(oe,{foot:me,heading:Be,index:V,sway:j}){let fe=V%2,ie=V+1,Ee=cn(fe),Se=Ee.height,Pe=me.clone();Pe.y+=Se*.5;let Ye=m.local(Pe);if(Ye.z<=ln)return;let Te=m.screen(Ye),ze=m.fy*Se/Ye.z/o.scale[1];if(ze<6||ze>O*3||Te.x<-ze||Te.x>G+ze||Te.y<-ze||Te.y>O+ze)return;let B=Je=>m.project(new R().fromArray(Je).applyAxisAngle(us,Be).add(me)),Xe=B(sa(fe,j));if(!Xe)return;let Fe={left:Xe.x-72,right:Xe.x+90,top:Xe.y-99,bottom:Xe.y,nearQ:Xe.q,farQ:Xe.q},Le=()=>ap(t,oe,y(oe),Xe.x,Xe.y,ze,fe,ie);if(ee){Q++,W.push({b:Fe,at:()=>Xe.q,depth:1/Xe.q,paint:Le});return}let ge=m.eye.clone().sub(Pe),je=Math.atan2(ge.x,ge.z),we=Math.atan2(ge.y,Math.hypot(ge.x,ge.z)),S=Ht(Math.cos(je),0,-Math.sin(je)),g=ge.normalize().cross(S).normalize(),U=m.project(Pe.clone().add(S)),X=m.project(Pe.clone().add(g));if(!U||!X)return;let Z=Uu([Te,U,X]),Y=Ee.shoes.map(B);if(!Y.every(Boolean))return;let pe=L(Be-je,we,fe,Math.round(j*cs)),{x:ne,y:ce,ax:He,ay:$,bx:de,by:Ce}=ip(pe,Y,Xe,(U.x-Te.x)/pe.pixels,(U.y-Te.y)/pe.pixels,(Te.x-X.x)/pe.pixels,(Te.y-X.y)/pe.pixels),{width:De,height:he}=pe.tile,ke=[{x:ne,y:ce},{x:ne+He*De,y:ce+$*De},{x:ne+de*he,y:ce+Ce*he},{x:ne+He*De+de*he,y:ce+$*De+Ce*he}],be=ps(ke.map(Je=>({...Je,q:Z(Je)})));qr(be,z)&&(W.push({b:be,at:Z,depth:Ye.z,paint(){t.transform(He,$,de,Ce,ne,ce),t.drawImage(pe.tile,0,0)}}),W.push({b:Fe,at:()=>Xe.q,depth:1/Xe.q,paint:Le}),Q++)}for(let oe of F){let me=s[oe.index];me&&se(me,oe)}for(let oe of o.contacts||jn)for(let me of oe||jn){if(!hs(me))continue;let[Be,V,j]=me;for(let[fe,ie]of[[.27,.09],[.18,.16]]){let Ee=Array.from({length:12},(Se,Pe)=>Ht(Be+Math.cos(Pe*ds/12)*fe,V+.012,j+Math.sin(Pe*ds/12)*fe*1.35));J(Ee,"rgba(9,14,17,"+ie+")")}}W.sort((oe,me)=>me.depth-oe.depth);for(let oe of W)t.save(),Gu(t,m,M,oe.b,oe.at),oe.paint(),t.restore();e.dataset.visibleBoxers=String(Q),e.hidden=!W.length,N(Q>0)}function x(){f="",v()}return window.addEventListener("resize",x),{update(P,G,O={}){if(l)return;if(o=P,s=G||jn,r?.setEnabled(Number.isFinite(o?.floor)&&O?.flashes!==!1),a=Object.hasOwn(fs,O?.quality)?fs[O.quality]:fs.high,!o||!Number.isFinite(o.floor)){N(!1),cancelAnimationFrame(c),c=0,e.hidden=!0,i?.hide(),e.dataset.visibleBoxers="0",f="";return}let z=[o.position,o.rotation,o.scale,o.fov,o.aspect,o.floor,o.contacts,o.fighters,a.pixels].join("|");z===f&&s===p||(f=z,p=s,v())},dispose(){N(!1),r?.dispose(),l=!0,cancelAnimationFrame(c),window.removeEventListener("resize",x),i?.dispose(),w.clear(),A.clear(),h.clear()}}};})();
