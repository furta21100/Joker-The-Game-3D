"use strict";
(function(){

/* ══════════════════════════════════════════════════════════════
   JOKER THE GAME 3D  —  game.js
   Three.js r128 · UK Drill Underground · Zelda64/GTA style
   Historia: 6 pantallas + Boss Joker Gigante
══════════════════════════════════════════════════════════════ */

/* ── AUDIO ───────────────────────────────────────────────── */
var BGM = document.getElementById("bgm");
var FUR = document.getElementById("fur");
BGM.volume = 0.55;

document.getElementById("pbtn").addEventListener("click", function(){
  if(FUR.paused){ FUR.play().catch(function(){}); this.innerHTML="&#10074;&#10074;"; }
  else { FUR.pause(); this.innerHTML="&#9654;"; }
});
document.getElementById("pbar").addEventListener("click", function(e){
  if(!FUR.duration) return;
  FUR.currentTime = ((e.clientX - this.getBoundingClientRect().left) / this.offsetWidth) * FUR.duration;
});
FUR.addEventListener("timeupdate", function(){
  var pf=document.getElementById("pfill"), pc=document.getElementById("pcur");
  if(!pf||!pc||!FUR.duration) return;
  pf.style.width = (FUR.currentTime/FUR.duration*100)+"%";
  var m=Math.floor(FUR.currentTime/60), s=Math.floor(FUR.currentTime%60);
  pc.textContent = m+":"+(s<10?"0":"")+s;
});
FUR.addEventListener("loadedmetadata", function(){
  var pt=document.getElementById("ptot"); if(!pt) return;
  var m=Math.floor(FUR.duration/60), s=Math.floor(FUR.duration%60);
  pt.textContent = m+":"+(s<10?"0":"")+s;
});
FUR.addEventListener("ended", function(){ document.getElementById("pbtn").innerHTML="&#9654;"; });

/* ── THREE.JS SETUP ──────────────────────────────────────── */
var container = document.getElementById("g3d");
var renderer  = new THREE.WebGLRenderer({ antialias:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
renderer.setSize(container.clientWidth, container.clientHeight);
container.insertBefore(renderer.domElement, container.firstChild);

var scene  = new THREE.Scene();
var clock  = new THREE.Clock();
var camera = new THREE.PerspectiveCamera(68, container.clientWidth/container.clientHeight, 0.1, 300);

window.addEventListener("resize", function(){
  renderer.setSize(container.clientWidth, container.clientHeight);
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
});

/* ── MATERIALS (vivid underground palette) ───────────────── */
function mat(hex, emissive, ei){
  var m = new THREE.MeshLambertMaterial({ color: hex });
  if(emissive){ m.emissive = new THREE.Color(emissive); m.emissiveIntensity = ei||0.5; }
  return m;
}
var M = {
  ground:  mat(0x1a1a2e),
  road:    mat(0x111122),
  wall:    mat(0x0d0d22),
  neonG:   mat(0xb8ff2e, 0xb8ff2e, 1.0),
  neonP:   mat(0xcc00ff, 0xcc00ff, 1.0),
  neonC:   mat(0x00ffee, 0x00ffee, 1.0),
  neonR:   mat(0xff0050, 0xff0050, 1.0),
  neonO:   mat(0xff6600, 0xff6600, 0.8),
  neonY:   mat(0xffee00, 0xffee00, 0.8),
  white:   mat(0xf0f0f0),
  hoodie:  mat(0xe8e8e8),
  skin:    mat(0xc8956c),
  dark:    mat(0x111122),
  purple:  mat(0x7b2d8b),
  jPurple: mat(0x5a1a6e),
  yellow:  mat(0xf5c518, 0xf5c518, 0.4),
  red:     mat(0xcc2222),
  gold:    mat(0xd4a017, 0xf5c518, 0.6),
  mirror:  mat(0x8888ff, 0x6666ff, 0.4),
  black:   mat(0x111111),
  bricks:  mat(0x1a0808),
};

/* ── GAME STATE ──────────────────────────────────────────── */
var SCR = 0, RUN = false, LIVES = 5;
var HP = 100;
var mirrorDone=false, mirrorOpen=false, interDone=false, quizOpen=false;
var jokerPhase=0, jokerT=0, jokerDone=false;
var signHP=5, signDead=false;
var bossHP=70, bossVX=3, bossVZ=0, bossActive=false, bossDead=false, bossShootT=0;
var discVis=false, discGot=false;

/* ── CONTROLS ────────────────────────────────────────────── */
var K = { F:false, B:false, L:false, R:false, J:false, fire:false };
var fireCd=0;
var camYaw = 0; // camera rotation around Y

/* ── SCENE NODES ─────────────────────────────────────────── */
var playerGroup, bossGroup, discMesh, signMesh;
var jokerMesh=null;
var interactZone=null;
var levelNodes=[];
var pBullets=[], eBullets=[];
var pVY=0, pOnGnd=true;
var pointLights=[];

/* ── OVERLAY HELPERS ─────────────────────────────────────── */
var OVS=["ovS","ovM","ovQ","ovE","ovD","ovW"];
function showOv(id){ OVS.forEach(function(i){ var e=document.getElementById(i); if(e) e.classList.remove("on"); }); var e=document.getElementById(id); if(e) e.classList.add("on"); }
function hideOv(id){ var e=document.getElementById(id); if(e) e.classList.remove("on"); }
function hint(t){ var h=document.getElementById("hint"); if(!t){ h.style.display="none"; return; } h.textContent=t; h.style.display="block"; }
function flashBad(){ var f=document.getElementById("fl"); f.style.opacity="0.45"; setTimeout(function(){ f.style.opacity="0"; },300); }
function upHP(){ document.getElementById("hpfill").style.width=Math.max(0,HP)+"%"; }
function upLives(){ document.getElementById("lvs").textContent="\u2665".repeat(Math.max(0,LIVES)); }
var BDGS=["","// STREET 01","// SALA OSCURA","// CABINA TEL","// EL MURAL","// EL PASILLO","// BOSS STAGE"];
function setBadge(s){ document.getElementById("badge").textContent=BDGS[s]||""; }

/* ── SFX ─────────────────────────────────────────────────── */
function snd(f1,f2,d,v,t){ try{ var ac=new(window.AudioContext||window.webkitAudioContext)(),o=ac.createOscillator(),g=ac.createGain(); o.type=t||"square"; o.connect(g); g.connect(ac.destination); o.frequency.setValueAtTime(f1,ac.currentTime); if(f2) o.frequency.exponentialRampToValueAtTime(f2,ac.currentTime+d); g.gain.setValueAtTime(v||0.1,ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+d); o.start(); o.stop(ac.currentTime+d); }catch(e){} }
function sfxShot(){ snd(800,150,.06,.07); }
function sfxHit(){  snd(180,90,.1,.1,"sawtooth"); }
function sfxOk(){   snd(440,880,.15,.1); setTimeout(function(){snd(880,1320,.15,.1);},130); }
function sfxBad(){  snd(200,80,.3,.12,"sawtooth"); }
function sfxWin(){  [330,392,523,659,784].forEach(function(f,i){setTimeout(function(){snd(f,f*.7,.25,.1);},i*100);}); }

/* ── BUILD PLAYER ────────────────────────────────────────── */
function buildPlayer(){
  playerGroup = new THREE.Group();

  // Legs
  var legL=new THREE.Mesh(new THREE.BoxGeometry(.28,.65,.28),M.black); legL.position.set(-.16,.28,0); legL.castShadow=true; playerGroup.add(legL);
  var legR=new THREE.Mesh(new THREE.BoxGeometry(.28,.65,.28),M.black); legR.position.set( .16,.28,0); legR.castShadow=true; playerGroup.add(legR);
  // Shoes
  var shL=new THREE.Mesh(new THREE.BoxGeometry(.32,.14,.4),M.black); shL.position.set(-.16,-.06,.06); playerGroup.add(shL);
  var shR=new THREE.Mesh(new THREE.BoxGeometry(.32,.14,.4),M.black); shR.position.set( .16,-.06,.06); playerGroup.add(shR);
  // White jacket body
  var body=new THREE.Mesh(new THREE.BoxGeometry(.72,.78,.38),M.white); body.position.set(0,.84,0); body.castShadow=true; playerGroup.add(body);
  // Jacket detail stripe
  var stripe=new THREE.Mesh(new THREE.BoxGeometry(.74,.06,.40),M.neonG); stripe.position.set(0,1.20,0); playerGroup.add(stripe);
  // Arms
  var aL=new THREE.Mesh(new THREE.BoxGeometry(.22,.60,.22),M.hoodie); aL.position.set(-.48,.82,0); aL.castShadow=true; playerGroup.add(aL);
  var aR=new THREE.Mesh(new THREE.BoxGeometry(.22,.60,.22),M.hoodie); aR.position.set( .48,.82,0); aR.castShadow=true; playerGroup.add(aR);
  // Head
  var head=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.48),M.skin); head.position.set(0,1.57,0); head.castShadow=true; playerGroup.add(head);
  // Eyes
  var eL=new THREE.Mesh(new THREE.BoxGeometry(.1,.08,.05),M.black); eL.position.set(-.12,1.59,.25); playerGroup.add(eL);
  var eR=new THREE.Mesh(new THREE.BoxGeometry(.1,.08,.05),M.black); eR.position.set( .12,1.59,.25); playerGroup.add(eR);
  // White hoodie
  var hood=new THREE.Mesh(new THREE.BoxGeometry(.74,.22,.40),M.hoodie); hood.position.set(0,1.20,0); playerGroup.add(hood); // wait, already did stripe
  var hoodTop=new THREE.Mesh(new THREE.BoxGeometry(.62,.28,.44),M.white); hoodTop.position.set(0,1.60,-.06); playerGroup.add(hoodTop);
  // Gun
  var gun=new THREE.Mesh(new THREE.BoxGeometry(.08,.16,.45),M.black); gun.position.set(.55,.80,.22); playerGroup.add(gun);

  playerGroup.position.set(0,0,0);
  scene.add(playerGroup);
}

/* ── BUILD BOSS (giant Joker) ────────────────────────────── */
function buildBoss(){
  bossGroup = new THREE.Group();
  // Legs
  var lL=new THREE.Mesh(new THREE.BoxGeometry(.5,1.1,.5),M.jPurple); lL.position.set(-.3,.5,0); bossGroup.add(lL);
  var lR=new THREE.Mesh(new THREE.BoxGeometry(.5,1.1,.5),M.jPurple); lR.position.set( .3,.5,0); bossGroup.add(lR);
  // Jester shoes
  var sL=new THREE.Mesh(new THREE.CylinderGeometry(.14,.2,.7,8),M.yellow); sL.rotation.z=Math.PI/2; sL.position.set(-.55,-.04,.12); bossGroup.add(sL);
  var sR=new THREE.Mesh(new THREE.CylinderGeometry(.14,.2,.7,8),M.yellow); sR.rotation.z=-Math.PI/2; sR.position.set( .55,-.04,.12); bossGroup.add(sR);
  // Body purple
  var body=new THREE.Mesh(new THREE.BoxGeometry(1.4,1.5,.65),M.purple); body.position.set(0,1.6,0); bossGroup.add(body);
  // Diamond decorations
  [[-0.3,1.7,.33],[0.3,1.45,.33],[0,2.0,.33]].forEach(function(p){
    var dm=new THREE.Mesh(new THREE.OctahedronGeometry(.15),M.yellow); dm.position.set(p[0],p[1],p[2]); bossGroup.add(dm);
  });
  // Lapels
  var lapL=new THREE.Mesh(new THREE.BoxGeometry(.28,.6,.3),M.white); lapL.position.set(-.28,1.55,.34); lapL.rotation.z= .2; bossGroup.add(lapL);
  var lapR=new THREE.Mesh(new THREE.BoxGeometry(.28,.6,.3),M.white); lapR.position.set( .28,1.55,.34); lapR.rotation.z=-.2; bossGroup.add(lapR);
  // Red tie
  var tie=new THREE.Mesh(new THREE.BoxGeometry(.14,.7,.1),M.neonR); tie.position.set(0,1.6,.34); bossGroup.add(tie);
  // Arms
  var aL=new THREE.Mesh(new THREE.BoxGeometry(.4,1.1,.4),M.purple); aL.position.set(-1.0,1.7,0); bossGroup.add(aL);
  var aR=new THREE.Mesh(new THREE.BoxGeometry(.4,1.1,.4),M.purple); aR.position.set( 1.0,1.7,0); bossGroup.add(aR);
  // Gun right hand
  var gun=new THREE.Mesh(new THREE.BoxGeometry(.12,.22,.7),M.black); gun.position.set(1.3,1.5,.25); bossGroup.add(gun);
  // Head
  var head=new THREE.Mesh(new THREE.BoxGeometry(.95,.85,.78),M.skin); head.position.set(0,2.95,0); head.castShadow=true; bossGroup.add(head);
  // Big crazy eyes
  var eL=new THREE.Mesh(new THREE.SphereGeometry(.13,8,8),M.neonP); eL.position.set(-.22,3.0,.41); bossGroup.add(eL);
  var eR=new THREE.Mesh(new THREE.SphereGeometry(.13,8,8),M.neonP); eR.position.set( .22,3.0,.41); bossGroup.add(eR);
  // Painted smile
  for(var i=0;i<6;i++){
    var sm=new THREE.Mesh(new THREE.SphereGeometry(.055),M.red);
    sm.position.set(-0.3+i*.12, 2.76+Math.sin(i*.9)*.08, .41); bossGroup.add(sm);
  }
  // Cheek dots
  var ck1=new THREE.Mesh(new THREE.SphereGeometry(.09),M.neonR); ck1.position.set(-.38,2.9,.4); bossGroup.add(ck1);
  var ck2=new THREE.Mesh(new THREE.SphereGeometry(.09),M.neonR); ck2.position.set( .38,2.9,.4); bossGroup.add(ck2);
  // Jester hat
  var brim=new THREE.Mesh(new THREE.CylinderGeometry(.62,.62,.1,12),mat(0x4a0d5e)); brim.position.set(0,3.46,0); bossGroup.add(brim);
  var pL=new THREE.Mesh(new THREE.CylinderGeometry(.07,.18,.9,8),M.purple); pL.position.set(-.28,4.0,0); bossGroup.add(pL);
  var pR=new THREE.Mesh(new THREE.CylinderGeometry(.07,.18,.9,8),M.yellow); pR.position.set( .28,4.0,0); bossGroup.add(pR);
  var bL=new THREE.Mesh(new THREE.SphereGeometry(.13),M.yellow); bL.position.set(-.28,4.5,0); bossGroup.add(bL);
  var bR=new THREE.Mesh(new THREE.SphereGeometry(.13),M.purple); bR.position.set( .28,4.5,0); bossGroup.add(bR);

  bossGroup.visible = false;
  scene.add(bossGroup);
}

/* ── SCENE BUILDER HELPERS ───────────────────────────────── */
function box(w,h,d,m,x,y,z){ var mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m); mesh.position.set(x,y,z); mesh.receiveShadow=true; mesh.castShadow=true; scene.add(mesh); levelNodes.push(mesh); return mesh; }
function cyl(rT,rB,h,seg,m,x,y,z){ var mesh=new THREE.Mesh(new THREE.CylinderGeometry(rT,rB,h,seg),m); mesh.position.set(x,y,z); scene.add(mesh); levelNodes.push(mesh); return mesh; }
function sph(r,m,x,y,z){ var mesh=new THREE.Mesh(new THREE.SphereGeometry(r,10,10),m); mesh.position.set(x,y,z); scene.add(mesh); levelNodes.push(mesh); return mesh; }
function pLight(hex,intensity,dist,x,y,z){ var l=new THREE.PointLight(hex,intensity,dist); l.position.set(x,y,z); scene.add(l); levelNodes.push(l); pointLights.push({l:l,base:intensity,offset:Math.random()*Math.PI*2}); return l; }
function clearLevel(){
  levelNodes.forEach(function(n){ scene.remove(n); }); levelNodes=[];
  pointLights=[];
  pBullets.forEach(function(b){ scene.remove(b); }); pBullets=[];
  eBullets.forEach(function(b){ scene.remove(b); }); eBullets=[];
  if(discMesh){ scene.remove(discMesh); discMesh=null; }
  signMesh=null; jokerMesh=null; interactZone=null;
  signDead=false; signHP=5; interDone=false;
  jokerDone=false; jokerPhase=0;
  bossGroup.visible=false; bossActive=false; bossDead=false; bossHP=70;
  discVis=false; discGot=false;
  pVY=0; pOnGnd=true; HP=100; upHP();
}
function clearLights(){ var toRm=[]; scene.children.forEach(function(c){if(c.isLight) toRm.push(c);}); toRm.forEach(function(c){scene.remove(c);}); }
function setupLighting(amb,dir1,dir2){
  clearLights();
  scene.add(new THREE.AmbientLight(amb,0.7));
  var d=new THREE.DirectionalLight(dir1,1.4); d.position.set(6,14,6); d.castShadow=true; d.shadow.mapSize.set(1024,1024); scene.add(d);
  var d2=new THREE.DirectionalLight(dir2,0.8); d2.position.set(-6,10,-6); scene.add(d2);
}
function addBuilding(x,z,w,d,h,colHex){
  var m=mat(colHex||0x0d0d22);
  box(w,h,d,m,x,h/2,z);
  // neon roof edge
  var ec=new THREE.Color(); ec.setHSL(Math.random(),1,0.5);
  var em=new THREE.MeshLambertMaterial({color:ec,emissive:ec,emissiveIntensity:0.8});
  box(w+.1,.08,d+.1,em,x,h,z);
  // windows
  for(var wy=0.8;wy<h-.5;wy+=1.6){
    for(var wx=-.35*w;wx<=.35*w;wx+=.8){
      if(Math.random()>.4){
        var wc=new THREE.Color(); wc.setHSL(Math.random()*.2+.1,1,.6);
        var wm=new THREE.MeshLambertMaterial({color:wc,emissive:wc,emissiveIntensity:Math.random()*.5+.1});
        box(.3,.35,.06,wm,x+wx,wy,z+d/2+.02);
      }
    }
  }
}

/* ══════════════════════════════════════════════════════════
   LEVEL BUILDERS
══════════════════════════════════════════════════════════ */

/* ── SCREEN 1: Street (Sign) ── */
function buildS1(){
  scene.background = new THREE.Color(0x050010);
  scene.fog = new THREE.FogExp2(0x050010, 0.025);
  setupLighting(0x111133, 0x4400ff, 0x00ff88);

  // Ground with neon road markings
  box(60,.2,60,M.road,0,-.1,0);
  for(var i=-24;i<25;i+=4){ box(.18,.02,2,M.neonY,i,.01,0); }
  // Wide sidewalks
  box(60,.25,4,mat(0x1a1a30),0,.1,-10);
  box(60,.25,4,mat(0x1a1a30),0,.1, 10);

  // Buildings both sides — vivid colors
  [
    [-14,-8, 3,3,9, 0x0d0030],[−14,−2,2.5,3,7,0x100020],[−14,4,3,2.5,11,0x080028],
    [−14,10,2,3,6,0x0d0025],
    [14,−8,3,3,10,0x001428],[14,0,2.5,3,8,0x001420],[14,7,3,2.5,12,0x001030]
  ].forEach(function(b){ addBuilding(b[0],b[1],b[2],b[3],b[4],b[5]); });

  // Back wall with graffiti
  box(60,14,.5,M.bricks,0,7,−20);
  // Graffiti neon tags on back wall
  box(5,.5,.1,M.neonG,−15,4,−19.7);
  box(4,.5,.1,M.neonP,−5,6,−19.7);
  box(6,.5,.1,M.neonC, 8,5,−19.7);
  box(3,.5,.1,M.neonO, 18,7,−19.7);

  // Lamppost
  box(.15,5.5,.15,mat(0x222230),−6,2.75,−8);
  box(.15,.15,1.6,mat(0x222230),−5.3,5.4,−8);
  pLight(0xb8ff2e, 2.5, 14, −4.6,5.4,−8);
  sph(.18,M.neonG,−4.6,5.4,−8);

  // Dumpster
  box(2,.9,1,mat(0x223322),4,.45,−8);
  box(2.05,.12,1.05,mat(0x334433),4,.95,−8);

  // Fire hydrant
  cyl(.15,.18,.45,8,M.neonR,−3,.22,−7);
  cyl(.2,.2,.1,8,M.neonR,−3,.5,−7);

  // Neon shop signs
  box(2.5,.5,.08,M.neonP,−12,3.5,−9.7);
  box(2,.4,.08,M.neonC, 12,4, −9.7);
  pLight(0xcc00ff,1.5,8,−12,3.5,−9);
  pLight(0x00ffee,1.5,8, 12,4,−9);

  // THE SIGN "BE GANGSTA"
  var sgM=mat(0x220000);sgM.emissive=new THREE.Color(0xff0000);sgM.emissiveIntensity=0.2;
  signMesh=box(3.2,1.3,.15,sgM, 6,2.2,−12);
  // Sign post
  box(.12,2.2,.12,mat(0x333333),6,1.1,−12);
  // Sign glow
  pLight(0xff2222,2.5,8,6,2.5,−11);

  playerGroup.position.set(0,0,0); playerGroup.rotation.y=0;
  camYaw=0;
  interactZone={pos:new THREE.Vector3(6,0,−12),radius:2.8};
  hint("[ DISPARA AL CARTEL BE GANGSTA ]");
}

/* ── SCREEN 2: Dark Room (Mirror) ── */
function buildS2(){
  scene.background=new THREE.Color(0x03020a);
  scene.fog=new THREE.FogExp2(0x03020a,.06);
  setupLighting(0x110022,0x5500aa,0x002244);

  // Floor — dark tiles
  box(22,.15,22,mat(0x0a0818),0,−.08,−5);
  // Tile lines
  for(var i=−10;i<11;i+=2){ box(.05,.02,22,mat(0x1a1040),i,.02,−5); box(22,.02,.05,mat(0x1a1040),0,.02,−5+i); }

  // Walls
  box(22,9,.4,mat(0x080015),0,4.5,−15); // back
  box(22,9,.4,mat(0x080015),0,4.5, 4);  // front
  box(.4,9,20,mat(0x080015),−10,4.5,−6); // left
  box(.4,9,20,mat(0x080015), 10,4.5,−6); // right

  // Ceiling
  box(22,.3,20,mat(0x06000f),0,9,−5);

  // Candles on floor
  [−5,0,5].forEach(function(x){
    cyl(.06,.08,.5,8,mat(0xe8d890),x,.25,−6);
    sph(.08,M.neonY,x,.6,−6);
    pLight(0xf5c518,.9,4,x,.7,−6);
  });

  // Candle wall sconces
  [−7,7].forEach(function(x){
    box(.2,.6,.2,mat(0x333333),x,3.5,−14.6);
    sph(.1,M.neonO,x,4,−14.6);
    pLight(0xff8800,1,5,x,4,−14);
  });

  // Ornate mirror (gold frame + blue glass)
  box(1.8,.15,3.4,M.gold,8.5,.07,−12); // base
  box(1.8,3.4,.12,M.gold,8.5,1.7,−12); // frame back
  var fT=box(.15,3.4,.15,M.gold,8.5−.9,1.7,−12);
  var fR=box(.15,3.4,.15,M.gold,8.5+.9,1.7,−12);
  var fTop=box(1.8,.15,3.4,M.gold,8.5,3.4,−12);
  // Mirror glass
  signMesh=box(1.5,3.0,.08,M.mirror,8.5,1.7,−11.95);
  // Mirror glow
  pLight(0x8888ff,2,7,8.5,2,−11);
  // Corner ornaments on frame
  [[0.9,3.4],[−0.9,3.4],[0.9,0],[−0.9,0]].forEach(function(p){ sph(.12,M.gold,8.5+p[0],p[1],−12); });

  // Atmospheric purple rays
  pLight(0x5500aa,1.5,12,−5,5,−8);
  pLight(0x0033aa,1,10,0,6,−14);

  playerGroup.position.set(0,0,0); playerGroup.rotation.y=0; camYaw=0;
  interactZone={pos:new THREE.Vector3(8.5,0,−12),radius:3.2};
  hint("[ ACERCATE AL ESPEJO ]");
}

/* ── SCREEN 3: Phone Booth (Quiz 1) ── */
function buildS3(){
  scene.background=new THREE.Color(0x001020);
  scene.fog=new THREE.FogExp2(0x001525,.03);
  setupLighting(0x003344,0x0044aa,0x00aa66);

  box(60,.2,60,mat(0x0a1a28),0,−.1,0);
  // Wet asphalt shimmer
  box(8,.02,60,mat(0x0d2030),0,.01,0);
  for(var i=−24;i<25;i+=5){ box(.12,.02,2,M.neonC,i,.02,0); }

  // Buildings cyan tinted
  [[−14,−6,3,3,8],[−14,2,2.5,3,6],[−14,9,3,2.5,10],[14,−7,3,3,9],[14,1,2.5,3,7],[14,8,3,2.5,11]].forEach(function(b,i){
    addBuilding(b[0],b[1],b[2],b[3],b[4], i%2===0?0x001525:0x001a20);
  });
  box(60,12,.5,mat(0x001018),0,6,−20);

  // Rain particles
  var rainG=new THREE.BufferGeometry(), rainV=[];
  for(var i=0;i<400;i++) rainV.push((Math.random()−.5)*30,Math.random()*10,(Math.random()−.5)*30);
  rainG.setAttribute("position",new THREE.Float32BufferAttribute(rainV,3));
  var rain=new THREE.Points(rainG,new THREE.PointsMaterial({color:0x00ffee,size:.04,transparent:true,opacity:.45}));
  scene.add(rain); levelNodes.push(rain); levelNodes._rain=rain;

  // Phone booth — detailed
  var pbMat=mat(0x004444); pbMat.transparent=true; pbMat.opacity=.8;
  box(1.6,2.8,1.6,pbMat,7,1.4,−11);
  // Glass walls (slightly transparent cyan)
  var glassMat=mat(0x004466); glassMat.transparent=true; glassMat.opacity=.5;
  box(1.55,2.2,.06,glassMat,7,1.4,−10.2);
  // Roof
  box(1.7,.15,1.7,M.neonC,7,2.9,−11);
  // Phone inside
  box(.12,.4,.05,mat(0x333333),7.3,1.5,−10.3);
  box(.1,.15,.05,mat(0x111111),7.3,1.8,−10.3);
  // Glow
  pLight(0x00ffcc,2.5,8,7,2,−10);
  pLight(0x00ffcc,.8,5,7,1,−11);

  // Neon signs rain-lit
  box(3,.4,.08,M.neonC,−10,4,−9.7);
  box(2,.4,.08,M.neonO, 12,5,−9.7);
  pLight(0x00ffee,1.2,7,−10,4,−9);
  pLight(0xff8800,1.2,7, 12,5,−9);

  playerGroup.position.set(0,0,0); playerGroup.rotation.y=0; camYaw=0;
  interactZone={pos:new THREE.Vector3(7,0,−11),radius:2.5};
  hint("[ ACERCATE A LA CABINA ]");
}

/* ── SCREEN 4: Mural (Quiz 2) ── */
function buildS4(){
  scene.background=new THREE.Color(0x0a0300);
  scene.fog=new THREE.FogExp2(0x080003,.03);
  setupLighting(0x221100,0xff4400,0x440044);

  box(60,.2,60,mat(0x180800),0,−.1,0);
  // Bricks ground
  for(var i=−28;i<29;i+=2) for(var j=−28;j<29;j+=2){
    if(Math.random()>.7) box(1.9,.04,1.9,mat(0x1a0a04),i,−.07,j);
  }

  // Buildings warm tones
  [[−14,−8,3,3,8,0x1a0800],[−14,0,2.5,3,6,0x150600],[−14,7,3,2.5,10,0x100500],[14,−7,3,3,9,0x0a0020],[14,1,2.5,3,7,0x0d0025],[14,8,3,2.5,11,0x080018]].forEach(function(b){ addBuilding(b[0],b[1],b[2],b[3],b[4],b[5]); });

  // BIG BACK WALL with mural
  box(60,14,.6,mat(0x0f0808),0,7,−20);
  // Mural frame (neon)
  box(8.2,.1,5.4,M.neonO,0,.05,−19.5);
  box(8.2,5.4,.06,mat(0x100608),0,2.7,−19.65);
  // Mural: big Joker face pixel art
  var muralX=0, muralY=5.5, mZ=−19.6;
  // Face
  box(2.8,3.,.15,M.skin,muralX,muralY−1.5,mZ);
  // Eyes (neon purple)
  box(.5,.4,.12,M.neonP,muralX−.7,muralY−.9,mZ);
  box(.5,.4,.12,M.neonP,muralX+.7,muralY−.9,mZ);
  // Smile (red neon dots)
  [−.7,−.35,0,.35,.7].forEach(function(ox){ box(.18,.18,.12,M.neonR,muralX+ox,muralY−1.55,mZ); });
  // Cheeks
  box(.38,.38,.12,M.neonR,muralX−1.1,muralY−1.1,mZ);
  box(.38,.38,.12,M.neonR,muralX+1.1,muralY−1.1,mZ);
  // Jester hat on mural
  box(1.6,.2,.12,mat(0x4a0d5e),muralX,muralY+.2,mZ);
  box(.7,1.2,.12,M.purple,muralX−.45,muralY+.8,mZ);
  box(.7,1.2,.12,M.yellow,muralX+.45,muralY+.8,mZ);
  // Mural glow
  pLight(0xff6600,2,12,muralX,muralY,−18);
  pLight(0xcc00ff,1.5,10,muralX,muralY−2,−18);

  // Fire barrels
  [−5,5].forEach(function(x){
    cyl(.3,.3,.7,12,mat(0x333311),x,.35,−7);
    pLight(0xff4400,1.5,6,x,.9,−7);
    sph(.2,M.neonO,x,.9,−7);
  });

  playerGroup.position.set(0,0,0); playerGroup.rotation.y=0; camYaw=0;
  interactZone={pos:new THREE.Vector3(0,0,−18),radius:4};
  hint("[ EXAMINA EL MURAL ]");
}

/* ── SCREEN 5: Corridor / Joker appears (Quiz 3) ── */
function buildS5(){
  scene.background=new THREE.Color(0x060010);
  scene.fog=new THREE.FogExp2(0x060010,.055);
  setupLighting(0x220044,0xaa00ff,0x440022);

  // Corridor floor
  box(12,.2,40,mat(0x0d001a),0,−.1,−15);
  // Walls
  box(.4,7,40,mat(0x080018),−5.5,3.5,−15);
  box(.4,7,40,mat(0x080018), 5.5,3.5,−15);
  box(12,7,.4,mat(0x080018),0,3.5,−34);
  // Ceiling
  box(12,.3,40,mat(0x05000f),0,7,−15);

  // Neon strips on walls — alternating colors
  [0xcc00ff,0xff0080,0x00ccff,0xffee00].forEach(function(col,i){
    var z=−8−i*5;
    box(.06,5,.06,mat(col),−5.45,2.5,z); scene.children[scene.children.length−1].material.emissive=new THREE.Color(col); scene.children[scene.children.length−1].material.emissiveIntensity=1;
    box(.06,5,.06,mat(col), 5.45,2.5,z); scene.children[scene.children.length−1].material.emissive=new THREE.Color(col); scene.children[scene.children.length−1].material.emissiveIntensity=1;
    pLight(col,.8,6,−5.3,2.5,z);
    pLight(col,.8,6, 5.3,2.5,z);
  });

  // End glow
  pLight(0xcc00ff,3,15,0,3,−33);
  box(11,6,.06,mat(0x220044),0,3,−33.7);

  // Card on floor (at end of corridor)
  var cardG=new THREE.Group();
  var cBody=new THREE.Mesh(new THREE.BoxGeometry(.9,.06,1.2),mat(0x111111));
  var cBorder=new THREE.Mesh(new THREE.BoxGeometry(.95,.07,1.25),M.neonP);cBorder.position.y=−.005;
  var cSym=new THREE.Mesh(new THREE.BoxGeometry(.22,.07,.32),mat(0x220044));cSym.position.y=.04;
  var cInner=new THREE.Mesh(new THREE.BoxGeometry(.18,.08,.28),M.neonY);cInner.position.y=.045;
  cardG.add(cBody);cardG.add(cBorder);cardG.add(cSym);cardG.add(cInner);
  cardG.position.set(0,.04,−30);cardG.rotation.x=−Math.PI/2;
  scene.add(cardG);levelNodes.push(cardG);
  pLight(0xf5c518,2,5,0,.5,−30);

  // Build small Joker anim mesh
  jokerMesh=buildSmallJoker();
  jokerMesh.position.set(0,0,−28);
  jokerMesh.visible=true;
  scene.add(jokerMesh);levelNodes.push(jokerMesh);

  playerGroup.position.set(0,0,0); playerGroup.rotation.y=0; camYaw=0;
  jokerPhase=0; jokerT=Date.now(); jokerDone=false;
  interactZone={pos:new THREE.Vector3(0,0,−30),radius:2.5};
  hint("[ AVANZA POR EL PASILLO ]");
}

/* ── SCREEN 6: Boss Arena ── */
function buildS6(){
  scene.background=new THREE.Color(0x0a0003);
  scene.fog=new THREE.FogExp2(0x080003,.025);
  setupLighting(0x330005,0xff0030,0x660000);

  // Arena floor — blood red tiles
  box(28,.2,28,mat(0x1a0006),0,−.1,−12);
  for(var i=−13;i<14;i+=2){ box(.06,.02,28,M.neonR,i,.02,−12); box(28,.02,.06,M.neonR,0,.02,−12+i); }

  // Arena walls
  box(28,9,.5,mat(0x110004),0,4.5,−25);
  box(28,9,.5,mat(0x110004),0,4.5,1);
  box(.5,9,28,mat(0x110004),−13,4.5,−12);
  box(.5,9,28,mat(0x110004), 13,4.5,−12);
  // Ceiling with red glow
  box(28,.3,28,mat(0x0a0003),0,9,−12);

  // Red neon pillars at corners
  [[−11,−22],[11,−22],[−11,−2],[11,−2]].forEach(function(p){
    cyl(.25,.25,8,8,mat(0x220008),p[0],4,p[1]);
    pLight(0xff0030,3,12,p[0],4.5,p[1]);
    sph(.18,M.neonR,p[0],8.3,p[1]);
  });

  // Dramatic spotlights from above
  pLight(0xff0050,4,20,0,8,−12);
  pLight(0xcc00ff,2,15,−6,7,−18);
  pLight(0xcc00ff,2,15, 6,7,−6);

  // Skull decorations on walls
  [−10,0,10].forEach(function(x){
    sph(.3,mat(0xdddddd),x,5,−24.8);
    box(.2,.15,.1,mat(0x222222),x,4.75,−24.75);
  });

  bossGroup.visible=true;
  bossGroup.position.set(4,0,−18);
  bossActive=true;

  // Disc (hidden until boss dies)
  discMesh=new THREE.Group();
  var dBase=new THREE.Mesh(new THREE.CylinderGeometry(.65,.65,.07,32),M.gold);
  var dHole=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.1,16),M.black);dHole.position.y=0;
  [.38,.50,.58].forEach(function(r){ var ring=new THREE.Mesh(new THREE.TorusGeometry(r,.02,6,24),mat(0xa08020)); ring.rotation.x=Math.PI/2; dBase.add(ring); });
  discMesh.add(dBase);discMesh.add(dHole);
  discMesh.position.set(4,.07,−18);discMesh.visible=false;
  scene.add(discMesh);

  playerGroup.position.set(0,0,0); playerGroup.rotation.y=Math.PI; camYaw=Math.PI;
  hint("[ DERROTA AL JOKER BOSS ]");
}

