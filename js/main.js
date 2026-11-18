/* =====================================================================
   NOISE
   ===================================================================== */
const perm=new Uint8Array(512);(()=>{let s=1337;const r=()=>((s=(s*16807)%2147483647)/2147483647);const p=[...Array(256).keys()];for(let i=255;i>0;i--){const j=Math.floor(r()*(i+1));[p[i],p[j]]=[p[j],p[i]]}for(let i=0;i<512;i++)perm[i]=p[i&255]})();
function fade(t){return t*t*t*(t*(t*6-15)+10)}
function lerp(a,b,t){return a+t*(b-a)}
function grad(h,x,y,z){h&=15;const u=h<8?x:y,v=h<4?y:(h===12||h===14?x:z);return((h&1)?-u:u)+((h&2)?-v:v)}
function noise(x,y,z){const X=Math.floor(x)&255,Y=Math.floor(y)&255,Z=Math.floor(z)&255;x-=Math.floor(x);y-=Math.floor(y);z-=Math.floor(z);const u=fade(x),v=fade(y),w=fade(z);const A=perm[X]+Y,AA=perm[A]+Z,AB=perm[A+1]+Z,B=perm[X+1]+Y,BA=perm[B]+Z,BB=perm[B+1]+Z;
return lerp(lerp(lerp(grad(perm[AA],x,y,z),grad(perm[BA],x-1,y,z),u),lerp(grad(perm[AB],x,y-1,z),grad(perm[BB],x-1,y-1,z),u),v),lerp(lerp(grad(perm[AA+1],x,y,z-1),grad(perm[BA+1],x-1,y,z-1),u),lerp(grad(perm[AB+1],x,y-1,z-1),grad(perm[BB+1],x-1,y-1,z-1),u),v),w)}
const sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};

/* =====================================================================
   SCENE
   ===================================================================== */
const canvas=document.getElementById('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(36,1,0.05,100);
const HOME_POS=new THREE.Vector3(-2.75,0.85,1.75), HOME_TGT=new THREE.Vector3(0,-0.12,-0.05);
camera.position.copy(HOME_POS);
const controls=new THREE.OrbitControls(camera,canvas);
controls.target.copy(HOME_TGT);controls.enableDamping=true;controls.dampingFactor=.08;
controls.minDistance=.7;controls.maxDistance=8;controls.rotateSpeed=.7;controls.zoomSpeed=.9;controls.enablePan=true;controls.panSpeed=.6;

scene.add(new THREE.HemisphereLight(0xfff4ee,0x1a2233,.5));
const key=new THREE.DirectionalLight(0xffffff,.62);key.position.set(-2,3,2.5);scene.add(key);
const fill=new THREE.DirectionalLight(0xb7c8ff,.24);fill.position.set(3,1,-1);scene.add(fill);
const rim=new THREE.DirectionalLight(0xc9a2ff,.4);rim.position.set(0,1.5,-3.5);scene.add(rim);
scene.add(new THREE.AmbientLight(0xffffff,.06));

const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const regionMeshes={};          // id -> [mesh]
const pickables=[];
function reg(id,mesh){(regionMeshes[id]=regionMeshes[id]||[]).push(mesh);mesh.userData.id=id;pickables.push(mesh);return mesh}

/* ---------- cortex ---------- */
const HY=0.18, HCX=0.072;
function hemiBase(lat,dy,dz,s){
  let xl=lat>0?lat*0.47:lat*0.052;
  xl*=1-0.2*Math.pow(Math.max(0,dz),3)-0.25*Math.pow(Math.max(0,-dz),3);
  let y=dy>0?dy*0.66:dy*0.31;
  const z=dz>0?dz*0.98:dz*1.03;
  const tb=Math.exp(-Math.pow((dz-0.08)/0.38,2))*sm(0.0,0.55,lat)*sm(-0.05,0.55,-dy);
  y-=0.2*tb; xl+=0.035*tb;
  // orbitofrontal flattening
  if(dy<0&&dz>0.4) y+= 0.06*sm(0.4,0.9,dz)*sm(0,0.6,-dy);
  return [s*(HCX+xl),y+HY,z,tb];
}
const sylY=dz=>-0.22+(0.45-dz)*0.36;
function classify(lat,dy,dz,s){
  const c=dz+0.35*dy, yl=sylY(dz);
  if(lat<-0.55 && dy>-0.2 && dy<0.55 && dz>-0.55 && dz<0.7) return 'cingulate';
  const temporal = dy<yl && dz>-0.62 && dz<0.56 && (lat>-0.3 || dy<-0.5);
  if(temporal){
    if(lat>0.35 && dy>yl-0.2 && dz>-0.12 && dz<0.22) return 'auditory';
    if(s<0 && lat>0.35 && dy>yl-0.24 && dz>-0.5 && dz<=-0.12) return 'wernicke';
    return 'temporal';
  }
  if(dz+0.12*dy<-0.68) return 'occipital';
  if(c>0.05 && c<=0.19) return 'motor';
  if(c>0.19){
    if(s<0 && lat>0.4 && c>0.3 && c<0.66 && dy>yl && dy<yl+0.3) return 'broca';
    if(c<0.36 && dy>-0.1) return 'premotor';
    return 'prefrontal';
  }
  if(c>-0.13) return 'somatosensory';
  return 'parietal';
}
const hemis=[];
function smoothSeams(geo){const p=geo.attributes.position,nm=geo.attributes.normal,map=new Map();
  for(let i=0;i<p.count;i++){const k=Math.round(p.getX(i)*1e4)+'_'+Math.round(p.getY(i)*1e4)+'_'+Math.round(p.getZ(i)*1e4);let a=map.get(k);if(!a){a=[0,0,0,[]];map.set(k,a)}a[0]+=nm.getX(i);a[1]+=nm.getY(i);a[2]+=nm.getZ(i);a[3].push(i)}
  map.forEach(a=>{if(a[3].length<2)return;const l=Math.hypot(a[0],a[1],a[2])||1;a[3].forEach(i=>nm.setXYZ(i,a[0]/l,a[1]/l,a[2]/l))});nm.needsUpdate=true}
function buildHemi(s){
  const geo=new THREE.SphereGeometry(1,240,170);
  const pos=geo.attributes.position,n=pos.count;
  const rid=new Array(n),ao=new Float32Array(n);
  const ctr=V(s*0.22,HY-0.02,0),tmp=V(0,0,0);
  for(let i=0;i<n;i++){
    const lat=pos.getX(i),dy=pos.getY(i),dz=pos.getZ(i);
    const b=hemiBase(lat,dy,dz,s);
    const px=b[0],py=b[1],pz=b[2];
    // gyri: grooves along noise zero-crossings
    const w=noise(px*1.6+5,py*1.6,pz*1.6)*0.7;
    const f=4.4;
    const n1=noise(px*f+w+(s>0?17:0),py*f*1.1,pz*f+w);
    const n2=noise(px*f*2.2+11,py*f*2.2+w,pz*f*2.2);
    let g=1-sm(0,0.12,Math.abs(n1));
    g=Math.max(g,0.5*(1-sm(0,0.07,Math.abs(n2))));
    const c=dz+0.35*dy;
    const cs=Math.exp(-Math.pow((c-0.05-0.025*Math.sin(dy*10))/0.022,2))*sm(-0.12,0.05,dy)*sm(-0.7,-0.3,lat);
    const yl=sylY(dz);
    const syl=Math.exp(-Math.pow((dy-yl)/0.045,2))*sm(0.25,0.55,lat)*sm(-0.5,-0.3,dz)*(1-sm(0.45,0.6,dz));
    const occ=Math.exp(-Math.pow((dz+0.12*dy+0.68)/0.03,2))*sm(-0.4,0.1,lat)*0.7;
    const depth=0.028*g+0.055*cs+0.075*syl+0.03*occ;
    tmp.set(px,py,pz).sub(ctr).normalize();
    pos.setXYZ(i,px-tmp.x*depth,py-tmp.y*depth,pz-tmp.z*depth);
    ao[i]=Math.min(1,g*0.8+cs+syl*1.2+occ);
    rid[i]=classify(lat,dy,dz,s);
  }
  if(s<0){const idx=geo.index.array;for(let k=0;k<idx.length;k+=3){const t=idx[k+1];idx[k+1]=idx[k+2];idx[k+2]=t}}
  geo.computeVertexNormals();smoothSeams(geo);
  geo.setAttribute('color',new THREE.BufferAttribute(new Float32Array(n*3),3));
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.66,metalness:0,transparent:false,opacity:1});
  const mesh=new THREE.Mesh(geo,mat);
  mesh.userData={cortex:true,side:s,rid,ao};
  mesh.renderOrder=10;
  scene.add(mesh);pickables.push(mesh);
  // centroids per region
  const sums={};
  for(let i=0;i<n;i++){const r=rid[i];const o=sums[r]||(sums[r]={x:0,y:0,z:0,k:0});o.x+=pos.getX(i);o.y+=pos.getY(i);o.z+=pos.getZ(i);o.k++}
  mesh.userData.cent={};for(const r in sums){const o=sums[r];mesh.userData.cent[r]=V(o.x/o.k,o.y/o.k,o.z/o.k)}
  hemis.push(mesh);return mesh;
}
buildHemi(-1);buildHemi(1);

