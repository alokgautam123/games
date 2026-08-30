"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const $ = id => document.getElementById(id);
const ui = { score:$("score"), coins:$("coins"), speed:$("speed"), fuel:$("fuelBar"), lives:$("lives"), message:$("message"), start:$("startPanel"), end:$("endPanel"), best:$("bestScore"), finalScore:$("finalScore"), finalCoins:$("finalCoins"), endTitle:$("endTitle"), boost:$("boostButton"), sound:$("soundButton") };

const W=480,H=720, ROAD_LEFT=65,ROAD_RIGHT=415,LANES=[123,240,357];
const colors=["#ff3f68","#ffb52c","#35d5ff","#9c6cff","#48dd78"];
let state, animationId, previousTime=0, audioContext, soundOn=true, messageTimer;
const keys={left:false,right:false,boost:false};

function freshState(){
  return {running:false,paused:false,time:0,score:0,coins:0,lives:3,fuel:100,turbo:100,speed:260,roadOffset:0,spawnTimer:0,coinTimer:1,invincible:0,boosting:false,
    player:{x:240,y:590,w:52,h:92,vx:0}, objects:[], particles:[]};
}
state=freshState();

function beep(freq,duration,type="sine",volume=.08){
  if(!soundOn)return;
  try{ audioContext ||= new(window.AudioContext||window.webkitAudioContext)(); const o=audioContext.createOscillator(),g=audioContext.createGain(); o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,audioContext.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+duration);o.connect(g).connect(audioContext.destination);o.start();o.stop(audioContext.currentTime+duration); }catch(_){ }
}

function roundedRect(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=3;ctx.stroke();}}
function drawCar(x,y,w,h,color,player=false){
  ctx.save();ctx.translate(x,y);
  ctx.fillStyle="#090c12";ctx.fillRect(-w/2-5,-h*.3,8,h*.22);ctx.fillRect(w/2-3,-h*.3,8,h*.22);ctx.fillRect(-w/2-5,h*.16,8,h*.22);ctx.fillRect(w/2-3,h*.16,8,h*.22);
  roundedRect(-w/2,-h/2,w,h,12,color,"#0b1020");
  ctx.fillStyle=player?"#d9f8ff":"#a8cae3";ctx.beginPath();ctx.moveTo(-w*.32,-h*.17);ctx.lineTo(-w*.22,-h*.34);ctx.lineTo(w*.22,-h*.34);ctx.lineTo(w*.32,-h*.17);ctx.closePath();ctx.fill();
  ctx.fillStyle="#22324c";roundedRect(-w*.3,-h*.08,w*.6,h*.27,5,"#263a55");
  ctx.fillStyle="#fff7a6";ctx.fillRect(-w*.32,-h*.46,w*.18,6);ctx.fillRect(w*.14,-h*.46,w*.18,6);
  ctx.fillStyle="#ff2b45";ctx.fillRect(-w*.32,h*.39,w*.18,6);ctx.fillRect(w*.14,h*.39,w*.18,6);
  if(player){ctx.fillStyle="#fff";ctx.fillRect(-4,-h*.48,8,h*.96);ctx.fillStyle="#24dfff";ctx.fillRect(-w*.34,h*.08,5,h*.2);ctx.fillRect(w*.29,h*.08,5,h*.2);}
  ctx.restore();
}

function drawRoad(){
  ctx.fillStyle="#263821";ctx.fillRect(0,0,W,H);
  for(let y=-50+(state.roadOffset*.45)%80;y<H;y+=80){ctx.fillStyle="#31522d";ctx.fillRect(8,y,45,38);ctx.fillRect(427,y+25,45,38);}
  ctx.fillStyle="#b52336";ctx.fillRect(ROAD_LEFT-12,0,12,H);ctx.fillRect(ROAD_RIGHT,0,12,H);
  ctx.fillStyle="#f4e9cf";for(let y=-28+state.roadOffset%56;y<H;y+=56){ctx.fillRect(ROAD_LEFT-12,y,12,28);ctx.fillRect(ROAD_RIGHT,y,12,28);}
  ctx.fillStyle="#363b48";ctx.fillRect(ROAD_LEFT,0,ROAD_RIGHT-ROAD_LEFT,H);
  ctx.fillStyle="rgba(255,255,255,.08)";ctx.fillRect(ROAD_LEFT+9,0,8,H);ctx.fillRect(ROAD_RIGHT-17,0,8,H);
  ctx.fillStyle="#e9e6d7";for(const x of [181,299])for(let y=-80+state.roadOffset%120;y<H;y+=120)ctx.fillRect(x-3,y,6,62);
}