/* ── SMALL JOKER 3D ──────────────────────────────────────── */
function buildSmallJoker(){
  var g=new THREE.Group();
  var lL=new THREE.Mesh(new THREE.BoxGeometry(.26,.65,.26),M.jPurple);lL.position.set(−.14,.28,0);g.add(lL);
  var lR=new THREE.Mesh(new THREE.BoxGeometry(.26,.65,.26),M.jPurple);lR.position.set( .14,.28,0);g.add(lR);
  var body=new THREE.Mesh(new THREE.BoxGeometry(.7,.9,.35),M.purple);body.position.set(0,.9,0);g.add(body);
  var dm=new THREE.Mesh(new THREE.OctahedronGeometry(.09),M.yellow);dm.position.set(0,1,.18);g.add(dm);
  var aL=new THREE.Mesh(new THREE.BoxGeometry(.2,.55,.2),M.purple);aL.position.set(−.46,.9,0);g.add(aL);
  var aR=new THREE.Mesh(new THREE.BoxGeometry(.2,.55,.2),M.purple);aR.position.set( .46,.9,0);g.add(aR);
  var head=new THREE.Mesh(new THREE.BoxGeometry(.52,.5,.46),M.skin);head.position.set(0,1.72,0);g.add(head);
  var eL2=new THREE.Mesh(new THREE.SphereGeometry(.08),M.neonP);eL2.position.set(−.13,1.76,.24);g.add(eL2);
  var eR2=new THREE.Mesh(new THREE.SphereGeometry(.08),M.neonP);eR2.position.set( .13,1.76,.24);g.add(eR2);
  for(var i=0;i<5;i++){var s=new THREE.Mesh(new THREE.SphereGeometry(.045),M.red);s.position.set(−.22+i*.11,1.59+Math.sin(i*.9)*.04,.24);g.add(s);}
  var brim=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,.08,10),mat(0x4a0d5e));brim.position.set(0,2.0,0);g.add(brim);
  var pHL=new THREE.Mesh(new THREE.CylinderGeometry(.05,.12,.55,8),M.purple);pHL.position.set(−.14,2.35,0);g.add(pHL);
  var pHR=new THREE.Mesh(new THREE.CylinderGeometry(.05,.12,.55,8),M.yellow);pHR.position.set( .14,2.35,0);g.add(pHR);
  var bLL=new THREE.Mesh(new THREE.SphereGeometry(.08),M.yellow);bLL.position.set(−.14,2.66,0);g.add(bLL);
  var bRL=new THREE.Mesh(new THREE.SphereGeometry(.08),M.purple);bRL.position.set( .14,2.66,0);g.add(bRL);
  return g;
}