/* ---------- deep structures ---------- */
const deepMeshes=[];
function mat(color,opts={}){return new THREE.MeshStandardMaterial(Object.assign({color,roughness:.5,metalness:0,emissive:new THREE.Color(color),emissiveIntensity:.08},opts))}
function ellip(id,c,r,color,rot){const m=new THREE.Mesh(new THREE.SphereGeometry(1,40,28),mat(color));m.position.copy(c);m.scale.set(r[0],r[1],r[2]);if(rot)m.rotation.set(rot[0],rot[1],rot[2]);scene.add(m);deepMeshes.push(m);return reg(id,m)}
function tube(id,pts,rad,color,seg=60){const curve=new THREE.CatmullRomCurve3(pts);const g=new THREE.TubeGeometry(curve,seg,rad,16,false);const m=new THREE.Mesh(g,mat(color));scene.add(m);deepMeshes.push(m);return reg(id,m)}
function capTube(id,pts,rad,color){const m=tube(id,pts,rad,color);[pts[0],pts[pts.length-1]].forEach(p=>{const e=new THREE.Mesh(new THREE.SphereGeometry(rad,16,12),m.material);e.position.copy(p);scene.add(e);deepMeshes.push(e);reg(id,e)});return m}
const C=id=>REGIONS[id].color;
for(const s of [-1,1]){
  ellip('thalamus',V(s*0.095,0.05,-0.1),[0.075,0.075,0.15],C('thalamus'));
  capTube('hippocampus',[V(s*0.25,-0.17,0.14),V(s*0.29,-0.15,0.02),V(s*0.29,-0.1,-0.14),V(s*0.24,-0.02,-0.29),V(s*0.16,0.06,-0.35)],0.042,C('hippocampus'));
  ellip('amygdala',V(s*0.25,-0.15,0.22),[0.055,0.05,0.06],C('amygdala'));
  ellip('caudate',V(s*0.14,0.11,0.3),[0.06,0.08,0.1],C('caudate'));
  capTube('caudate',[V(s*0.14,0.13,0.3),V(s*0.16,0.21,0.13),V(s*0.18,0.22,-0.08),V(s*0.23,0.14,-0.26),V(s*0.28,0.0,-0.3),V(s*0.3,-0.12,-0.2)],0.034,C('caudate'));
  ellip('putamen',V(s*0.27,0.02,0.1),[0.05,0.11,0.17],C('putamen'));
  ellip('globus',V(s*0.205,0.0,0.06),[0.035,0.07,0.1],C('globus'));
  ellip('nacc',V(s*0.1,-0.07,0.31),[0.05,0.045,0.06],C('nacc'));
  ellip('insula',V(s*0.38,0.03,0.1),[0.022,0.12,0.18],C('insula'));
  ellip('basalforebrain',V(s*0.13,-0.13,0.2),[0.055,0.03,0.06],C('basalforebrain'));
  ellip('sn',V(s*0.075,-0.19,-0.2),[0.055,0.02,0.04],C('sn'),[0,s*0.5,0]);
  ellip('lc',V(s*0.045,-0.33,-0.36),[0.022,0.035,0.022],C('lc'));
  ellip('olfactory',V(s*0.065,-0.06,0.6),[0.026,0.022,0.1],C('olfactory'));
  tube('olfactory',[V(s*0.065,-0.06,0.52),V(s*0.08,-0.08,0.44),V(s*0.1,-0.1,0.36)],0.011,C('olfactory'),20);
}
ellip('hypothalamus',V(0,-0.12,0.08),[0.07,0.06,0.09],C('hypothalamus'));
ellip('pituitary',V(0,-0.32,0.12),[0.05,0.04,0.045],C('pituitary'));
tube('pituitary',[V(0,-0.17,0.1),V(0,-0.24,0.11),V(0,-0.3,0.12)],0.012,C('pituitary'),12);
ellip('pineal',V(0,0.03,-0.28),[0.025,0.025,0.04],C('pineal'));
ellip('vta',V(0,-0.2,-0.17),[0.04,0.025,0.035],C('vta'));
for(let k=0;k<6;k++){const y=-0.15-k*0.1;ellip('raphe',V(0,y,-0.2+y*0.22-0.035),[0.016,0.04,0.02],C('raphe'))}
// corpus callosum
{const m=tube('corpus',[V(0,0.07,0.43),V(0,0.21,0.46),V(0,0.3,0.27),V(0,0.325,0),V(0,0.31,-0.26),V(0,0.24,-0.42),V(0,0.13,-0.41)],0.035,C('corpus'),80);m.scale.x=4.5}