function spawn(type,lane=Math.floor(Math.random()*3)){
  if(type==="car")state.objects.push({type,x:LANES[lane],y:-100,w:49,h:86,speed:70+Math.random()*100,color:colors[Math.floor(Math.random()*colors.length)]});
  if(type==="coin")state.objects.push({type,x:LANES[lane],y:-25,r:14,speed:15,spin:0});
  if(type==="fuel")state.objects.push({type,x:LANES[lane],y:-35,w:35,h:42,speed:20});
}

function update(dt){
  if(!state.running||state.paused)return;
  state.time+=dt;state.speed=Math.min(510,260+state.time*5.5);state.boosting=keys.boost&&state.turbo>0;
  const actualSpeed=state.speed*(state.boosting?1.55:1);state.roadOffset+=actualSpeed*dt;
  state.fuel-=dt*(1.55+(state.boosting?.7:0));state.turbo=Math.max(0,Math.min(100,state.turbo+dt*(state.boosting?-28:5)));
  state.invincible=Math.max(0,state.invincible-dt);state.score+=actualSpeed*dt*.12;
  if(state.fuel<=0){state.fuel=0;endGame("OUT OF FUEL!");return;}
  const accel=900,maxV=330; if(keys.left)state.player.vx-=accel*dt;if(keys.right)state.player.vx+=accel*dt;if(!keys.left&&!keys.right)state.player.vx*=Math.pow(.002,dt);
  state.player.vx=Math.max(-maxV,Math.min(maxV,state.player.vx));state.player.x+=state.player.vx*dt;state.player.x=Math.max(ROAD_LEFT+31,Math.min(ROAD_RIGHT-31,state.player.x));
  state.spawnTimer-=dt;if(state.spawnTimer<=0){spawn("car");state.spawnTimer=Math.max(.48,1.1-state.time*.008)+Math.random()*.42;}
  state.coinTimer-=dt;if(state.coinTimer<=0){spawn(Math.random()<.16?"fuel":"coin");state.coinTimer=.7+Math.random()*1.25;}
  for(const o of state.objects){o.y+=(actualSpeed+o.speed)*dt;if(o.spin!==undefined)o.spin+=dt*6;}
  collisions();state.objects=state.objects.filter(o=>o.y<H+120&&!o.remove);
  for(const p of state.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;p.vy+=120*dt;}state.particles=state.particles.filter(p=>p.life>0);
  updateUI();
}

function overlaps(o){const p=state.player;if(o.type==="coin")return Math.hypot(p.x-o.x,p.y-o.y)<p.w*.45+o.r;return Math.abs(p.x-o.x)<(p.w+o.w)*.42&&Math.abs(p.y-o.y)<(p.h+o.h)*.43;}
function collisions(){
  for(const o of state.objects){if(o.remove||!overlaps(o))continue;
    if(o.type==="coin"){o.remove=true;state.coins++;state.score+=250;burst(o.x,o.y,"#ffd62e",8);notify("+250 COIN!","#ffd62e");beep(760,.08);}
    else if(o.type==="fuel"){o.remove=true;state.fuel=Math.min(100,state.fuel+32);state.score+=100;burst(o.x,o.y,"#53e884",10);notify("FUEL +32","#53e884");beep(520,.12);}
    else if(state.invincible<=0){o.remove=true;state.lives--;state.invincible=1.8;state.speed=Math.max(240,state.speed-55);burst(state.player.x,state.player.y,"#ff553d",16);notify("CRASH!","#ff526d");beep(95,.35,"sawtooth",.12);if(state.lives<=0){endGame("CAR WRECKED!");return;}}
  }
}
function burst(x,y,color,count){for(let i=0;i<count;i++)state.particles.push({x,y,color,vx:(Math.random()-.5)*220,vy:(Math.random()-.5)*220,life:.5+Math.random()*.5,size:3+Math.random()*6});}
function notify(text,color){clearTimeout(messageTimer);ui.message.textContent=text;ui.message.style.color=color;ui.message.classList.add("show");messageTimer=setTimeout(()=>ui.message.classList.remove("show"),800);}