/* ── DISC ────────────────────────────────────────────────── */
function showDisc(){
  discVis=true;
  if(discMesh) discMesh.visible=true;
  var dl=new THREE.PointLight(0xf5c518,3,10);dl.position.set(4,.5,−18);scene.add(dl);levelNodes.push(dl);
}

/* ── GOSCREEN ────────────────────────────────────────────── */
function goS(s){
  clearLevel();
  SCR=s; RUN=false;
  setBadge(s); upLives();
  hideOv("ovM"); hideOv("ovQ"); hideOv("ovE");
  hint("");
  if(s===1) buildS1();
  else if(s===2) buildS2();
  else if(s===3) buildS3();
  else if(s===4) buildS4();
  else if(s===5) buildS5();
  else if(s===6) buildS6();
  HP=100; upHP(); RUN=true;
}

/* ── QUIZZES ─────────────────────────────────────────────── */
var QD={
  3:{l:"// CABINA DE LA CALLE //",q:"Que le dice el Joker al mundo?",
     o:[{t:"Que el crimen paga",c:false},{t:"La sociedad crea a sus monstruos",c:true},{t:"Que todos son iguales",c:false}]},
  4:{l:"// MURAL DEL BLOQUE //",q:"Cual es la primera senal de la locura?",
     o:[{t:"Reirse sin motivo",c:false},{t:"Querer ser normal",c:false},{t:"Perder el miedo al juicio ajeno",c:true}]},
  5:{l:"// LA CARTA DEL BUFON //",q:"Para ganar la batalla mas dificil... contra quien debes luchar?",
     o:[{t:"Contra la industria",c:false},{t:"Contra ti mismo",c:true},{t:"Contra el mundo",c:false}]}
};
function openQ(s){
  if(quizOpen)return;quizOpen=true;hint("");
  var q=QD[s];document.getElementById("qlbl").textContent=q.l;document.getElementById("qtxt").textContent=q.q;
  var con=document.getElementById("qlist");con.innerHTML="";
  q.o.forEach(function(o){
    var b=document.createElement("button");b.className="q-btn";b.textContent=o.t;
    b.addEventListener("click",function(){
      if(o.c){sfxOk();hideOv("ovQ");quizOpen=false;interDone=true;hint("");setTimeout(function(){goS(s+1);},700);}
      else{sfxBad();LIVES--;upLives();flashBad();if(LIVES<=0){doGameOver();return;}hideOv("ovQ");var ps=s;showEnemy(function(){quizOpen=false;setTimeout(function(){openQ(ps);},300);});}
    });con.appendChild(b);
  });showOv("ovQ");
}