/* ---------- brainstem, cerebellum, cord ---------- */
const stem=new THREE.Group();stem.position.set(0,0,-0.2);stem.rotation.x=0.22;scene.add(stem);
const outerMeshes=[];
function lathe(id,prof,color,zs=1,zo=0){
  const g=new THREE.LatheGeometry(prof.map(p=>new THREE.Vector2(p[0],p[1])),48);
  const m=new THREE.Mesh(g,mat(color,{roughness:.7,emissiveIntensity:.04}));m.scale.z=zs;m.position.z=zo;stem.add(m);outerMeshes.push(m);return reg(id,m)}
lathe('midbrain',[[0.0,-0.02],[0.1,-0.02],[0.115,-0.08],[0.12,-0.16],[0.122,-0.24],[0.0,-0.24]],C('midbrain'));
lathe('pons',[[0.0,-0.24],[0.122,-0.24],[0.15,-0.3],[0.158,-0.38],[0.145,-0.47],[0.115,-0.52],[0.0,-0.52]],C('pons'),1.12,0.02);
lathe('medulla',[[0.0,-0.52],[0.115,-0.52],[0.105,-0.6],[0.09,-0.72],[0.072,-0.82],[0.0,-0.82]],C('medulla'));
lathe('spinal',[[0.0,-0.82],[0.072,-0.82],[0.06,-0.95],[0.055,-1.15],[0.052,-1.35],[0.0,-1.35]],C('spinal'));
{
  const g=new THREE.SphereGeometry(1,160,110);const p=g.attributes.position;
  for(let i=0;i<p.count;i++){
    const dx=p.getX(i),dy=p.getY(i),dz=p.getZ(i);
    let x=dx*0.46,y=dy*0.23,z=dz*0.3;
    const vermis=Math.exp(-Math.pow(dx/0.12,2))*sm(-0.2,0.6,dy)*0.04;y-=vermis;z+=Math.exp(-Math.pow(dx/0.12,2))*0.01;
    if(dz>0.2) z-=0.06*sm(0.2,1,dz)*sm(-0.5,0.4,dy);
    const ang=Math.atan2(y,-z);
    const fol=Math.pow(Math.abs(Math.sin(ang*26+noise(x*6,y*6,z*6)*1.2)),0.6);
    const r=Math.hypot(x,y,z);const d=0.012*(1-fol);
    p.setXYZ(i,x-x/r*d,y-y/r*d,z-z/r*d);
  }
  g.computeVertexNormals();smoothSeams(g);
  const m=new THREE.Mesh(g,mat(C('cerebellum'),{roughness:.75,emissiveIntensity:.03}));
  m.position.set(0,-0.33,-0.58);scene.add(m);outerMeshes.push(m);reg('cerebellum',m);
}

/* ---------- anchors for labels ---------- */
const tmpBox=new THREE.Box3(),tmpV=V(0,0,0);
function anchorsOf(id){
  if(hemis[0].userData.cent[id]) return hemis.filter(h=>h.visible).map(h=>h.userData.cent[id]).filter(Boolean);
  const ms=regionMeshes[id]||[];const out=[];
  // group meshes by side
  const sides={};
  ms.forEach(m=>{m.updateWorldMatrix(true,false);tmpBox.setFromObject(m);const c=tmpBox.getCenter(V(0,0,0));const k=c.x<-0.02?'L':c.x>0.02?'R':'M';(sides[k]=sides[k]||[]).push(c)});
  for(const k in sides){const a=V(0,0,0);sides[k].forEach(c=>a.add(c));a.divideScalar(sides[k].length);out.push(a)}
  return out;
}
const ANCH={};
function refreshAnchors(){for(const id in REGIONS)ANCH[id]=anchorsOf(id)}

/* =====================================================================
   CHEMICAL PATHWAYS
   ===================================================================== */