function drawObjects(){
  for(const o of state.objects){if(o.type==="car")drawCar(o.x,o.y,o.w,o.h,o.color);else if(o.type==="coin"){ctx.save();ctx.translate(o.x,o.y);ctx.scale(.35+Math.abs(Math.cos(o.spin))*.65,1);ctx.fillStyle="#ffd62e";ctx.beginPath();ctx.arc(0,0,o.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#fff19a";ctx.lineWidth=4;ctx.stroke();ctx.fillStyle="#9f6900";ctx.font="bold 16px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("$",0,1);ctx.restore();}else{roundedRect(o.x-o.w/2,o.y-o.h/2,o.w,o.h,6,"#e8414f","#fff");ctx.fillStyle="#fff";ctx.font="bold 19px sans-serif";ctx.textAlign="center";ctx.fillText("F",o.x,o.y+7);}}
}
function draw(){
  drawRoad();drawObjects();
  if(state.boosting){ctx.fillStyle="#29dfff";for(let i=0;i<4;i++){const x=state.player.x+(i%2?14:-14)+(Math.random()-.5)*4,y=state.player.y+48+Math.random()*28;ctx.fillRect(x,y,5,18+Math.random()*20);}}
  if(state.invincible<=0||Math.floor(state.invincible*10)%2===0)drawCar(state.player.x,state.player.y,state.player.w,state.player.h,"#168dff",true);
  for(const p of state.particles){ctx.globalAlpha=Math.min(1,p.life*2);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);ctx.globalAlpha=1;}
  if(state.paused){ctx.fillStyle="rgba(5,9,18,.72)";ctx.fillRect(0,0,W,H);ctx.fillStyle="#fff";ctx.textAlign="center";ctx.font="italic 52px Impact";ctx.fillText("PAUSED",W/2,H/2);ctx.font="18px system-ui";ctx.fillText("Press P to keep racing",W/2,H/2+40);}
}
function updateUI(){ui.score.textContent=Math.floor(state.score).toString().padStart(5,"0");ui.coins.textContent=state.coins;ui.speed.textContent=Math.floor(state.speed*(state.boosting?1.55:1));ui.fuel.style.width=`${state.fuel}%`;ui.lives.textContent="❤️".repeat(state.lives)+"🖤".repeat(3-state.lives);ui.boost.classList.toggle("empty",state.turbo<8);ui.boost.style.opacity=.45+state.turbo/180;}
function frame(now){const dt=Math.min(.033,(now-previousTime)/1000||0);previousTime=now;update(dt);draw();animationId=requestAnimationFrame(frame);}

function startGame(){state=freshState();state.running=true;ui.start.classList.remove("open");ui.end.classList.remove("open");previousTime=performance.now();updateUI();beep(220,.12);setTimeout(()=>beep(330,.12),120);setTimeout(()=>beep(520,.18),240);}
function endGame(title){state.running=false;const score=Math.floor(state.score),best=Math.max(score,Number(localStorage.getItem("turboTrackBest")||0));localStorage.setItem("turboTrackBest",best);ui.endTitle.textContent=title;ui.finalScore.textContent=score;ui.finalCoins.textContent=state.coins;ui.best.textContent=best;setTimeout(()=>ui.end.classList.add("open"),400);}
function setKey(name,value){keys[name]=value;}
function bindHold(button,name){button.addEventListener("pointerdown",e=>{e.preventDefault();setKey(name,true);button.classList.add("pressed");});for(const event of ["pointerup","pointercancel","pointerleave"])button.addEventListener(event,()=>{setKey(name,false);button.classList.remove("pressed");});}
bindHold($("leftButton"),"left");bindHold($("rightButton"),"right");bindHold($("boostButton"),"boost");
window.addEventListener("keydown",e=>{if(["ArrowLeft","ArrowRight","Space"].includes(e.code))e.preventDefault();if(e.code==="ArrowLeft"||e.code==="KeyA")keys.left=true;if(e.code==="ArrowRight"||e.code==="KeyD")keys.right=true;if(e.code==="Space")keys.boost=true;if(e.code==="KeyP"&&state.running)state.paused=!state.paused;});
window.addEventListener("keyup",e=>{if(e.code==="ArrowLeft"||e.code==="KeyA")keys.left=false;if(e.code==="ArrowRight"||e.code==="KeyD")keys.right=false;if(e.code==="Space")keys.boost=false;});
window.addEventListener("blur",()=>{keys.left=keys.right=keys.boost=false;if(state.running)state.paused=true;});
$("startButton").addEventListener("click",startGame);$("againButton").addEventListener("click",startGame);
ui.sound.addEventListener("click",()=>{soundOn=!soundOn;ui.sound.textContent=soundOn?"🔊":"🔇";ui.sound.setAttribute("aria-label",soundOn?"Turn sound off":"Turn sound on");if(soundOn)beep(540,.1);});
ui.best.textContent=localStorage.getItem("turboTrackBest")||"0";updateUI();draw();animationId=requestAnimationFrame(frame);
