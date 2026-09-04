export const RED='#ff2738',PLAYER_RADIUS=9,RUN_TIME=120;
export function circleCircle(a,b,pad=0){return Math.hypot(a.x-b.x,a.y-b.y)<a.r+b.r-pad}
export function circleRect(c,r,pad=0){const x=Math.max(r.x,Math.min(c.x,r.x+r.w)),y=Math.max(r.y,Math.min(c.y,r.y+r.h));return Math.hypot(c.x-x,c.y-y)<c.r-pad}
export function circleSegment(c,s,pad=0){const vx=s.x2-s.x1,vy=s.y2-s.y1,l=vx*vx+vy*vy||1,t=Math.max(0,Math.min(1,((c.x-s.x1)*vx+(c.y-s.y1)*vy)/l)),x=s.x1+t*vx,y=s.y1+t*vy;return Math.hypot(c.x-x,c.y-y)<c.r+s.width/2-pad}
export const PHASE_TIMES=[0,15,30,45,60,75,90,102,110,120];
export function phaseAt(t){for(let i=PHASE_TIMES.length-2;i>=0;i--)if(t>=PHASE_TIMES[i])return i;return 0}
export function phaseProgress(t){const i=phaseAt(t);return Math.max(0,Math.min(1,(t-PHASE_TIMES[i])/(PHASE_TIMES[i+1]-PHASE_TIMES[i]))) }
export function collides(player,hazards){for(const h of hazards){if(!h.red)continue;if(h.kind==='circle'&&circleCircle(player,h,1))return h;if(h.kind==='rect'&&circleRect(player,h,1))return h;if(h.kind==='segment'&&circleSegment(player,h,1))return h}return null}
export function finalSafe(player,safe,active){return active&&!circleCircle(player,{...safe,r:Math.max(0,safe.r-player.r)},0)}