function cp(s,dz,dy,lat,inset=0.86){const L=Math.hypot(dz,dy,lat);const b=hemiBase(lat/L,dy/L,dz/L,s);const c=V(s*0.22,HY-0.02,0);return c.lerp(V(b[0],b[1],b[2]),inset)}
const T={ // targets per side
  pfc:s=>cp(s,0.95,0.12,0.42), dfr:s=>cp(s,0.55,0.78,0.35), mot:s=>cp(s,-0.2,0.92,0.4), par:s=>cp(s,-0.55,0.72,0.45),
  occ:s=>cp(s,-0.97,0.12,0.35), tem:s=>cp(s,0.1,-0.55,0.85), ofc:s=>cp(s,0.8,-0.45,0.4),
  hip:s=>V(s*0.28,-0.12,-0.06), amy:s=>V(s*0.25,-0.15,0.22), str:s=>V(s*0.27,0.02,0.1), cau:s=>V(s*0.14,0.12,0.3),
  tha:s=>V(s*0.095,0.05,-0.1), nac:s=>V(s*0.1,-0.07,0.31), cer:s=>V(s*0.26,-0.33,-0.64), cng:s=>V(s*0.05,0.27,0.3),
};
function cortexFan(src,hub,s,set=['pfc','dfr','mot','par','occ','tem']){
  const r=[];
  if(set.includes('pfc'))r.push([src,hub,V(s*0.15,0.04,0.42),T.pfc(s)]);
  if(set.includes('dfr'))r.push([src,hub,V(s*0.17,0.2,0.3),T.dfr(s)]);
  if(set.includes('mot'))r.push([src,hub,V(s*0.16,0.24,0.24),V(s*0.2,0.4,0.0),T.mot(s)]);
  if(set.includes('par'))r.push([src,hub,V(s*0.13,0.22,0.3),V(s*0.16,0.38,-0.12),T.par(s)]);
  if(set.includes('occ'))r.push([src,hub,V(s*0.12,0.2,0.32),V(s*0.15,0.36,-0.1),V(s*0.2,0.24,-0.52),T.occ(s)]);
  if(set.includes('tem'))r.push([src,V(s*0.14,-0.15,-0.04),V(s*0.35,-0.12,0.04),T.tem(s)]);
  return r;
}
const PATHS={
  serotonin:()=>{const DR=V(0,-0.17,-0.27),CR=V(0,-0.62,-0.37),r=[];
    for(const s of[-1,1]){const hub=V(s*0.08,-0.09,0.06);
      r.push(...cortexFan(DR,hub,s));
      r.push([DR,V(s*0.1,-0.2,-0.12),T.hip(s)],[DR,V(s*0.1,-0.14,0.06),T.amy(s)],[DR,V(s*0.1,-0.08,0.0),T.str(s)],[DR,V(s*0.06,0.0,-0.14),T.tha(s)],[CR,V(s*0.1,-0.36,-0.5),T.cer(s)])}
    r.push([DR,V(0,-0.14,0.0),V(0,-0.12,0.08)],[CR,V(0,-0.9,-0.41),V(0,-1.32,-0.49)]);return r},
  dopamine:()=>{const VTA=V(0,-0.2,-0.17),r=[];
    for(const s of[-1,1]){const SN=V(s*0.075,-0.19,-0.2);
      r.push([SN,V(s*0.15,-0.08,-0.02),T.str(s)],[SN,V(s*0.14,0.02,0.05),V(s*0.15,0.1,0.22),T.cau(s)]);
      r.push([VTA,V(s*0.05,-0.13,0.08),T.nac(s)],[VTA,V(s*0.12,-0.18,0.08),T.amy(s)],[VTA,V(s*0.12,-0.2,-0.1),T.hip(s)]);
      r.push([VTA,V(s*0.06,-0.1,0.14),V(s*0.12,0.04,0.44),T.pfc(s)],[VTA,V(s*0.06,-0.1,0.14),V(s*0.14,0.0,0.5),T.ofc(s)],[VTA,V(s*0.05,-0.08,0.16),V(s*0.05,0.15,0.4),T.cng(s)])}
    r.push([V(0,-0.12,0.08),V(0,-0.2,0.1),V(0,-0.32,0.12)]);return r},
  norepinephrine:()=>{const r=[];
    for(const s of[-1,1]){const LC=V(s*0.045,-0.33,-0.36),hub=V(s*0.07,-0.12,-0.06);
      r.push(...cortexFan(LC,hub,s));
      r.push([LC,V(s*0.06,-0.1,-0.12),T.tha(s)],[LC,V(s*0.12,-0.22,-0.16),T.hip(s)],[LC,V(s*0.1,-0.18,0.05),T.amy(s)],[LC,V(s*0.14,-0.36,-0.5),T.cer(s)],[LC,V(s*0.02,-0.7,-0.4),V(0,-1.32,-0.49)]);}
    return r},
  acetylcholine:()=>{const r=[];
    for(const s of[-1,1]){const NB=V(s*0.13,-0.13,0.2),SEP=V(s*0.03,0.02,0.3),PPT=V(s*0.07,-0.27,-0.33);
      r.push(...cortexFan(NB,V(s*0.13,-0.05,0.22),s));
      r.push([SEP,V(s*0.04,0.16,0.12),V(s*0.1,0.19,-0.22),V(s*0.24,0.0,-0.32),T.hip(s)],[NB,V(s*0.2,-0.2,0.22),T.amy(s)],[PPT,V(s*0.08,-0.12,-0.16),T.tha(s)])}
    return r},
  oxytocin:()=>{const r=[];
    for(const s of[-1,1]){const PVN=V(s*0.03,-0.08,0.06);
      r.push([PVN,V(0,-0.2,0.1),V(0,-0.32,0.12)],[PVN,V(s*0.15,-0.18,0.16),T.amy(s)],[PVN,V(s*0.06,-0.06,0.22),T.nac(s)],[PVN,V(s*0.15,-0.14,-0.04),T.hip(s)],[PVN,V(s*0.04,0.1,0.3),T.cng(s)])}
    r.push([V(0,-0.32,0.12),V(0,-0.6,0.16),V(0,-1.32,0.12)]);return r},
  cortisol:()=>{const r=[];const H=V(0,-0.1,0.08),P=V(0,-0.32,0.12);
    r.push([H,V(0,-0.2,0.1),P],[P,V(0,-0.6,0.18),V(0,-1.32,0.15)]);
    for(const s of[-1,1]){const A=V(s*0.42,-1.32,0.02);
      r.push([A,V(s*0.42,-0.6,-0.02),V(s*0.32,-0.3,-0.06),T.hip(s)],[A,V(s*0.36,-0.6,0.18),T.amy(s)],[A,V(s*0.3,-0.6,0.3),V(s*0.22,-0.15,0.42),T.pfc(s)],[A,V(s*0.2,-0.6,0.12),V(s*0.05,-0.2,0.1),H])}
    return r},
  melatonin:()=>{const PIN=V(0,0.03,-0.28),r=[];
    r.push([PIN,V(0,-0.04,-0.1),V(0,-0.13,0.13)],[PIN,V(0,-0.1,-0.05),V(0,-0.22,0.1),V(0,-0.32,0.12)]);
    for(const s of[-1,1])r.push([PIN,V(s*0.12,-0.25,-0.05),V(s*0.2,-0.7,0.05),V(s*0.25,-1.32,0.05)],[PIN,V(s*0.08,0.15,-0.2),V(s*0.2,0.3,-0.05)]);
    return r}
};

