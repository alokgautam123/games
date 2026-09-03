(() => {
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const ui = Object.fromEntries(['time','stars','score','danger','routeWarning','powerBadge','toast','startPanel','endPanel','endIcon','endTitle','endText','finalStars','finalScore','best','paused','pause','sound','fullscreen','levelName','introKicker','introTitle','introText','start'].map(id => [id, $(id)]));
  const keys = {up:false,down:false,left:false,right:false};
  const levels={
    1:{name:'SUNNY SQUARE',cops:3,copMin:91,copMax:105,dogAt:40,backupAt:25,pickupMin:3.5,pickupMax:5.5,oneWayAt:42,oneWayCycle:7,playerSpeed:235},
    2:{name:'MARKET MAYHEM',cops:4,copMin:103,copMax:116,dogAt:18,backupAt:34,pickupMin:4.5,pickupMax:6.5,oneWayAt:14,oneWayCycle:5,playerSpeed:240}
  };
  let level=1,wonLast=false,w=0,h=0,dpr=1,last=0,state='menu',paused=false,sound=true,elapsed=0,stars=0,score=0,best=Number(localStorage.getItem('chaseZoneBest')||0),freeze=0,boost=0,toastTimer=0,oneWayUntil=0,nextPickup=0;
  let player,enemies,pickups,confetti;
  const rnd=(a,b)=>a+Math.random()*(b-a), clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  function resize(){
    dpr=Math.min(devicePixelRatio||1,2); w=innerWidth; h=innerHeight;
    canvas.width=Math.round(w*dpr); canvas.height=Math.round(h*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    if(player){player.x=clamp(player.x,34,w-34);player.y=clamp(player.y,155,h-34);}
  }
  addEventListener('resize',resize); resize();

  function beep(freq=500,duration=.08){
    if(!sound)return; const AC=window.AudioContext||window.webkitAudioContext; if(!AC)return;
    const ac=beep.ac||(beep.ac=new AC()),o=ac.createOscillator(),g=ac.createGain(); o.frequency.value=freq;o.type='triangle';g.gain.setValueAtTime(.08,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+duration);o.connect(g).connect(ac.destination);o.start();o.stop(ac.currentTime+duration);
  }
  function showToast(text){ui.toast.textContent=text;ui.toast.classList.add('show');toastTimer=1.2;}
  function spawnEnemy(type='cop'){
    const cfg=levels[level];
    const pad=45, side=Math.floor(Math.random()*4); let x,y;
    if(side===0){x=rnd(pad,w-pad);y=145}else if(side===1){x=w-pad;y=rnd(165,h-pad)}else if(side===2){x=rnd(pad,w-pad);y=h-pad}else{x=pad;y=rnd(165,h-pad)}
    enemies.push({x,y,type,r:type==='dog'?20:23,speed:type==='dog'?(level===2?140:126):rnd(cfg.copMin,cfg.copMax),phase:rnd(0,6.2),yield:0});
  }
  function spawnPickup(){
    const r=Math.random(),type=r<.62?'star':r<.82?'freeze':'boost';
    pickups.push({x:rnd(55,w-55),y:rnd(180,h-55),type,r:18,life:12,bob:rnd(0,6.2)});
  }
  function reset(){
    const cfg=levels[level];
    elapsed=stars=score=freeze=boost=toastTimer=oneWayUntil=0;nextPickup=1.5;paused=false;
    player={x:w/2,y:h*.66,r:22,speed:cfg.playerSpeed};enemies=[];pickups=[];confetti=[];
    for(let i=0;i<cfg.cops;i++)spawnEnemy(); updateUi();
  }
  function start(){reset();state='play';ui.startPanel.classList.remove('open');ui.endPanel.classList.remove('open');ui.paused.classList.remove('show');last=performance.now();beep(620,.12);}
  function sector(e){const dx=e.x-player.x,dy=e.y-player.y;if(Math.abs(dx)>Math.abs(dy))return dx>0?'right':'left';return dy>0?'down':'up'}
  function routeDirector(){
    const cfg=levels[level];
    const near=enemies.filter(e=>Math.hypot(e.x-player.x,e.y-player.y)<185).sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y));
    const occupied=new Set(); let maxBlocked=2;
    if(elapsed>cfg.oneWayAt && Math.floor(elapsed/cfg.oneWayCycle)%2===0){maxBlocked=3;oneWayUntil=Math.max(oneWayUntil,elapsed+.35)}
    near.forEach(e=>{const s=sector(e);if(!occupied.has(s)&&occupied.size<maxBlocked){occupied.add(s);e.yield=0}else e.yield=.45});
    const one=occupied.size===3;
    ui.routeWarning.classList.toggle('show',one);ui.danger.textContent=one?'ONE WAY':occupied.size===2?'WATCH OUT':'SAFE';ui.danger.style.color=one?'#ff4967':occupied.size===2?'#ed8a19':'#25a864';
  }
  function update(dt){
    const cfg=levels[level];
    if(state!=='play'||paused)return;
    elapsed+=dt;freeze=Math.max(0,freeze-dt);boost=Math.max(0,boost-dt);toastTimer=Math.max(0,toastTimer-dt);ui.toast.classList.toggle('show',toastTimer>0);
    let dx=(keys.right?1:0)-(keys.left?1:0),dy=(keys.down?1:0)-(keys.up?1:0),len=Math.hypot(dx,dy)||1;
    const speed=player.speed*(boost>0?1.42:1);player.x=clamp(player.x+dx/len*speed*dt,30,w-30);player.y=clamp(player.y+dy/len*speed*dt,150,h-30);
    if(elapsed>cfg.backupAt&&enemies.filter(e=>e.type==='cop').length===cfg.cops){spawnEnemy();showToast('🚨 BACKUP ARRIVED!')}
    if(elapsed>cfg.dogAt&&!enemies.some(e=>e.type==='dog')){spawnEnemy('dog');showToast('🐕 POLICE DOG!')}
    routeDirector();
    enemies.forEach(e=>{
      if(freeze>0)return; let vx=player.x-e.x,vy=player.y-e.y,dist=Math.hypot(vx,vy)||1;
      if(e.yield>0){e.yield=Math.max(0,e.yield-dt);const turn=Math.sin(e.phase)>0?1:-1;[vx,vy]=[-vy*turn,vx*turn];dist=Math.hypot(vx,vy)||1}
      const ramp=1+elapsed/180;e.x=clamp(e.x+vx/dist*e.speed*ramp*dt,22,w-22);e.y=clamp(e.y+vy/dist*e.speed*ramp*dt,145,h-22);
      if(Math.hypot(e.x-player.x,e.y-player.y)<e.r+player.r-7)finish(false,e.type);
    });
    nextPickup-=dt;if(nextPickup<=0&&pickups.length<(level===2?3:4)){spawnPickup();nextPickup=rnd(cfg.pickupMin,cfg.pickupMax)}
    pickups.forEach(p=>{p.life-=dt;p.bob+=dt*3;if(Math.hypot(p.x-player.x,p.y-player.y)<p.r+player.r){
      p.life=0;if(p.type==='star'){stars++;score+=150;beep(850);showToast('⭐ STAR +150')}else if(p.type==='freeze'){freeze=3.5;beep(460,.2);showToast('❄️ POLICE FROZEN!')}else{boost=4;beep(720,.18);showToast('👟 SUPER SPEED!')}
    }});pickups=pickups.filter(p=>p.life>0);
    score=Math.floor(elapsed*10)+stars*150;if(elapsed>=60)finish(true);updateUi();
  }
  function updateUi(){const remain=Math.max(0,60-elapsed);ui.time.textContent=`0:${String(Math.ceil(remain)).padStart(2,'0')}`;ui.stars.textContent=stars;ui.score.textContent=String(score).padStart(4,'0');ui.powerBadge.classList.toggle('show',freeze>0||boost>0);ui.powerBadge.textContent=freeze>0?`❄️ FREEZE ${freeze.toFixed(1)}s`:boost>0?`👟 SPEED ${boost.toFixed(1)}s`:''}
  function finish(won,type){if(state!=='play')return;state='end';wonLast=won;best=Math.max(best,score);localStorage.setItem('chaseZoneBest',best);ui.endIcon.textContent=won?'🏆':type==='dog'?'🐕':'👮‍♂️';ui.endTitle.textContent=won?(level===2?'MARKET MASTER!':'YOU ESCAPED!'):'CAUGHT!';ui.endText.textContent=won?(level===1?'Sunny Square is clear. Level 2 is ready!':'You conquered the toughest chase!'):'You were boxed in. Keep moving toward the open side!';ui.finalStars.textContent=stars;ui.finalScore.textContent=score;ui.best.textContent=best;$('again').textContent=won&&level===1?'PLAY LEVEL 2':'PLAY AGAIN';ui.endPanel.classList.add('open');beep(won?900:180,.35)}

  function rounded(x,y,r,c){ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}
  function emoji(text,x,y,size){ctx.save();ctx.font=`${size}px Apple Color Emoji,Segoe UI Emoji`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x,y);ctx.restore()}
  function actorLabel(text,x,y,color){ctx.save();ctx.font='800 11px Inter,sans-serif';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.strokeStyle='#123454';ctx.lineWidth=4;ctx.strokeText(text,x,y);ctx.fillStyle=color;ctx.fillText(text,x,y);ctx.restore()}
  function drawPlayer(p){
    ctx.save();ctx.translate(p.x,p.y);ctx.shadowColor='#184b6b66';ctx.shadowBlur=8;ctx.shadowOffsetY=5;
    rounded(0,8,27,'#fff');rounded(0,5,23,boost>0?'#ffe552':'#ff6c54');
    ctx.shadowColor='transparent';rounded(0,-10,8,'#ffd0a8');ctx.strokeStyle='#123454';ctx.lineWidth=6;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,-1);ctx.lineTo(0,13);ctx.moveTo(0,4);ctx.lineTo(-14,10);ctx.moveTo(0,4);ctx.lineTo(14,-2);ctx.moveTo(0,13);ctx.lineTo(-11,24);ctx.moveTo(0,13);ctx.lineTo(12,23);ctx.stroke();ctx.restore();actorLabel('YOU',p.x,p.y-35,'#123454');
  }
  function drawCop(e){
    ctx.save();ctx.translate(e.x,e.y);ctx.shadowColor='#173e5b66';ctx.shadowBlur=7;ctx.shadowOffsetY=4;rounded(0,5,27,'#fff');rounded(0,4,22,'#3478d4');ctx.shadowColor='transparent';rounded(0,-8,8,'#f2bd92');ctx.fillStyle='#174e94';ctx.fillRect(-11,-18,22,7);ctx.fillStyle='#ffe552';ctx.fillRect(-3,-20,6,5);ctx.fillStyle='#fff';ctx.font='900 13px Inter';ctx.textAlign='center';ctx.fillText('★',0,9);ctx.restore();actorLabel('POLICE',e.x,e.y-35,'#174e94');
  }
  function drawDog(e){
    ctx.save();ctx.translate(e.x,e.y);ctx.shadowColor='#173e5b66';ctx.shadowBlur=7;ctx.shadowOffsetY=4;rounded(0,5,25,'#fff');rounded(0,5,20,'#c97a2e');ctx.fillStyle='#70411e';ctx.beginPath();ctx.moveTo(-16,-7);ctx.lineTo(-24,-20);ctx.lineTo(-6,-13);ctx.moveTo(16,-7);ctx.lineTo(24,-20);ctx.lineTo(6,-13);ctx.fill();rounded(-7,1,3,'#172e3e');rounded(7,1,3,'#172e3e');rounded(0,10,4,'#172e3e');ctx.restore();actorLabel('DOG',e.x,e.y-31,'#9b4d18');
  }
  function draw(){
    ctx.clearRect(0,0,w,h);ctx.fillStyle=level===2?'#66d9a0':'#84df60';ctx.fillRect(0,0,w,h);
    // Sunny plaza and open paths
    ctx.fillStyle=level===2?'#ffcb7a':'#f8df9a';ctx.fillRect(w*.42,125,w*.16,h);ctx.fillRect(0,h*.48,w,h*.18);
    ctx.fillStyle=level===2?'#ffe3a8':'#fff1bd';ctx.fillRect(w*.465,125,w*.07,h);ctx.fillRect(0,h*.535,w,h*.07);
    // Park features kept near edges so the chase area stays readable.
    ctx.fillStyle=level===2?'#f06d75':'#43bde9';ctx.strokeStyle='#fff';ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(w*.18,h*.31,Math.min(85,w*.1),45,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#ffe663';ctx.fillRect(w*.72,h*.25,Math.min(150,w*.18),55);ctx.fillStyle='#ff6f6f';ctx.fillRect(w*.72,h*.25-12,Math.min(150,w*.18),18);
    for(let i=0;i<18;i++){const x=(i%6)*(w/5.5)+30,y=175+Math.floor(i/6)*(h-220)/2;emoji(level===2?(i%3?'🧺':'⛱️'):(i%3?'🌳':'🌸'),x,y,28)}
    ctx.strokeStyle='#ffffff99';ctx.lineWidth=4;ctx.setLineDash([12,12]);ctx.strokeRect(18,137,w-36,h-155);ctx.setLineDash([]);
    pickups.forEach(p=>{rounded(p.x,p.y+3,24,'#ffffffcc');emoji(p.type==='star'?'⭐':p.type==='freeze'?'❄️':'👟',p.x,p.y+Math.sin(p.bob)*4,28)});
    enemies.forEach(e=>e.type==='dog'?drawDog(e):drawCop(e));
    if(player)drawPlayer(player);
    if(freeze>0){ctx.fillStyle='#b9f4ff55';ctx.fillRect(0,135,w,h-135)}
  }
  function loop(now){const dt=Math.min(.035,(now-last)/1000||0);last=now;try{update(dt)}catch(error){console.error('Chase update error:',error)}try{draw()}catch(error){console.error('Chase draw error:',error)}requestAnimationFrame(loop)}requestAnimationFrame(loop);

  function bindButton(id,key){const b=$(id),on=e=>{e.preventDefault();keys[key]=true;b.classList.add('pressed')},off=e=>{e.preventDefault();keys[key]=false;b.classList.remove('pressed')};b.addEventListener('pointerdown',on);['pointerup','pointercancel','pointerleave'].forEach(n=>b.addEventListener(n,off))}
  [['up','up'],['down','down'],['left','left'],['right','right']].forEach(x=>bindButton(...x));
  const map={ArrowUp:'up',w:'up',W:'up',ArrowDown:'down',s:'down',S:'down',ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right'};
  addEventListener('keydown',e=>{if(map[e.key]){keys[map[e.key]]=true;e.preventDefault()}if((e.key==='p'||e.key==='P')&&!e.repeat)togglePause()});addEventListener('keyup',e=>{if(map[e.key])keys[map[e.key]]=false});
  function togglePause(){if(state!=='play')return;paused=!paused;ui.paused.classList.toggle('show',paused);ui.pause.textContent=paused?'▶':'Ⅱ'}
  function chooseLevel(next){level=next;document.querySelectorAll('.level-pick').forEach(b=>b.classList.toggle('selected',Number(b.dataset.level)===level));ui.levelName.textContent=`LEVEL ${level} · ${levels[level].name}`;ui.introTitle.textContent=levels[level].name;ui.introKicker.textContent=level===1?'BEGINNER CHASE':'ADVANCED CHASE';ui.introText.textContent=level===1?'Three police close in gradually. Read the open paths, grab stars, and survive for 60 seconds.':'Four faster police start immediately, the dog arrives early, one-way escapes happen more often, and power-ups are rarer.';ui.start.textContent=`START LEVEL ${level}`;updateUi()}
  document.querySelectorAll('.level-pick').forEach(b=>b.onclick=()=>chooseLevel(Number(b.dataset.level)));
  ui.start.onclick=start;$('again').onclick=()=>{if(wonLast&&level===1)chooseLevel(2);start()};ui.pause.onclick=togglePause;ui.sound.onclick=()=>{sound=!sound;ui.sound.textContent=sound?'🔊':'🔇'};ui.fullscreen.onclick=()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen?.();else document.exitFullscreen?.()};
  chooseLevel(1);
  draw();
})();
