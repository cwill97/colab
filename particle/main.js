// THREE SETUP
const scene=new THREE.Scene();scene.background=new THREE.Color(0x000000);
const camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,0.1,100);camera.position.z=6;
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);document.body.appendChild(renderer.domElement);

// SVG HIRES TEXTURE
const img=new Image();img.src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjgyIiBoZWlnaHQ9IjQ5IiB2aWV3Qm94PSIwIDAgMjgyIDQ5IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cGF0aCBkPSJNMjEuNjI0MSA0OC45NjYzQzkuMTM2IDQ4Ljk2NjMgMCAzOS42OTg5IDAgMjQuNTE2QzAgOS4zMzMxOCA5LjEzNiAwLjA2NTcyNTggMjEuNjI0MSAwLjA2NTcyNThDMzAuODI1OCAwLjA2NTcyNTggMzkuMTczMSA0Ljg2Mzc3IDQxLjUzOTIgMTYuMTY4OEgzNS45NTI1QzMzLjg0OTIgOC4wMTg2NSAyNy45MzM4IDUuMTI2NjggMjEuNjI0MSA1LjEyNjY4QzEyLjE1OTQgNS4xMjY2OCA1Ljc4Mzk0IDEyLjI5MDkgNS43ODM5NCAyNC41MTZDNS43ODM5NCAzNi43NDEyIDEyLjE1OTQgNDMuOTA1NCAyMS42MjQxIDQzLjkwNTRDMjguMjYyNSA0My45MDU0IDM1LjA5OCAzOS44OTYxIDM2LjI4MTEgMzAuODkxNUg0MS44MDIxQzQwLjYxOTEgNDMuMTE2NyAzMS4yMjAyIDQ4Ljk2NjMgMjEuNjI0MSA0OC45NjYzWiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTY5LjE1NTcgNDguOTY2M0M1NS41NTAzIDQ4Ljk2NjMgNDYuNzQyOSAzOS4wNDE2IDQ2Ljc0MjkgMjQuNTE2QzQ2Ljc0MjkgOS45OTA0NSA1NS41NTAzIDAuMDY1NzI1OCA2OS4xNTU3IDAuMDY1NzI1OEM4Mi43NjExIDAuMDY1NzI1OCA5MS41Njg1IDkuOTkwNDUgOTEuNTY4NSAyNC41MTZDOTEuNTY4NSAzOS4wNDE2IDgyLjc2MTEgNDguOTY2MyA2OS4xNTU3IDQ4Ljk2NjNaTTY5LjE1NTcgNDMuOTA1NEM3OS4yMTE5IDQzLjkwNTQgODUuNzg0NiAzNi40MTI2IDg1Ljc4NDYgMjQuNTE2Qzg1Ljc4NDYgMTIuNjE5NSA3OS4yMTE5IDUuMTI2NjggNjkuMTU1NyA1LjEyNjY4QzU5LjA5OTUgNS4xMjY2OCA1Mi41MjY5IDEyLjYxOTUgNTIuNTI2OSAyNC41MTZDNTIuNTI2OSAzNi40MTI2IDU5LjA5OTUgNDMuOTA1NCA2OS4xNTU3IDQzLjkwNTRaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMTA0LjExOSAyMi4yODEzSDk3LjQ4MDhWMTUuNzA4N0gxMDQuMTE5VjIyLjI4MTNaTTEwNC4xMTkgNDcuOTE0N0g5Ny40ODA4VjQxLjM0MjFIMTA0LjExOVY0Ny45MTQ3WiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTExNy41NTQgMS4xMTczNVY0Mi45MTk1SDE0MS4wODRWNDcuOTE0N0gxMTIuMDMzVjEuMTE3MzVIMTE3LjU1NFoiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik0xODcuMTk3IDQ3LjkxNDdIMTgxLjM0N0wxNzUuODkyIDM0LjMwOTNIMTU0LjU5NkwxNDkuMjA3IDQ3LjkxNDdIMTQzLjQyM0wxNjIuMDg5IDEuMTE3MzVIMTY4LjI2N0wxODcuMTk3IDQ3LjkxNDdaTTE1Ni43NjUgMjguNzg4M0wxNTYuNTY4IDI5LjMxNDFIMTczLjkyTDE3My42NTcgMjguNzIyNUMxNzEuNjE5IDIzLjY2MTYgMTY3LjkzOSAxNC4zMjg0IDE2NS4xMTIgNy4wOTg0N0MxNjIuNDE4IDE0LjMyODQgMTU4LjgwMyAyMy42NjE2IDE1Ni43NjUgMjguNzg4M1oiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik0yMTkuMzg3IDIzLjU5NTlDMjI1LjE3MSAyNS43NjQ4IDIyNy40NzEgMzAuMTAyOCAyMjcuNDcxIDM0Ljc2OTRDMjI3LjQ3MSA0Mi42NTY2IDIyMi4yNzkgNDcuOTE0NyAyMTIuMjg4IDQ3LjkxNDdIMTkxLjg0N1YxLjExNzM1SDIxMS4zMDJDMjIxLjAzIDEuMTE3MzUgMjI1LjU2NSA2LjcwNDEyIDIyNS41NjUgMTMuMzQyNUMyMjUuNTY1IDE4LjAwOTEgMjIzLjMzIDIxLjQ5MjYgMjE5LjM4NyAyMy41OTU5Wk0yMTAuOTA4IDYuMTEyNThIMTk3LjM2OFYyMS41NTgzSDIxMC45MDhDMjE3LjE1MiAyMS41NTgzIDIyMC4xNzUgMTguNTM0OSAyMjAuMTc1IDEzLjUzOTdDMjIwLjE3NSA5LjEzNiAyMTcuMTUyIDYuMTEyNTggMjEwLjkwOCA2LjExMjU4Wk0xOTcuMzY4IDQyLjkxOTVIMjEyLjAyNUMyMTguNTk4IDQyLjkxOTUgMjIxLjk1IDM5LjgzMDMgMjIxLjk1IDM0Ljc2OTRDMjIxLjk1IDI5LjA1MTIgMjE4LjIwNCAyNi40ODc4IDIxMS45NiAyNi40ODc4SDE5Ny4zNjhWNDIuOTE5NVoiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik0yNTYuNjQzIDQ4Ljk2NjNDMjQyLjQ0NiA0OC45NjYzIDIzMi4wNjEgMzguMTIxNCAyMzIuMDYxIDI0LjUxNkMyMzIuMDYxIDEwLjg0NDkgMjQyLjQ0NiAwIDI1Ni42NDMgMEMyNzAuOTA2IDAgMjgxLjI5IDEwLjg0NDkgMjgxLjI5IDI0LjUxNkMyODEuMjkgMzguMTIxNCAyNzAuOTA2IDQ4Ljk2NjMgMjU2LjY0MyA0OC45NjYzWk0yNTYuNjQzIDQ0LjgyNTZDMjY4LjQwOCA0NC44MjU2IDI3Ni44MjEgMzUuODg2NyAyNzYuODIxIDI0LjUxNkMyNzYuODIxIDEzLjA3OTYgMjY4LjQwOCA0LjE0MDc4IDI1Ni42NDMgNC4xNDA3OEMyNDQuOTQ0IDQuMTQwNzggMjM2LjUzMSAxMy4wNzk2IDIzNi41MzEgMjQuNTE2QzIzNi41MzEgMzUuODg2NyAyNDQuOTQ0IDQ0LjgyNTYgMjU2LjY0MyA0NC44MjU2Wk0yNTYuOTA2IDM5LjMwNDVDMjQ5LjAxOSAzOS4zMDQ1IDI0My44MjYgMzMuNDU0OSAyNDMuODI2IDI0LjUxNkMyNDMuODI2IDE1LjUxMTUgMjQ4Ljk1MyA5LjcyNzU0IDI1Ni45MDYgOS43Mjc1NEMyNjMuNjc2IDkuNzI3NTQgMjY4LjI3NyAxMy43MzY5IDI2OS4xMzEgMjAuMTEyNEgyNjQuMzMzQzI2My42MSAxNS45MDU4IDI2MC40NTUgMTMuODY4MyAyNTYuOTA2IDEzLjg2ODNDMjUxLjc3OSAxMy44NjgzIDI0OC42MjQgMTcuODExOSAyNDguNjI0IDI0LjUxNkMyNDguNjI0IDMxLjE1NDQgMjUxLjc3OSAzNS4wOTggMjU2LjkwNiAzNS4wOThDMjYwLjQ1NSAzNS4wOTggMjYzLjY3NiAzMy4wNjA1IDI2NC4zMzMgMjguNzg4M0gyNjkuMTMxQzI2OC4yMTEgMzUuMTYzNyAyNjMuNTQ0IDM5LjMwNDUgMjU2LjkwNiAzOS4zMDQ1WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cg==";
const canvas=document.createElement("canvas");const R=2048;canvas.width=R;canvas.height=R;
const ctx=canvas.getContext("2d");
const tex=new THREE.CanvasTexture(canvas);
tex.minFilter=THREE.LinearMipMapLinearFilter;tex.magFilter=THREE.LinearFilter;tex.anisotropy=renderer.capabilities.getMaxAnisotropy();
img.onload=()=>{const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height;
ctx.clearRect(0,0,R,R);const s=Math.min(R/iw,R/ih);const w=iw*s,h=ih*s;
ctx.drawImage(img,(R-w)/2,(R-h)/2,w,h);tex.needsUpdate=true;};