// glow sprite texture
const glowTex=(()=>{const cv=document.createElement('canvas');cv.width=cv.height=64;const g=cv.getContext('2d');const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.25,'rgba(255,255,255,.7)');gr.addColorStop(.6,'rgba(255,255,255,.15)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(cv)})();

const flows={};
function buildFlow(id){
  const ch=CHEMS[id],col=new THREE.Color(ch.color);
  const group=new THREE.Group();group.visible=false;scene.add(group);
  const paths=PATHS[id]();const curves=paths.map(p=>new THREE.CatmullRomCurve3(p,false,'centripetal'));
  const samples=curves.map(c=>c.getSpacedPoints(120));
  // faint path lines
  const lineMat=new THREE.LineBasicMaterial({color:col,transparent:true,opacity:.28,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending});
  samples.forEach(sp=>{const g=new THREE.BufferGeometry().setFromPoints(sp);const l=new THREE.Line(g,lineMat);l.renderOrder=20;group.add(l)});
  // particles
  const per=24,N=curves.length*per;
  const pos=new Float32Array(N*3),colr=new Float32Array(N*3);const meta=[];
  for(let c=0;c<curves.length;c++)for(let k=0;k<per;k++){meta.push({c,o:Math.random(),sp:0.12+Math.random()*0.1,j:V((Math.random()-.5),(Math.random()-.5),(Math.random()-.5)).multiplyScalar(0.022)})}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('color',new THREE.BufferAttribute(colr,3));
  const pm=new THREE.PointsMaterial({size:0.075,map:glowTex,vertexColors:true,transparent:true,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending,sizeAttenuation:true});
  const pts=new THREE.Points(g,pm);pts.renderOrder=30;pts.frustumCulled=false;group.add(pts);
  // source glows
  const srcs=[];const seen=new Set();
  paths.forEach(p=>{const k=p[0].toArray().map(v=>v.toFixed(2)).join();if(seen.has(k))return;seen.add(k);
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:col,transparent:true,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending}));sp.position.copy(p[0]);sp.renderOrder=31;group.add(sp);srcs.push(sp)});
  flows[id]={group,samples,meta,pos,colr,g,col,srcs,on:false};
}
Object.keys(CHEMS).forEach(buildFlow);

function updateFlows(t){
  for(const id in flows){const f=flows[id];if(!f.on)continue;
    const {samples,meta,pos,colr,col}=f;
    for(let i=0;i<meta.length;i++){const m=meta[i];const u=(m.o+t*m.sp)%1;const s=samples[m.c];const fi=u*(s.length-1),i0=Math.floor(fi),fr=fi-i0;const a=s[i0],b=s[Math.min(i0+1,s.length-1)];
      const env=Math.sin(Math.PI*u);
      pos[i*3]=a.x+(b.x-a.x)*fr+m.j.x*env;pos[i*3+1]=a.y+(b.y-a.y)*fr+m.j.y*env;pos[i*3+2]=a.z+(b.z-a.z)*fr+m.j.z*env;
      const br=Math.min(1,0.25+env*1.1);colr[i*3]=col.r*br;colr[i*3+1]=col.g*br;colr[i*3+2]=col.b*br}
    f.g.attributes.position.needsUpdate=true;f.g.attributes.color.needsUpdate=true;
    f.srcs.forEach((sp,k)=>{const sc=0.13+0.04*Math.sin(t*3+k);sp.scale.set(sc,sc,sc)})}
}

/* =====================================================================
   STATE / PAINT
   ===================================================================== */