/* ── MIRROR ──────────────────────────────────────────────── */
document.getElementById("mA").addEventListener("click",function(){flashBad();hideOv("ovM");mirrorOpen=false;setTimeout(function(){if(!mirrorDone){mirrorOpen=true;showOv("ovM");}},700);});
document.getElementById("mB").addEventListener("click",function(){mirrorDone=true;mirrorOpen=false;hideOv("ovM");hint("");setTimeout(function(){goS(3);},900);});

/* ── ENEMY MINI-FIGHT ────────────────────────────────────── */
var EF=null;
function showEnemy(onW){
  document.getElementById("elvs").textContent="VIDAS: "+"\u2665".repeat(Math.max(0,LIVES));
  EF={ex:60,ey:28,evx:1.5,ehp:3,ebs:[],pbs:[],t:0,done:false,win:onW};
  showOv("ovE");runEF();
}
function runEF(){
  if(!EF||EF.done)return;
  var ec=document.getElementById("ecan"),c2=ec.getContext("2d"),ew=270,eh=175;
  c2.fillStyle="#080000";c2.fillRect(0,0,ew,eh);
  // Grid floor
  c2.strokeStyle="#1a0000";c2.lineWidth=1;for(var gi=0;gi<ew;gi+=20)c2.strokeRect(gi,eh-40,20,40);
  EF.ex+=EF.evx;if(EF.ex<10||EF.ex>ew-44)EF.evx*=-1;EF.t++;
  if(EF.t%52===0)EF.ebs.push({x:EF.ex+14,y:EF.ey+52,vy:3.8});
  // Enemy — colored GTA-ish sprite
  c2.fillStyle="#c0392b";c2.fillRect(EF.ex,EF.ey,32,52);
  c2.fillStyle="#c8956c";c2.fillRect(EF.ex+8,EF.ey,16,18);
  c2.fillStyle="#111";c2.fillRect(EF.ex+11,EF.ey+5,4,3);c2.fillRect(EF.ex+17,EF.ey+5,4,3);
  // Jacket stripe
  c2.fillStyle="#ff4400";c2.fillRect(EF.ex,EF.ey+22,32,4);
  // HP
  c2.fillStyle="#0a0000";c2.fillRect(EF.ex,EF.ey-11,32,7);
  c2.fillStyle="#ff3333";c2.fillRect(EF.ex,EF.ey-11,32*(EF.ehp/3),7);
  // Player avatar
  var px2=ew/2-13;
  c2.fillStyle="#e8e8e8";c2.fillRect(px2,eh-58,26,40);
  c2.fillStyle="#c8956c";c2.fillRect(px2+5,eh-58,16,17);
  c2.fillStyle="#b8ff2e";c2.fillRect(px2,eh-59,26,5);// neon stripe on hoodie
  // Bullets enemy
  c2.fillStyle="#ff0055";for(var i=EF.ebs.length-1;i>=0;i--){var eb=EF.ebs[i];eb.y+=eb.vy;c2.fillRect(eb.x-2,eb.y,5,9);if(eb.y>eh)EF.ebs.splice(i,1);}
  // Bullets player
  c2.fillStyle="#b8ff2e";for(var i=EF.pbs.length-1;i>=0;i--){var pb=EF.pbs[i];pb.y-=10;c2.fillRect(pb.x-2,pb.y,5,10);if(pb.x>EF.ex&&pb.x<EF.ex+32&&pb.y<EF.ey+52&&pb.y>EF.ey){EF.ehp--;EF.pbs.splice(i,1);if(EF.ehp<=0){EF.done=true;hideOv("ovE");if(EF.win)EF.win();return;}}else if(pb.y<0)EF.pbs.splice(i,1);}
  c2.fillStyle="#444";c2.font="9px monospace";c2.textAlign="center";c2.fillText("TAP [DISPARAR]",ew/2,eh-4);
  requestAnimationFrame(runEF);
}
document.getElementById("btnE").addEventListener("click",function(){if(EF&&!EF.done)EF.pbs.push({x:135,y:118});});
document.getElementById("btnE").addEventListener("touchstart",function(e){e.preventDefault();if(EF&&!EF.done)EF.pbs.push({x:135,y:118});},{passive:false});