// POINT CLOUD
const cube=new THREE.Group();const size=3.2,steps=8,step=size/(steps-1);
for(let x=0;x<steps;x++)for(let y=0;y<steps;y++)for(let z=0;z<steps;z++){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true}));
sp.scale.set(0.35,0.18,1);sp.position.set(-size/2+x*step,-size/2+y*step,-size/2+z*step);cube.add(sp);}
scene.add(cube);

// STATE
const INIT_POS=cube.position.clone();const INIT_SCALE=cube.scale.x;
let targetPos=INIT_POS.clone(),targetScale=INIT_SCALE;
let smoothedPos=INIT_POS.clone(),smoothedScale=INIT_SCALE;
let rotVel=new THREE.Vector2(0,0),smoothedRot=new THREE.Vector2(0,0);
let inactive=true;
let twoStartCentroid=null,twoStartPos=null;

// HELPERS
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function isOpen(h){const p=h[0],tips=[h[4],h[8],h[12],h[16],h[20]];let c=0;tips.forEach(t=>{if(dist(t,p)<0.045)c++;});return c<tips.length;}
const centroid=arr=>{let x=0,y=0;arr.forEach(p=>{x+=p.x;y+=p.y;});return{x:x/arr.length,y:y/arr.length};}

// MEDIAPIPE
const video=document.getElementById("video");
const hands=new Hands({locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`});
hands.setOptions({maxNumHands:2,modelComplexity:1,minDetectionConfidence:0.6,minTrackingConfidence:0.6});
let lastAng=null,lastY=null;
hands.onResults(res=>{
 if(!res.multiHandLandmarks||res.multiHandLandmarks.length===0){inactive=true;targetPos.copy(INIT_POS);targetScale=INIT_SCALE;twoStartCentroid=null;return;}
 const arr=res.multiHandLandmarks,open=arr.filter(isOpen);inactive=open.length!==arr.length;
 if(inactive){targetPos.copy(INIT_POS);targetScale=INIT_SCALE;twoStartCentroid=null;return;}

 if(open.length===1){const h=open[0],p=h[0],tips=[h[4],h[8],h[12],h[16],h[20]],c=centroid(tips);
 const ang=Math.atan2(c.y-p.y,c.x-p.x);
 if(lastAng!==null){let d=ang-lastAng;if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;rotVel.y+=d*0.8;}
 lastAng=ang;
 if(lastY!==null)rotVel.x+=(c.y-lastY)*1.0;lastY=c.y;
 } else {lastAng=null;lastY=null;}

 if(open.length===2){const a=open[0][0],b=open[1][0];const cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;
 if(!twoStartCentroid){twoStartCentroid={x:cx,y:cy};twoStartPos=targetPos.clone();}
 const dx=cx-twoStartCentroid.x,dy=cy-twoStartCentroid.y;
 const RANGE=10;
 const desiredX=twoStartPos.x+(-dx*RANGE),desiredY=twoStartPos.y+(-dy*RANGE);
 targetPos.x+= (desiredX-targetPos.x)*0.35;targetPos.y+=(desiredY-targetPos.y)*0.35;
 const d=dist(a,b);let raw=Math.pow(d,1.3)*6;raw=Math.max(0.2,Math.min(raw,4));
 if(Math.abs(raw-targetScale)>0.03)targetScale=raw;
 } else {twoStartCentroid=null;}
});

new Camera(video,{onFrame:async()=>{await hands.send({image:video});},width:640,height:480}).start();

function animate(){requestAnimationFrame(animate);
 if(inactive){cube.rotation.y+=0.001;rotVel.set(0,0);}
 else{smoothedRot.x+=(rotVel.x-smoothedRot.x)*0.15;smoothedRot.y+=(rotVel.y-smoothedRot.y)*0.15;
 cube.rotation.x+=smoothedRot.x;cube.rotation.y+=smoothedRot.y;rotVel.multiplyScalar(0.85);}
 smoothedPos.lerp(targetPos,0.08);cube.position.copy(smoothedPos);
 smoothedScale+=(targetScale-smoothedScale)*0.08;cube.scale.set(smoothedScale,smoothedScale,smoothedScale);
 renderer.render(scene,camera);}
animate();
window.onresize=()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);};