const state={sel:null,selChem:null,hover:null,atlas:true,labels:true,opacity:1,spin:false};
const TISSUE=new THREE.Color('#d9b6a9');
const outerIds=new Set(['midbrain','pons','medulla','spinal','cerebellum']);
const regCol={};for(const id in REGIONS)regCol[id]=new THREE.Color(REGIONS[id].color);
const WHITE=new THREE.Color(1,1,1),tc=new THREE.Color();
function paintCortex(){
  const anySel=state.sel&&REGIONS[state.sel].group==='cortex'&&hemis[0].userData.cent[state.sel];
  for(const h of hemis){const {rid,ao}=h.userData;const arr=h.geometry.attributes.color.array;
    for(let i=0;i<rid.length;i++){const r=rid[i];
      if(state.atlas) tc.copy(TISSUE).lerp(regCol[r],0.78); else tc.copy(TISSUE);
      if(anySel){ if(r===state.sel) tc.copy(regCol[r]).lerp(WHITE,0.12); else tc.multiplyScalar(0.55);}
      if(r===state.hover && r!==state.sel) tc.lerp(WHITE,0.3);
      const shade=0.58+0.42*(1-ao[i]);
      arr[i*3]=tc.r*shade;arr[i*3+1]=tc.g*shade;arr[i*3+2]=tc.b*shade}
    h.geometry.attributes.color.needsUpdate=true}
}
function paintDeep(){
  const deepSel=state.sel&&!hemis[0].userData.cent[state.sel]&&!outerIds.has(state.sel);
  const chemSrc=new Set();for(const id in flows)if(flows[id].on)CHEMS[id].src.forEach(s=>chemSrc.add(s));
  const anyFlow=Object.values(flows).some(f=>f.on);
  for(const id in regionMeshes){if(hemis[0].userData.cent[id])continue;
    const dim=!outerIds.has(id)&&id!==state.sel&&id!==state.hover&&(deepSel||(anyFlow&&!chemSrc.has(id)));
    regionMeshes[id].forEach(m=>{let e=0.08;if(id===state.hover)e=0.35;if(id===state.sel)e=0.7;if(chemSrc.has(id))e=Math.max(e,0.5);m.material.emissiveIntensity=e;
      if(!outerIds.has(id)){const tr=dim;if(m.material.transparent!==tr){m.material.transparent=tr;m.material.needsUpdate=true}m.material.opacity=dim?(deepSel?0.22:0.4):1;m.material.depthWrite=!dim}})}
}
function applyOpacity(){
  const o=state.opacity;
  hemis.forEach(h=>{const m=h.material;const tr=o<0.995;if(m.transparent!==tr){m.transparent=tr;m.needsUpdate=true}m.opacity=o;m.depthWrite=!tr});
  const so=o<0.6?0.38:1;
  outerMeshes.forEach(m=>{const mt=m.material;const tr=so<1;if(mt.transparent!==tr){mt.transparent=tr;mt.needsUpdate=true}mt.opacity=so;mt.depthWrite=!tr});
  document.getElementById('op').value=Math.round(o*100);
  document.getElementById('bXray').classList.toggle('on',o<0.6);
}

/* =====================================================================
   UI: list
   ===================================================================== */
const listScroll=document.getElementById('listScroll');
function buildList(filter=''){
  const f=filter.trim().toLowerCase();let html='';
  for(const g in GROUPS){const ids=Object.keys(REGIONS).filter(id=>REGIONS[id].group===g&&(!f||REGIONS[id].name.toLowerCase().includes(f)||(REGIONS[id].alias||'').toLowerCase().includes(f)));
    if(!ids.length)continue;html+=`<div class="grp"><h4>${GROUPS[g]}</h4>`;
    ids.forEach(id=>html+=`<button class="item${state.sel===id?' on':''}" data-id="${id}"><i style="background:${REGIONS[id].color}"></i>${REGIONS[id].name}</button>`);html+='</div>'}
  listScroll.innerHTML=html||'<p style="color:var(--dim);padding:12px">No matches</p>';
}
listScroll.addEventListener('click',e=>{const b=e.target.closest('.item');if(b){select(b.dataset.id,true);if(innerWidth<820)document.getElementById('list').classList.remove('open')}});
document.getElementById('q').addEventListener('input',e=>buildList(e.target.value));
document.getElementById('listToggle').onclick=()=>document.getElementById('list').classList.toggle('open');

/* chem chips in dock */
const chemRow=document.getElementById('chemRow');
for(const id in CHEMS){const c=CHEMS[id];const b=document.createElement('button');b.className='chip';b.dataset.chem=id;b.style.setProperty('--c',c.color);b.innerHTML=`<i style="background:${c.color}"></i>${c.name}`;b.onclick=()=>toggleChem(id,true);chemRow.appendChild(b)}
function syncChips(){document.querySelectorAll('.chip[data-chem]').forEach(b=>b.classList.toggle('on',flows[b.dataset.chem].on))}

/* =====================================================================
   INFO PANEL
   ===================================================================== */
const info=document.getElementById('info');
function chipHTML(id){const c=CHEMS[id];return `<button class="chip${flows[id].on?' on':''}" data-chem="${id}" style="--c:${c.color}"><i style="background:${c.color}"></i>${c.name}</button>`}
function regChip(id){const r=REGIONS[id];return `<button class="chip linkchip" data-reg="${id}" style="--c:${r.color}"><i style="background:${r.color}"></i>${r.name}</button>`}
function openInfo(html,acc){info.innerHTML=html;info.style.setProperty('--acc',acc);info.classList.add('open');info.scrollTop=0;document.body.classList.add('infoOpen')}
function closeInfo(){info.classList.remove('open');document.body.classList.remove('infoOpen')}
function showRegion(id){const r=REGIONS[id];
  openInfo(`<div class="ph"><span class="tag"><i style="background:${r.color}"></i>${GROUPS[r.group]}</span><button class="x" data-close>×</button></div>
  <h2>${r.name}</h2>${r.alias?`<div class="alias">${r.alias}</div>`:''}
  <p class="sum">${r.summary}</p>
  <h3>Key functions</h3><ul>${r.functions.map(f=>`<li>${f}</li>`).join('')}</ul>
  ${r.chem.length?`<h3>Chemistry involved</h3><div class="chips">${r.chem.map(chipHTML).join('')}</div><p class="hintsm">Tap a chemical to watch it flow through the brain.</p>`:''}
  ${r.clinical?`<h3>When it goes wrong</h3><p>${r.clinical}</p>`:''}
  ${r.fact?`<div class="fact"><b>Did you know?</b>${r.fact}</div>`:''}`,r.color)}