/* ── DEAD / WIN ──────────────────────────────────────────── */
function doGameOver(){ RUN=false; showOv("ovD"); }
document.getElementById("btnR").addEventListener("click",function(){LIVES=5;upLives();hideOv("ovD");goS(1);BGM.play().catch(function(){});});

function showReady(){
  RUN=false; BGM.pause();
  var ov=document.getElementById("ovW");
  ov.innerHTML='<div class="q-lbl">// EL DISCO DE ORO //</div>'
    +'<div style="font-size:clamp(24px,7vw,42px);font-weight:900;color:#f5c518;letter-spacing:3px;text-align:center;text-shadow:0 0 20px #f5c518,0 0 40px #f5c51866">DISCO DE ORO</div>'
    +'<div style="color:#666;font-size:clamp(14px,4vw,18px);text-align:center;max-width:85%;line-height:2">Has vencido a La Industria.<br><br><span style="color:#b8ff2e">&#191;Est&#225;s listo para lo siguiente?</span></div>'
    +'<button onclick="doWin()" style="padding:16px 44px;background:transparent;border:2px solid #b8ff2e;color:#b8ff2e;font-family:\'Courier New\',monospace;font-size:15px;letter-spacing:4px;cursor:pointer;box-shadow:0 0 20px #b8ff2e44">SI, ESTOY LISTO</button>';
  showOv("ovW");
}
window.doWin=function(){
  var ov=document.getElementById("ovW");
  ov.innerHTML='<div class="q-lbl">// MISION COMPLETA //</div>'
    +'<div class="w-title">VICTORIA</div><div class="w-sub">LA INDUSTRIA HA CAIDO</div>'
    +'<div class="w-box"><div class="w-name">Joker &ndash; Furta LieF</div>'
    +'<div id="pbar"><div id="pfill" style="height:7px;width:0%;background:linear-gradient(90deg,#4a8000,#b8ff2e)"></div></div>'
    +'<div class="w-row"><span class="w-time" id="pcur">0:00</span>'
    +'<button id="pbtn" onclick="tgPlay()" style="width:48px;height:48px;background:#020a00;border:1px solid #b8ff2e;color:#b8ff2e;font-size:20px;cursor:pointer">&#9654;</button>'
    +'<span class="w-time" id="ptot">0:00</span></div></div>'
    +'<a class="w-yt" href="https://youtu.be/FiqwQ_8k1Ec?is=UG-A4Yh_rBuDt10d" target="_blank" rel="noopener">&#9654; VER VIDEOCLIP EN YOUTUBE</a>';
  showOv("ovW");
  document.getElementById("pbar").addEventListener("click",function(e){if(!FUR.duration)return;var r=this.getBoundingClientRect();FUR.currentTime=((e.clientX-r.left)/r.width)*FUR.duration;});
  FUR.addEventListener("timeupdate",function(){var pf=document.getElementById("pfill"),pc=document.getElementById("pcur");if(!pf||!pc||!FUR.duration)return;pf.style.width=(FUR.currentTime/FUR.duration*100)+"%";var m=Math.floor(FUR.currentTime/60),s=Math.floor(FUR.currentTime%60);pc.textContent=m+":"+(s<10?"0":"")+s;});
  if(FUR.readyState>=1){var m=Math.floor(FUR.duration/60),s=Math.floor(FUR.duration%60);var pt=document.getElementById("ptot");if(pt)pt.textContent=m+":"+(s<10?"0":"")+s;}
};
window.tgPlay=function(){var pb=document.getElementById("pbtn");if(FUR.paused){FUR.play().catch(function(){});if(pb)pb.innerHTML="&#10074;&#10074;";}else{FUR.pause();if(pb)pb.innerHTML="&#9654;";}};

