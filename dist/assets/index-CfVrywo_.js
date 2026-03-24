(function(){const i=document.createElement("link").relList;if(i&&i.supports&&i.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))a(r);new MutationObserver(r=>{for(const s of r)if(s.type==="childList")for(const c of s.addedNodes)c.tagName==="LINK"&&c.rel==="modulepreload"&&a(c)}).observe(document,{childList:!0,subtree:!0});function n(r){const s={};return r.integrity&&(s.integrity=r.integrity),r.referrerPolicy&&(s.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?s.credentials="include":r.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function a(r){if(r.ep)return;r.ep=!0;const s=n(r);fetch(r.href,s)}})();const g=Math.PI*2,q=2400,I=1800,V=52,re=document.querySelector("#app");re.innerHTML=`
  <div class="app-shell">
    <div class="topbar">
      <div>
        <div class="title">Sailing Sim</div>
        <div class="subtitle">Browser-based top-down prototype. Believable wind, simple trim, marks, and tacking that actually matters.</div>
      </div>
      <div class="topbar-right">
        <div class="pill" id="status-pill">Ready</div>
        <div class="pill">V1: one boat, one lap, shifting breeze</div>
      </div>
    </div>
    <div class="main">
      <div class="stack">
        <div class="panel">
          <div class="panel-title">Controls</div>
          <ul class="controls-list">
            <li><strong>← / →</strong> steer</li>
            <li><strong>↑ / ↓</strong> trim sail in / ease out</li>
            <li><strong>R</strong> reset race</li>
            <li><strong>Space</strong> center camera on boat</li>
          </ul>
        </div>

        <div class="panel">
          <div class="panel-title">What this prototype is modeling</div>
          <ul class="legend">
            <li>No-go zone upwind</li>
            <li>Trim efficiency depends on apparent wind angle</li>
            <li>Keel reduces sideways slip but not perfectly</li>
            <li>Rudder turns better when water is flowing past the hull</li>
            <li>Wind oscillates slowly, so headers/lifts are a thing</li>
          </ul>
        </div>

        <div class="panel">
          <div class="panel-title">Telemetry</div>
          <div class="kpis">
            <div class="kpi"><div class="kpi-label">Boat speed</div><div class="kpi-value" id="kpi-speed">0.0 kt</div></div>
            <div class="kpi"><div class="kpi-label">Heading</div><div class="kpi-value" id="kpi-heading">000°</div></div>
            <div class="kpi"><div class="kpi-label">Wind</div><div class="kpi-value" id="kpi-wind">000°</div></div>
            <div class="kpi"><div class="kpi-label">VMG</div><div class="kpi-value" id="kpi-vmg">0.0 kt</div></div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-title">Notes</div>
          <ul class="notes">
            <li>Green ring = next mark.</li>
            <li>Dashed white line = course to next mark.</li>
            <li>Yellow wedge at bow = no-go zone preview.</li>
            <li>The goal is feel, not naval architecture purity.</li>
          </ul>
          <div class="btn-row" style="margin-top:12px;">
            <button id="reset-btn">Reset race</button>
            <button class="secondary" id="wind-btn">New wind seed</button>
          </div>
        </div>
      </div>

      <div class="viewport-wrap">
        <div class="canvas-shell panel">
          <canvas id="game"></canvas>
          <div class="overlay" id="overlay"><strong>Reach the green mark.</strong> Trim in on reaches, ease on runs, tack upwind.</div>
        </div>
      </div>
    </div>
  </div>
`;const l=document.querySelector("#game"),e=l.getContext("2d"),ae=document.querySelector("#overlay"),le=document.querySelector("#status-pill"),ce=document.querySelector("#kpi-speed"),de=document.querySelector("#kpi-heading"),he=document.querySelector("#kpi-wind"),ue=document.querySelector("#kpi-vmg"),v=new Set,h={x:q/2,y:I/2};function D(t,i){return{x:t,y:i}}function x(t,i){return{x:t.x+i.x,y:t.y+i.y}}function $(t,i){return{x:t.x-i.x,y:t.y-i.y}}function f(t,i){return{x:t.x*i,y:t.y*i}}function T(t,i){return t.x*i.x+t.y*i.y}function w(t){return Math.hypot(t.x,t.y)}function pe(t){const i=w(t)||1;return{x:t.x/i,y:t.y/i}}function y(t){return{x:Math.cos(t),y:Math.sin(t)}}function p(t,i,n){return Math.max(i,Math.min(n,t))}function L(t,i,n){return t+(i-t)*n}function H(t){for(;t<=-Math.PI;)t+=g;for(;t>Math.PI;)t-=g;return t}function fe(t){return(t*180/Math.PI+360)%360}function A(t){return`${String(Math.round((90-fe(t)+360)%360)).padStart(3,"0")}°`}function ve(t,i){return Math.hypot(t.x-i.x,t.y-i.y)}function ye(){return{marks:[{x:520,y:420,radius:24,color:"#ffb84d"},{x:1880,y:520,radius:24,color:"#ff785a"},{x:1720,y:1340,radius:24,color:"#74d99f"},{x:560,y:1240,radius:24,color:"#7ac7ff"}],nextMark:0,lapsDone:0,raceFinished:!1,finishTime:null}}function E(t=Math.random()*g){return{boat:{pos:D(360,940),vel:D(0,0),heading:-.25,angularVel:0,sailTrim:.58,tack:1},windDir:-1,windSpeed:16,windShiftPhase:t,tiller:0,time:0,race:ye(),splashText:"Sail the course. Upwind legs should make you work for it."}}let o=E();function S(t=!1){o=E(t?Math.random()*g:o.windShiftPhase),M(!0)}function M(t=!1){if(t){h.x=o.boat.pos.x,h.y=o.boat.pos.y;return}h.x=L(h.x,o.boat.pos.x,.15),h.y=L(h.y,o.boat.pos.y,.15)}function N(t){return o.windDir+Math.sin(t*.08+o.windShiftPhase)*.38+Math.sin(t*.023+o.windShiftPhase*.7)*.14}function ge(t){o.time+=t,v.has("ArrowLeft")&&(o.tiller-=t*2.2),v.has("ArrowRight")&&(o.tiller+=t*2.2),!v.has("ArrowLeft")&&!v.has("ArrowRight")&&(o.tiller*=Math.pow(1e-4,t)),o.tiller=p(o.tiller,-1,1),v.has("ArrowUp")&&(o.boat.sailTrim+=t*.6),v.has("ArrowDown")&&(o.boat.sailTrim-=t*.6),o.boat.sailTrim=p(o.boat.sailTrim,.05,1);const i=o.boat,n=y(i.heading),a=y(i.heading-Math.PI/2),r=y(i.heading+Math.PI/2),s=N(o.time),c=f(y(s),o.windSpeed),d=$(c,i.vel),b=w(d),B=Math.atan2(d.y,d.x),m=H(B-i.heading);i.tack=m>=0?1:-1;const P=Math.abs(m),W=.7,G=p((P-W)/(Math.PI-W),0,1),U=p((P-.35)/(Math.PI-.35),.08,1),K=Math.abs(i.sailTrim-U),_=Math.max(0,1-K*1.8),F=G*_,Y=n,X=(m>=0?-1:1)>0?r:a,j=b*b*.018*F,R=b*b*.01*F*(1.15-Math.abs(Math.cos(m))),J=T(i.vel,n),Q=T(i.vel,r),Z=p(.35+Math.abs(Math.sin(m))*.85,.35,1.05),ee=f(r,-Q*(2.8+Z*2.5)),te=f(i.vel,-(.22+w(i.vel)*.018)),ie=o.tiller*p(Math.abs(J)/8,0,1)*2.2,ne=R*(i.tack===1?1:-1)*.006,oe=x(x(f(Y,j),f(X,R)),x(ee,te));i.vel=x(i.vel,f(oe,t)),i.pos=x(i.pos,f(i.vel,t*22)),i.angularVel+=(ie+ne-i.angularVel*1.9)*t,i.heading=H(i.heading+i.angularVel*t),i.pos.x=p(i.pos.x,40,q-40),i.pos.y=p(i.pos.y,40,I-40);const u=o.race;if(!u.raceFinished){const se=u.marks[u.nextMark];ve(i.pos,se)<=V&&(u.nextMark+=1,o.splashText=`Mark ${u.nextMark} rounded.`,u.nextMark>=u.marks.length&&(u.raceFinished=!0,u.finishTime=o.time,o.splashText=`Finished in ${o.time.toFixed(1)}s. Not bad.`))}M(),me(m,s)}function me(t,i){const n=o.boat,a=o.race.marks[Math.min(o.race.nextMark,o.race.marks.length-1)],r=pe($(a,n.pos)),s=T(n.vel,r);ce.textContent=`${(w(n.vel)*1.45).toFixed(1)} kt`,de.textContent=A(n.heading),he.textContent=`${A(i)} / ${o.windSpeed.toFixed(0)} kt`,ue.textContent=`${(s*1.45).toFixed(1)} kt`;const c=Math.round(Math.abs(t*180/Math.PI));le.textContent=o.race.raceFinished?"Finished":c<45?"Pinching / no-go risk":c<110?"Powered up":"Running deep",ae.innerHTML=`<strong>${o.splashText}</strong> Next mark: ${o.race.raceFinished?"complete":o.race.nextMark+1+" / "+o.race.marks.length}. Sail trim ${(n.sailTrim*100).toFixed(0)}%.`}function O(){const t=window.devicePixelRatio||1,i=l.getBoundingClientRect();l.width=Math.floor(i.width*t),l.height=Math.floor(i.height*t),e.setTransform(t,0,0,t,0,0)}function k(t){return{x:t.x-h.x+l.clientWidth/2,y:t.y-h.y+l.clientHeight/2}}function xe(){const i=h.x-l.clientWidth/2,n=h.y-l.clientHeight/2,a=Math.floor(i/120)*120,r=Math.floor(n/120)*120;e.strokeStyle="rgba(255,255,255,0.08)",e.lineWidth=1;for(let s=a;s<i+l.clientWidth+120;s+=120){const c=s-i;e.beginPath(),e.moveTo(c,0),e.lineTo(c,l.clientHeight),e.stroke()}for(let s=r;s<n+l.clientHeight+120;s+=120){const c=s-n;e.beginPath(),e.moveTo(0,c),e.lineTo(l.clientWidth,c),e.stroke()}}function ke(t){const i=y(t);e.strokeStyle="rgba(230, 244, 255, 0.18)",e.lineWidth=1.5;for(let n=70;n<l.clientHeight;n+=120)for(let a=70;a<l.clientWidth;a+=120){const r=i.x*18,s=i.y*18;e.beginPath(),e.moveTo(a-r,n-s),e.lineTo(a+r,n+s),e.stroke(),e.beginPath(),e.moveTo(a+r,n+s),e.lineTo(a+r-i.x*8+i.y*5,n+s-i.y*8-i.x*5),e.moveTo(a+r,n+s),e.lineTo(a+r-i.x*8-i.y*5,n+s-i.y*8+i.x*5),e.stroke()}}function be(){const t=o.race;if(t.marks.forEach((i,n)=>{const a=k(i);e.beginPath(),e.arc(a.x,a.y,i.radius,0,g),e.fillStyle=i.color,e.fill(),e.beginPath(),e.arc(a.x,a.y,V,0,g),e.strokeStyle=n===t.nextMark&&!t.raceFinished?"rgba(140,255,188,0.95)":"rgba(255,255,255,0.15)",e.lineWidth=n===t.nextMark?3:1,e.stroke(),e.fillStyle="#06111b",e.font="bold 16px Inter, sans-serif",e.textAlign="center",e.textBaseline="middle",e.fillText(String(n+1),a.x,a.y)}),!t.raceFinished){const i=k(t.marks[t.nextMark]),n=k(o.boat.pos);e.setLineDash([10,8]),e.strokeStyle="rgba(255,255,255,0.55)",e.lineWidth=2,e.beginPath(),e.moveTo(n.x,n.y),e.lineTo(i.x,i.y),e.stroke(),e.setLineDash([])}}function we(t){const i=o.boat,n=k(i.pos);e.save(),e.translate(n.x,n.y),e.rotate(i.heading),e.fillStyle="rgba(255, 212, 77, 0.12)",e.beginPath(),e.moveTo(0,0),e.arc(0,0,86,-.7,.7),e.closePath(),e.fill(),e.strokeStyle="#dbf0ff",e.lineWidth=3,e.fillStyle="#f5fbff",e.beginPath(),e.moveTo(24,0),e.lineTo(-18,-12),e.lineTo(-28,0),e.lineTo(-18,12),e.closePath(),e.fill(),e.stroke(),e.strokeStyle="#9bd4ff",e.lineWidth=3,e.beginPath(),e.moveTo(-8,0),e.lineTo(-8-26*i.sailTrim,32*i.tack),e.stroke(),e.strokeStyle="#7ce3ff",e.lineWidth=2,e.beginPath(),e.moveTo(-2,0),e.lineTo(-2,-20),e.stroke(),e.restore();const a=k(x(i.pos,f(y(t),120)));e.strokeStyle="#d7f0ff",e.lineWidth=2,e.beginPath(),e.moveTo(n.x,n.y),e.lineTo(a.x,a.y),e.stroke()}function Me(t){const i=l.clientWidth-92,n=92;e.beginPath(),e.arc(i,n,52,0,g),e.fillStyle="rgba(5, 16, 27, 0.6)",e.fill(),e.strokeStyle="rgba(255,255,255,0.2)",e.lineWidth=2,e.stroke();const a=(r,s,c)=>{const d=y(r);e.strokeStyle=s,e.lineWidth=3,e.beginPath(),e.moveTo(i-d.x*8,n-d.y*8),e.lineTo(i+d.x*38,n+d.y*38),e.stroke(),e.fillStyle=s,e.font="12px Inter, sans-serif",e.fillText(c,i+d.x*46-8,n+d.y*46+4)};a(o.boat.heading,"#7ac7ff","B"),a(t+Math.PI,"#ffd86a","W")}function Te(){const t=N(o.time);e.clearRect(0,0,l.clientWidth,l.clientHeight);const i=e.createLinearGradient(0,0,0,l.clientHeight);i.addColorStop(0,"#0e4767"),i.addColorStop(1,"#0a2d42"),e.fillStyle=i,e.fillRect(0,0,l.clientWidth,l.clientHeight),xe(),ke(t),be(),we(t),Me(t)}let C=performance.now();function z(t){const i=Math.min(.033,(t-C)/1e3);C=t,ge(i),Te(),requestAnimationFrame(z)}window.addEventListener("keydown",t=>{v.add(t.key),(t.key==="r"||t.key==="R")&&S(!1),t.key===" "&&(M(!0),t.preventDefault())});window.addEventListener("keyup",t=>{v.delete(t.key)});window.addEventListener("resize",O);document.querySelector("#reset-btn").addEventListener("click",()=>S(!1));document.querySelector("#wind-btn").addEventListener("click",()=>S(!0));O();M(!0);requestAnimationFrame(z);