function showChem(id){const c=CHEMS[id];
  openInfo(`<div class="ph"><span class="tag"><i style="background:${c.color}"></i>${c.type}</span><button class="x" data-close>×</button></div>
  <h2 style="color:${c.color}">${c.name}</h2><div class="alias">${c.abbr}</div>
  <p class="sum">${c.summary}</p>
  <h3>Origin</h3><dl class="kv"><dt>Made from</dt><dd>${c.made}</dd></dl>
  <div class="chips" style="margin-top:10px">${c.src.map(regChip).join('')}</div>
  <h3>${id==='dopamine'?'Pathways':'What it does'}</h3><ul>${c.roles.map(f=>`<li>${f}</li>`).join('')}</ul>
  <h3>Main destinations</h3><div class="chips">${c.reach.map(regChip).join('')}</div>
  <h3>Drugs that act on it</h3><p>${c.drugs}</p>
  <h3>Too much / too little</h3><p>${c.imbalance}</p>
  <div class="fact"><b>Did you know?</b>${c.fact}</div>
  <div style="margin-top:16px"><button class="chip${flows[id].on?' on':''}" data-chem="${id}" style="--c:${c.color}"><i style="background:${c.color}"></i>${flows[id].on?'Hide flow':'Show flow'}</button></div>`,c.color)}
info.addEventListener('click',e=>{
  if(e.target.closest('[data-close]')){closeInfo();state.sel=null;state.selChem=null;paintCortex();paintDeep();buildList(document.getElementById('q').value);return}
  const ch=e.target.closest('[data-chem]');if(ch){toggleChem(ch.dataset.chem,false);return}
  const rg=e.target.closest('[data-reg]');if(rg)select(rg.dataset.reg,true);
});

/* =====================================================================
   ACTIONS
   ===================================================================== */
let flyTo=null;
function select(id,fly){
  state.sel=id;state.selChem=null;paintCortex();paintDeep();showRegion(id);buildList(document.getElementById('q').value);
  const r=REGIONS[id];const isCortex=!!hemis[0].userData.cent[id];
  if((r.deep||!isCortex&&r.group!=='hind'&&!['midbrain','pons','medulla','pituitary','olfactory'].includes(id))&&state.opacity>0.6){state.opacity=0.16;applyOpacity()}
  if(id==='cingulate'&&hemis.every(h=>h.visible)&&state.opacity>0.6){setHemi(1,false)}
  if(fly)focusOn(id);
  hideHint();
}
function focusOn(id){
  refreshAnchors();const an=ANCH[id];if(!an||!an.length)return;
  // choose anchor nearest current camera
  let best=an[0];an.forEach(a=>{if(a.distanceTo(camera.position)<best.distanceTo(camera.position))best=a});
  const isCortex=!!hemis[0].userData.cent[id];
  let dir=camera.position.clone().sub(controls.target).normalize();
  if(isCortex){const s=best.x<0?-1:1;const out=best.clone().sub(V(s*0.15,0.05,0)).normalize();if(id==='cingulate')out.set(-s,0.25,0.1).normalize();dir.lerp(out,0.75).normalize()}
  const dist=isCortex?2.3:1.75;
  const tgt=best.clone().lerp(V(0,-0.05,0),isCortex?0.45:0.3);
  flyTo={t:tgt,p:tgt.clone().add(dir.multiplyScalar(dist))};
}
function toggleChem(id,openPanel){
  const f=flows[id];f.on=!f.on;f.group.visible=f.on;
  if(f.on&&state.opacity>0.6){state.opacity=0.16;applyOpacity()}
  syncChips();paintDeep();
  if(f.on&&openPanel!==false){state.selChem=id;showChem(id)}
  else if(info.classList.contains('open')){ if(state.selChem===id)showChem(id); else if(state.sel)showRegion(state.sel)}
  hideHint();
}
function setHemi(s,vis){const h=hemis.find(h=>h.userData.side===s);h.visible=vis;document.getElementById(s<0?'bL':'bR').classList.toggle('on',vis);refreshAnchors()}

/* buttons */
const $=id=>document.getElementById(id);
$('bLabels').onclick=e=>{state.labels=!state.labels;e.currentTarget.classList.toggle('on',state.labels)};
$('bAtlas').onclick=e=>{state.atlas=!state.atlas;e.currentTarget.classList.toggle('on',state.atlas);paintCortex()};
$('op').oninput=e=>{state.opacity=e.target.value/100;applyOpacity()};
$('bXray').onclick=()=>{state.opacity=state.opacity<0.6?1:0.16;applyOpacity()};
$('bL').onclick=()=>{const h=hemis.find(h=>h.userData.side<0);if(!h.visible||hemis.find(h=>h.userData.side>0).visible)setHemi(-1,!h.visible)};
$('bR').onclick=()=>{const h=hemis.find(h=>h.userData.side>0);if(!h.visible||hemis.find(h=>h.userData.side<0).visible)setHemi(1,!h.visible)};
$('bSpin').onclick=e=>{state.spin=!state.spin;controls.autoRotate=state.spin;e.currentTarget.classList.toggle('on',state.spin)};
$('bReset').onclick=()=>{flyTo={t:HOME_TGT.clone(),p:HOME_POS.clone()};state.opacity=1;applyOpacity();setHemi(-1,true);setHemi(1,true);
  for(const id in flows){flows[id].on=false;flows[id].group.visible=false}syncChips();state.sel=null;state.selChem=null;closeInfo();paintCortex();paintDeep();buildList($('q').value)};
controls.autoRotateSpeed=0.8;
controls.addEventListener('start',()=>{flyTo=null});

/* =====================================================================
   PICKING
   ===================================================================== */