/* ── BULLETS 3D ──────────────────────────────────────────── */
var bMat=new THREE.MeshLambertMaterial({color:0xb8ff2e,emissive:0xb8ff2e,emissiveIntensity:1});
var eMat=new THREE.MeshLambertMaterial({color:0xff0050,emissive:0xff0050,emissiveIntensity:1});
function fireP(){
  var dir=new THREE.Vector3(0,0,−1).applyEuler(new THREE.Euler(0,playerGroup.rotation.y,0));
  var b=new THREE.Mesh(new THREE.SphereGeometry(.08),bMat);
  b.position.copy(playerGroup.position).add(new THREE.Vector3(0,1.2,0));
  b._v=dir.multiplyScalar(20); b._life=2.5;
  scene.add(b); pBullets.push(b); sfxShot();
}
function fireB(){
  var dir=new THREE.Vector3(); dir.subVectors(playerGroup.position,bossGroup.position).normalize();
  var b=new THREE.Mesh(new THREE.SphereGeometry(.12),eMat);
  b.position.copy(bossGroup.position).add(new THREE.Vector3(0,2.5,0));
  b._v=dir.multiplyScalar(7); b._life=3;
  scene.add(b); eBullets.push(b);
}

/* ── CAMERA ──────────────────────────────────────────────── */
var _tmp=new THREE.Vector3();
function updateCamera(dt){
  // Third-person follow behind player
  var behind=new THREE.Vector3(0,0,7).applyEuler(new THREE.Euler(0,playerGroup.rotation.y,0));
  var tPos=playerGroup.position.clone().add(new THREE.Vector3(0,3.5,0)).add(behind);
  camera.position.lerp(tPos,.1);
  _tmp.copy(playerGroup.position).add(new THREE.Vector3(0,1.5,0));
  camera.lookAt(_tmp);
}