const ray=new THREE.Raycaster(),mouse=new THREE.Vector2(),tip=$('tip');
function pick(cx,cy){
  const rect=canvas.getBoundingClientRect();mouse.set((cx-rect.left)/rect.width*2-1,-(cy-rect.top)/rect.height*2+1);
  ray.setFromCamera(mouse,camera);
  const objs=pickables.filter(o=>{if(!o.visible)return false;if(o.userData.cortex&&state.opacity<0.5)return false;if(o.parent===stem&&false)return false;return true});
  const hits=ray.intersectObjects(objs,false);
  for(const h of hits){
    const o=h.object;
    if(o.userData.cortex){return o.userData.rid[h.face.a]}
    // when stem translucent, prefer tiny nuclei behind it
    if(outerMeshes.includes(o)&&state.opacity<0.6){const deeper=hits.find(k=>!outerMeshes.includes(k.object)&&!k.object.userData.cortex);if(deeper)return deeper.object.userData.id}
    return o.userData.id;
  }
  return null;
}
let down=null;
canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY}});
canvas.addEventListener('pointermove',e=>{
  if(e.pointerType==='touch')return;
  const id=pick(e.clientX,e.clientY);
  if(id!==state.hover){state.hover=id;paintCortex();paintDeep()}
  canvas.classList.toggle('hovering',!!id);
  if(id){tip.innerHTML=REGIONS[id].name+'<small>click for details</small>';tip.style.opacity=1;tip.style.left=(e.clientX+14)+'px';tip.style.top=(e.clientY+14)+'px'}else tip.style.opacity=0;
});
canvas.addEventListener('pointerleave',()=>{tip.style.opacity=0;if(state.hover){state.hover=null;paintCortex();paintDeep()}});
canvas.addEventListener('pointerup',e=>{
  if(!down)return;const moved=Math.hypot(e.clientX-down.x,e.clientY-down.y);down=null;if(moved>6)return;
  const id=pick(e.clientX,e.clientY);
  if(id)select(id,false);
  else if(info.classList.contains('open')){closeInfo();state.sel=null;state.selChem=null;paintCortex();paintDeep();buildList($('q').value)}
});

/* =====================================================================
   LABELS
   ===================================================================== */
const labelsEl=$('labels');const labelDivs={};
for(const id in REGIONS){const d=document.createElement('div');d.className='lab';d.style.setProperty('--c',REGIONS[id].color);d.textContent=REGIONS[id].name.replace(' & supplementary motor areas',' areas');d.onclick=()=>select(id,true);labelsEl.appendChild(d);labelDivs[id]=d}
const SURFACE_DEEP=new Set(['cerebellum','midbrain','pons','medulla','spinal','pituitary','olfactory']);
const pv=V(0,0,0),camDir=V(0,0,0);
function focusSet(){const fs=new Set();let any=false;for(const id in flows)if(flows[id].on){any=true;CHEMS[id].src.forEach(x=>fs.add(x));CHEMS[id].reach.forEach(x=>fs.add(x))}
  if(state.sel&&!hemis[0].userData.cent[state.sel]&&!outerIds.has(state.sel)){any=true;fs.add(state.sel)}return any?fs:null}
function updateLabels(){
  const W=canvas.clientWidth,H=canvas.clientHeight;const fs=focusSet();
  for(const id in REGIONS){const d=labelDivs[id];
    let show=state.labels||id===state.sel;
    const isCortex=!!hemis[0].userData.cent[id];
    if(show){
      if(isCortex) show=state.opacity>0.35&&!REGIONS[id].deep;
      else if(!SURFACE_DEEP.has(id)) show=state.opacity<0.6;
    }
    const an=ANCH[id];if(!show||!an||!an.length){d.style.opacity=0;d.style.visibility='hidden';continue}
    // nearest anchor to camera
    let best=null,bd=1e9;for(const a of an){const dd=a.distanceTo(camera.position);if(dd<bd){bd=dd;best=a}}
    if(isCortex){const s=best.x<0?-1:1;const out=best.clone().sub(V(s*0.15,0.05,0)).normalize();if(id==='cingulate')out.set(-s,0,0);camDir.copy(camera.position).sub(best).normalize();if(out.dot(camDir)<0.12){d.style.opacity=0;d.style.visibility='hidden';continue}}
    pv.copy(best).project(camera);if(pv.z>1){d.style.visibility='hidden';continue}
    d.style.visibility='visible';d.style.opacity=id===state.sel?1:(fs&&!isCortex&&!fs.has(id))?0.18:0.92;d.classList.toggle('sel',id===state.sel);
    d.style.transform=`translate(-50%,-50%) translate(${(pv.x*.5+.5)*W}px,${(-pv.y*.5+.5)*H}px)`;
  }
}

/* =====================================================================
   LOOP
   ===================================================================== */
let viewOff=0;
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;
  camera.fov=w<820?48:36;applyView()}
function applyView(){const w=innerWidth,h=innerHeight;if(Math.abs(viewOff)<0.5)camera.clearViewOffset();else camera.setViewOffset(w,h,viewOff,0,w,h);camera.updateProjectionMatrix()}
addEventListener('resize',resize);resize();
let hintHidden=false;function hideHint(){if(hintHidden)return;hintHidden=true;$('hint').style.opacity=0}
setTimeout(hideHint,9000);

paintCortex();paintDeep();applyOpacity();refreshAnchors();buildList();
if(innerWidth<820){camera.position.multiplyScalar(1.25)}
const clock=new THREE.Clock();
function loop(){
  const t=clock.getElapsedTime();
  if(flyTo){controls.target.lerp(flyTo.t,0.08);camera.position.lerp(flyTo.p,0.08);if(camera.position.distanceTo(flyTo.p)<0.01)flyTo=null}
  const wantOff=innerWidth<820?0:(info.classList.contains('open')?150:-50);if(Math.abs(wantOff-viewOff)>0.5){viewOff+=(wantOff-viewOff)*0.1;applyView()}
  controls.update();updateFlows(t);updateLabels();
  renderer.render(scene,camera);requestAnimationFrame(loop);
}
loop();