/* ── MAIN LOOP ───────────────────────────────────────────── */
var SPD=6, GRAV=−14;
var _fw=new THREE.Vector3(), _rt=new THREE.Vector3();
var BOSS_BOUNDS_X=12, BOSS_BOUNDS_Z_MIN=−24, BOSS_BOUNDS_Z_MAX=−2;

function loop(){
  requestAnimationFrame(loop);
  if(!RUN){ renderer.render(scene,camera); return; }

  var dt=Math.min(clock.getDelta(),.05);
  var now=Date.now();

  /* ─ PLAYER MOVEMENT ─ */
  var moved=false;
  _fw.set(0,0,−1).applyEuler(new THREE.Euler(0,playerGroup.rotation.y,0));
  _rt.set(1,0, 0).applyEuler(new THREE.Euler(0,playerGroup.rotation.y,0));
  if(K.F){ playerGroup.position.addScaledVector(_fw,SPD*dt); moved=true; }
  if(K.B){ playerGroup.position.addScaledVector(_fw,−SPD*dt); moved=true; }
  if(K.L){ playerGroup.rotation.y+=2.2*dt; moved=true; }
  if(K.R){ playerGroup.rotation.y−=2.2*dt; moved=true; }
  // Jump / gravity
  if(K.J&&pOnGnd){ pVY=8; pOnGnd=false; }
  pVY+=GRAV*dt;
  playerGroup.position.y+=pVY*dt;
  if(playerGroup.position.y<=0){ playerGroup.position.y=0; pVY=0; pOnGnd=true; }
  // Bounds
  playerGroup.position.x=Math.max(−12,Math.min(12,playerGroup.position.x));
  playerGroup.position.z=Math.max(−32,Math.min(2,playerGroup.position.z));

  // Walk animation
  if(moved&&pOnGnd){
    var sw=Math.sin(now/130)*.4;
    if(playerGroup.children[0]) playerGroup.children[0].rotation.x= sw;
    if(playerGroup.children[1]) playerGroup.children[1].rotation.x=−sw;
  }

  // Fire
  if(fireCd>0) fireCd−=dt;
  if(K.fire&&fireCd<=0){ fireP(); fireCd=.22; }

  /* ─ PLAYER BULLETS ─ */
  for(var i=pBullets.length−1;i>=0;i--){
    var b=pBullets[i]; b._life−=dt; b.position.addScaledVector(b._v,dt);
    if(b._life<=0){ scene.remove(b); pBullets.splice(i,1); continue; }
    // Sign hit (screens 1)
    if(SCR===1&&!signDead&&signMesh&&b.position.distanceTo(signMesh.position)<2){
      signHP--; scene.remove(b); pBullets.splice(i,1); sfxHit();
      signMesh.material.emissiveIntensity=1−(signHP/5);
      if(signHP<=0){signDead=true;scene.remove(signMesh);signMesh=null;setTimeout(function(){goS(2);},1200);}
      continue;
    }
    // Boss hit
    if(SCR===6&&bossActive&&!bossDead&&b.position.distanceTo(bossGroup.position)<2.5){
      bossHP−=7; scene.remove(b); pBullets.splice(i,1); sfxHit();
      setBadge(6); document.getElementById("badge").textContent="BOSS HP: "+Math.max(0,bossHP)+"/70";
      if(bossHP<=0){ bossHP=0; bossDead=true; bossGroup.visible=false; sfxWin(); showDisc(); hint("[ RECOGE EL DISCO DE ORO ]"); }
      continue;
    }
  }

  /* ─ ENEMY BULLETS ─ */
  for(var i=eBullets.length−1;i>=0;i--){
    var b=eBullets[i]; b._life−=dt; b.position.addScaledVector(b._v,dt);
    if(b._life<=0){ scene.remove(b); eBullets.splice(i,1); continue; }
    if(b.position.distanceTo(playerGroup.position)<.9){
      HP−=14; scene.remove(b); eBullets.splice(i,1); upHP(); sfxHit();
      if(HP<=0){ HP=0; doGameOver(); }
    }
  }

  /* ─ BOSS AI ─ */
  if(SCR===6&&bossActive&&!bossDead){
    bossGroup.position.x+=bossVX*dt*2.5;
    bossGroup.position.z+=bossVZ*dt*2;
    if(Math.abs(bossGroup.position.x)>BOSS_BOUNDS_X) bossVX*=−1;
    if(bossGroup.position.z<BOSS_BOUNDS_Z_MIN||bossGroup.position.z>BOSS_BOUNDS_Z_MAX) bossVZ*=−1;
    if(Math.random()<.002) bossVZ=(Math.random()−.5)*3;
    bossGroup.position.y=Math.abs(Math.sin(now/500))*.4;
    bossGroup.lookAt(playerGroup.position.x,bossGroup.position.y,playerGroup.position.z);
    bossGroup.children.forEach(function(c,i){ if(c.isMesh&&i===5) c.rotation.y+=dt*2; });
    bossShootT−=dt; if(bossShootT<=0){ bossShootT=2+Math.random(); fireB(); }
  }

  /* ─ SCREEN-SPECIFIC ─ */
  if(SCR===1&&signMesh){
    hint("[ DISPARA AL CARTEL BE GANGSTA ]");
  }
  if(SCR===2&&signMesh&&!mirrorDone&&!mirrorOpen){
    var md=playerGroup.position.distanceTo(signMesh.position);
    if(md<3.5){ mirrorOpen=true; showOv("ovM"); hint(""); }
    else hint("[ ACERCATE AL ESPEJO ]");
  }
  if((SCR===3||SCR===4||SCR===5)&&interactZone&&!interDone&&!quizOpen){
    var dd=playerGroup.position.distanceTo(interactZone.pos);
    var htxts=["[ ACERCATE A LA CABINA TELEFONICA ]","[ EXAMINA EL MURAL DEL JOKER ]","[ RECOGE LA CARTA ]"];
    if(dd<interactZone.radius){ openQ(SCR); hint(""); }
    else hint(htxts[SCR−3]||"");
  }
  if(SCR===5&&jokerMesh){
    if(!jokerDone){
      var pr=Math.min(1,(now−jokerT)/1300);
      if(jokerPhase===0){ jokerMesh.position.y=0; if(pr>=1) jokerPhase=1; }
      else if(jokerPhase===1){ jokerMesh.rotation.y+=dt*1.5; if(now−jokerT>4000){jokerPhase=2;jokerT=now;} }
      else if(jokerPhase===2){ var fd=1−(now−jokerT)/1000; if(fd<=0){jokerDone=true;jokerMesh.visible=false;hint("[ RECOGE LA CARTA ]");} }
    }
  }
  if(SCR===6&&discVis&&!discGot&&discMesh){
    discMesh.rotation.y+=dt*2; discMesh.position.y=.07+Math.sin(now/400)*.1;
    if(playerGroup.position.distanceTo(discMesh.position)<1.8){ discGot=true; showReady(); }
  }

  /* ─ RAIN ANIM (screen 3) ─ */
  if(levelNodes._rain){
    var pos=levelNodes._rain.geometry.attributes.position;
    for(var i=0;i<pos.count;i++){ pos.setY(i,pos.getY(i)−.12); if(pos.getY(i)<0) pos.setY(i,10); }
    pos.needsUpdate=true;
  }

  /* ─ NEON FLICKER ─ */
  pointLights.forEach(function(pl){ pl.l.intensity=pl.base*(0.88+Math.sin(now/180+pl.offset)*.12); });

  /* ─ CAMERA ─ */
  updateCamera(dt);

  renderer.render(scene,camera);
}

/* ── INPUT ───────────────────────────────────────────────── */
function padBtn(id,dn,up){
  var el=document.getElementById(id);if(!el)return;
  function d(e){e.preventDefault();e.stopPropagation();el.classList.add("on");if(dn)dn();}
  function u(e){e.preventDefault();e.stopPropagation();el.classList.remove("on");if(up)up();}
  el.addEventListener("touchstart",d,{passive:false});el.addEventListener("touchend",u,{passive:false});el.addEventListener("touchcancel",u,{passive:false});
  el.addEventListener("mousedown",d);el.addEventListener("mouseup",u);el.addEventListener("mouseleave",u);
}
// D-PAD: UP=forward, DOWN=back, LEFT=turn left, RIGHT=turn right
padBtn("dU",function(){K.F=true;},function(){K.F=false;});
padBtn("dD",function(){K.B=true;},function(){K.B=false;});
padBtn("dL",function(){K.L=true;},function(){K.L=false;});
padBtn("dR",function(){K.R=true;},function(){K.R=false;});
padBtn("aJ",function(){K.J=true;},function(){K.J=false;});
padBtn("aF",function(){K.fire=true;if(fireCd<=0){fireP();fireCd=.22;}},function(){K.fire=false;});

document.addEventListener("keydown",function(e){
  if(e.code==="ArrowUp"||e.code==="KeyW")   K.F=true;
  if(e.code==="ArrowDown"||e.code==="KeyS")  K.B=true;
  if(e.code==="ArrowLeft"||e.code==="KeyA")  K.L=true;
  if(e.code==="ArrowRight"||e.code==="KeyD") K.R=true;
  if(e.code==="Space") K.J=true;
  if(e.code==="KeyZ"||e.code==="KeyX"){K.fire=true;if(fireCd<=0){fireP();fireCd=.22;}}
});
document.addEventListener("keyup",function(e){
  if(e.code==="ArrowUp"||e.code==="KeyW")    K.F=false;
  if(e.code==="ArrowDown"||e.code==="KeyS")   K.B=false;
  if(e.code==="ArrowLeft"||e.code==="KeyA")   K.L=false;
  if(e.code==="ArrowRight"||e.code==="KeyD")  K.R=false;
  if(e.code==="Space") K.J=false;
  if(e.code==="KeyZ"||e.code==="KeyX") K.fire=false;
});

/* ── INIT ────────────────────────────────────────────────── */
buildPlayer();
buildBoss();

var started=false;
function doStart(){
  if(started)return;started=true;
  hideOv("ovS");
  BGM.play().catch(function(){});
  goS(1);
  loop();
}
document.getElementById("btnS").addEventListener("click",doStart);
document.getElementById("btnS").addEventListener("touchstart",function(e){e.preventDefault();doStart();},{passive:false});

upLives(); upHP();

})();
