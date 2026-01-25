// Convenience selectors
const qs = (s) => document.querySelector(s);
const qsa = (s) => Array.from(document.querySelectorAll(s));

// Simple storage helpers
const store = {
  get(key, def) { try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; } },
  set(key, v) { localStorage.setItem(key, JSON.stringify(v)); }
};

// App registry: content-sections are registered and lazily opened
const appRegistry = {};

// Camera control (can be used as wallpaper)
const stopCam = () => {
  const video = qs('#bgcontainer');
  if (!video) return;
  const stream = video.srcObject;
  if (!stream) return;
  stream.getTracks().forEach(t => t.stop());
  video.srcObject = null;
  store.set('wallpaper', store.get('wallpaper',''));
};

const startCam = async () => {
  const video = qs('#bgcontainer');
  if (!video) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
  if (video.srcObject) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
    video.srcObject = stream;
    try { await video.play(); } catch {}
  } catch (e) {
    console.error('camera error', e);
  }
};

// Window manager
const WindowManager = (() => {
  let z = 1100;
  function createWindow({id, title, width=640, height=360, x=100, y=100, content=''}){
    // reuse if exists
    let el = qs(`#${id}`);
    if (el) {
      // bring to front and unhide
      el.style.display = 'block';
      el.classList.remove('hidden-win');
      el.style.zIndex = ++z;
      // restore if we stored transform/translate
      if (el.dataset.x || el.dataset.y) {
        el.style.transform = '';
        delete el.dataset.x; delete el.dataset.y;
      }
      // reload any stored iframe src if present
      el.querySelectorAll('iframe[data-src]').forEach(iframe=>{ if (!iframe.src) iframe.src = iframe.getAttribute('data-src'); });
      return el;
    }

    el = document.createElement('div');
    el.className = 'content-section cs-clear';
    el.id = id;
    el.style.width = width + 'px';
    el.style.height = height + 'px';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.display = 'block';
    el.style.position = 'absolute';
    el.style.zIndex = ++z;

    el.innerHTML = `
      <div class='titlebar page-nav' style='cursor:grab'><h2 class='title page-title' style='color: whitesmoke;'>${title}</span><span class='controls'>
        <button data-action='min'>—</button>
        <button data-action='max'>▢</button>
        <button data-action='close' class='btn-red'>✕</button>
      </span></div>
      <div class='content desk-paper'>${content}</div>
    `;

    // drag
    let dragging = null;
    const titlebar = el.querySelector('.titlebar');
    titlebar.addEventListener('pointerdown', (e) => {
      dragging = {x: e.clientX - el.offsetLeft, y: e.clientY - el.offsetTop};
      el.style.cursor = 'grabbing';
      el.style.zIndex = ++z;
      // remove maxed state if dragging (restore first)
      if (el.dataset.maxed) {
        // restore before dragging
        try{ const p = JSON.parse(el.dataset.prev||'{}'); el.style.width = p.w || el.style.width; el.style.height = p.h || el.style.height; el.style.left = p.l || el.style.left; el.style.top = p.t || el.style.top; el.style.position = p.pos || 'absolute'; delete el.dataset.maxed; }catch(e){}
      }
    });
    el.addEventListener('pointerdown', ()=> { el.style.zIndex = ++z; el.classList.remove('hidden-win'); });
    window.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      el.style.left = (e.clientX - dragging.x) + 'px';
      el.style.top = (e.clientY - dragging.y) + 'px';
    });
    window.addEventListener('pointerup', () => { dragging = null; el.style.cursor = 'grab'; });

    // controls
    el.querySelectorAll('.controls button').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        const a = btn.getAttribute('data-action');
        if (a === 'min') {
          el.classList.add('hidden-win');
          el.style.zIndex = 0;
        }
        if (a === 'max') {
          if (!el.dataset.maxed) {
            // store previous geometry
            el.dataset.prev = JSON.stringify({w: el.style.width, h: el.style.height, l: el.style.left, t: el.style.top, pos: el.style.position});
            // make full-viewport
            el.style.position = 'fixed';
            el.style.left = '0'; el.style.top = '0';
            el.style.width = '100vw'; el.style.height = '100vh';
            el.dataset.maxed = '1';
            el.style.zIndex = ++z;
          } else {
            // restore
            try{
              const p = JSON.parse(el.dataset.prev||'{}');
              el.style.position = p.pos || 'absolute';
              el.style.width = p.w || el.style.width; el.style.height = p.h || el.style.height;
              el.style.left = p.l || el.style.left; el.style.top = p.t || el.style.top;
            }catch(e){}
            delete el.dataset.maxed;
          }
        }
        if (a === 'close') closeWindow(el);
      });
    });

    // make window resizable from any edge using interact.js
    try{
      interact(el).resizable({
        edges: { left: true, right: true, bottom: true, top: true },
        modifiers: [ interact.modifiers.restrictSize({ min: { width: 240, height: 120 } }) ],
        inertia: true,
        listeners: {
          move (event) {
            // when resizing, switch to absolute coordinates (remove translate)
            if (event.target.dataset.x || event.target.dataset.y) {
              // apply transform translation to left/top
              const tx = parseFloat(event.target.dataset.x||0);
              const ty = parseFloat(event.target.dataset.y||0);
              const left = (parseFloat(event.target.style.left) || 0) + tx;
              const top = (parseFloat(event.target.style.top) || 0) + ty;
              event.target.style.left = left + 'px';
              event.target.style.top = top + 'px';
              event.target.style.transform = '';
              delete event.target.dataset.x; delete event.target.dataset.y;
            }
            Object.assign(event.target.style, {
              width: `${event.rect.width}px`,
              height: `${event.rect.height}px`
            });
            // move when resizing from top/left
            if (event.deltaRect.left) event.target.style.left = (parseFloat(event.target.style.left||0) + event.deltaRect.left) + 'px';
            if (event.deltaRect.top) event.target.style.top = (parseFloat(event.target.style.top||0) + event.deltaRect.top) + 'px';
          }
        }
      });
    }catch(e){ /* interact may not be present */ }

    document.body.appendChild(el);
    return el;
  }

  function focus(id){ const el = qs('#'+id); if (!el) return; el.classList.remove('hidden-win'); el.style.display='block'; el.style.zIndex = ++z; // restore iframe if needed
    el.querySelectorAll('iframe[data-src]').forEach(iframe=>{ if (!iframe.src) iframe.src = iframe.getAttribute('data-src'); }); }

  // close + unload resources helper
  function closeWindow(el){
    // unload iframes
    el.querySelectorAll('iframe').forEach(ifr=>{
      // store src in data-src for reload later
      try{ ifr.setAttribute('data-src', ifr.src || ifr.getAttribute('data-src')||''); }catch(e){}
      try{ ifr.src = 'about:blank'; }catch(e){}
      try{ ifr.remove(); }catch(e){}
    });
    // stop media elements
    el.querySelectorAll('video').forEach(v=>{ try{ if (v.srcObject) { v.srcObject.getTracks().forEach(t=>t.stop()); } v.pause(); v.src=''; }catch(e){} });
    // remove element
    try{ el.remove(); }catch(e){}
  }

  return { createWindow, focus, closeWindow };
})();

// Utility: find existing window element for an app id
function getWindowElementForApp(appId){
  const tryIds = [ 'win-'+appId, 'win-'+appId.replace(/^win-/,''), appId, 'win-'+appId.split(':').pop() ];
  for(const id of tryIds){ const el = qs('#'+id); if (el) return el; }
  return null;
}

// Utility: open an app window
const openApp = (appId) => {
  // if a window exists, restore/unhide and focus
  const existing = getWindowElementForApp(appId);
  if (existing){ existing.classList.remove('hidden-win'); existing.style.display='block'; existing.style.zIndex = 99999; // bring forward
    // reload lazy-iframes
    existing.querySelectorAll('iframe[data-src]').forEach(ifr=>{ if (!ifr.src) ifr.src = ifr.getAttribute('data-src'); });
    return WindowManager.focus(existing.id.replace(/^#/,''));
  }

  // otherwise launch the app
  switch(appId) {
    case 'expert': openExpert(); break;
    case 'terminal': openTerminal(); break;
    case 'clock': openClock(); break;
    case 'settings': openSettings(); break;
    case 'camera': openCamera(); break;
    case 'notepad': openNotepad(); break;
    case 'run': openRun(); break;
    case 'phone': openPhone(); break;
    case 'key-caps': openKeyCaps(); break;
    default:
      // try registered apps (content-section registry keys were '#id')
      const key = (appId.startsWith('#')?appId:'#'+appId);
      if (appRegistry[key]) { openRegisteredApp(key); }
      else WindowManager.createWindow({id:appId, title:appId, content:'<div>App '+appId+'</div>'});
  }
};

// Run app: open a small launcher where user can type an app id
function openRun(){
  const content = `<div style='display:flex;flex-direction:column;height:100%'>
    <div style='padding:8px'>Open app by id (e.g. expert, terminal, notepad, #keycaps):</div>
    <div style='display:flex;padding:8px;gap:8px'><input id='run-input' style='flex:1'/><button id='run-open'>Open</button></div>
    <div style='padding:8px'><small>Available registered apps:</small><div id='run-list' style='display:flex;flex-wrap:wrap;gap:6px;padding-top:6px'></div></div>
  </div>`;
  const win = WindowManager.createWindow({id:'win-run', title:'Run', width:420, height:180, x:240, y:200, content});
  const input = win.querySelector('#run-input'); const btn = win.querySelector('#run-open');
  const list = win.querySelector('#run-list');
  Object.keys(appRegistry).forEach(k=>{ const text = appRegistry[k].id; const b = document.createElement('button'); b.textContent = text.replace(/^#/,''); b.style.padding='6px'; b.addEventListener('click', ()=>{ input.value = text.replace(/^#/,''); }); list.appendChild(b); });
  btn.addEventListener('click', ()=>{ const id = input.value.trim(); if (!id) return; openApp(id); });
}

// Phone app; call people
function openPhone(){
  const content = `<style>#phone-table td button, #phone-box {width: calc(100% - 40px); height: 36pt; font-size: 18pt; font-weight: bold; color: darkslategrey;} #phone-table, #phone-box {max-width: 400px;}</style>
          <center>
            <input type='number' style='width: calc(100% - 40px); min-width: 400px; font-family: courier; cursor: vertical-text;' id='phone-box' step='1' min='0' max='999999999999'/>
            <table class='non nepas' style='width: calc(100% - 40px);' id='phone-table'>
              <tbody>
                <tr>
                  <td>
                    <button>1</button>
                  </td>
                  <td>
                    <button>2</button>
                  </td>
                  <td>
                    <button>3</button>
                  </td>
                </tr>
                <tr>
                  <td>
                    <button>4</button>
                  </td>
                  <td>
                    <button>5</button>
                  </td>
                  <td>
                    <button>6</button>
                  </td>
                </tr>
                <tr>
                  <td>
                    <button>7</button>
                  </td>
                  <td>
                    <button>8</button>
                  </td>
                  <td>
                    <button>9</button>
                  </td>
                </tr>
                <tr>
                  <td>
                    <button>#</button>
                  </td>
                  <td>
                    <button>0</button>
                  </td>
                  <td>
                    <button>*</button>
                  </td>
                </tr>
                <tr>
                  <td>
                    <button>+</button>
                  </td>
                  <td>
                    <button title='backspace'><i class='fa fa-eraser'></i></button><br/>
                    <button title='clear'><i class='fa fa-stop'></i></button>
                  </td>
                  <td>
                    <button title='dial'><i class='fa fa-phone'></i></button>
                  </td>
                </tr>
              </tbody>
            </table>
          </center>
        </div>
        <script>
          var phoneString = '';
          document.querySelectorAll('#phone-table button').forEach(phoneBtn => {
            if (phoneBtn.title == 'backspace') {
              phoneBtn.addEventListener('click', function () {
                phoneString = phoneString.slice(0, -1);
                document.querySelector('#phone-box').value = phoneString;
              });
            }
            else if (phoneBtn.title == 'clear') {
              phoneBtn.addEventListener('click', function () {
                phoneString = '';
                document.querySelector('#phone-box').value = phoneString;
              });
            }
            else if (phoneBtn.title == 'dial') {
              phoneBtn.addEventListener('click', function () {
                window.open('tel:' + phoneString, '_self')
                phoneString = '';
                document.querySelector('#phone-box').value = phoneString;
              });
            }
            else {
              phoneBtn.addEventListener('click', function () {
                phoneString += phoneBtn.innerHTML;
                document.querySelector('#phone-box').value = phoneString;
              });
            }
          });
        </script>`;
  const win = WindowManager.createWindow({id:'win-phone', title:'Phone', width:420, height:180, x:240, y:200, content});
  const input = win.querySelector('#phone-input'); const btn = win.querySelector('#phone-open');
  const list = win.querySelector('#phone-list');
  Object.keys(appRegistry).forEach(k=>{ const text = appRegistry[k].id; const b = document.createElement('button'); b.textContent = text.replace(/^#/,''); b.style.padding='6px'; b.addEventListener('click', ()=>{ input.value = text.replace(/^#/,''); }); list.appendChild(b); });
  btn.addEventListener('click', ()=>{ const id = input.value.trim(); if (!id) return; openApp(id); });
}

// Key Caps app
function openKeyCaps(){
  const content = `<center><input type='text' style='width: calc(100% - 40px); font-family: courier; cursor: vertical-text;' id='keycaps-box'/></center>
          <div class='table-wrapper'>
            <table class='non nepas' style='width: calc(100% - 40px);' id='keycaps-table'>
              <tbody>
                <tr>
                  <td>
                    <button>q</button>
                  </td>
                  <td>
                    <button>w</button>
                  </td>
                  <td>
                    <button>e</button>
                  </td>
                  <td>
                    <button>r</button>
                  </td>
                  <td>
                    <button>t</button>
                  </td>
                  <td>
                    <button>y</button>
                  </td>
                  <td>
                    <button>u</button>
                  </td>
                  <td>
                    <button>i</button>
                  </td>
                  <td>
                    <button>o</button>
                  </td>
                  <td>
                    <button>p</button>
                  </td>
                  <td>
                    <button>[</button>
                  </td>
                  <td>
                    <button>]</button>
                  </td>
                  <td>
                    <button>\</button>
                  </td>
                </tr>
                <tr>
                  <td>
                    <button>≠</button>
                  </td>
                  <td>
                    <button>a</button>
                  </td>
                  <td>
                    <button>s</button>
                  </td>
                  <td>
                    <button>d</button>
                  </td>
                  <td>
                    <button style='text-decoration: underline;'>f</button>
                  </td>
                  <td>
                    <button>g</button>
                  </td>
                  <td>
                    <button>h</button>
                  </td>
                  <td>
                    <button style='text-decoration: underline;'>j</button>
                  </td>
                  <td>
                    <button>k</button>
                  </td>
                  <td>
                    <button>l</button>
                  </td>
                  <td>
                    <button>;</button>
                  </td>
                  <td>
                    <button>'</button>
                  </td>
                  <td>
                    <button>\`</button>
                  </td>
                </tr>
                <tr>
                  <td>
                    <button>shift</button>
                  </td>
                  <td>
                    <button>z</button>
                  </td>
                  <td>
                    <button>x</button>
                  </td>
                  <td>
                    <button>c</button>
                  </td>
                  <td>
                    <button>v</button>
                  </td>
                  <td>
                    <button>b</button>
                  </td>
                  <td>
                    <button>n</button>
                  </td>
                  <td>
                    <button>m</button>
                  </td>
                  <td>
                    <button>,</button>
                  </td>
                  <td>
                    <button>.</button>
                  </td>
                  <td>
                    <button>/</button>
                  </td>
                  <td>
                    <button style='width: 50%;'> </button>
                  </td>
                  <td>
                    <button title='backspace'><i class='fa fa-eraser'></i></button>
                  </td>
                </tr>
              </tbody>
            </table>`;
  const win = WindowManager.createWindow({id:'win-key-caps', title:'Start Menu', width:500, height:'fit-content', x:240, y:200, content});
  const input = win.querySelector('#key-caps-input'); const btn = win.querySelector('#start-menu-open');
  const list = win.querySelector('#key-caps-list');
  Object.keys(appRegistry).forEach(k=>{ const text = appRegistry[k].id; const b = document.createElement('button'); b.textContent = text.replace(/^#/,''); b.style.padding='6px'; b.addEventListener('click', ()=>{ input.value = text.replace(/^#/,''); }); list.appendChild(b); });
  btn.addEventListener('click', ()=>{ const id = input.value.trim(); if (!id) return; openApp(id); });
}

// Expert browser with tabs
function openExpert() {
  const content = `
    <div style='display:flex;flex-direction:column;height:100%'>
      <div id='expert-tabs' style='display:flex;gap:6px;padding:6px;align-items:center'></div>
      <div style='flex:1;position:relative'><iframe id='expert-frame' style='width:100%;height:100%;border:0' src='about:blank'></iframe></div>
      <div style='padding:6px;display:flex;gap:8px;align-items:center'><input id='expert-address' style='flex:1'/><button id='expert-go'>Go</button></div>
    </div>`;
  const win = WindowManager.createWindow({id:'win-expert', title:'Expert', width:900, height:600, x:120, y:80, content});

  const tabs = win.querySelector('#expert-tabs');
  const iframe = win.querySelector('#expert-frame');
  const address = win.querySelector('#expert-address');

  function addTab(url='https://example.com'){
    const t = document.createElement('button'); t.textContent = url.replace(/^https?:\/\//,'').slice(0,20); t.style.padding='6px';
    t.addEventListener('click', ()=> iframe.src = url);
    t.addEventListener('contextmenu', (e)=>{ e.preventDefault(); t.remove(); if (tabs.children.length===0) addTab('about:blank'); });
    tabs.appendChild(t);
    iframe.src = url;
  }
  win.querySelector('#expert-go').addEventListener('click', ()=>{
    let u = address.value.trim(); if (!u) return; if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(u)) u = 'https://'+u; addTab(u); address.value='';
  });
  addTab('https://duckduckgo.com');
}

// Terminal emulator (fake)
function openTerminal(){
  const content = `<div style='background:black;color:#0f0;padding:8px;font-family:monospace;height:100%;display:flex;flex-direction:column'><div id='term-out' style='flex:1;overflow:auto'></div><div style='display:flex;gap:8px'>~/<input id='term-in' style='flex:1;background:#111;color:#0f0;border:1px solid #222;padding:6px'/><button id='term-btn'>Run</button></div></div>`;
  const win = WindowManager.createWindow({id:'win-term', title:'Terminal', width:640, height:360, x:140, y:120, content});
  const out = win.querySelector('#term-out'); const input = win.querySelector('#term-in');
  function echo(t){ out.innerHTML += '<div>'+t.replace(/</g,'&lt;')+'</div>'; out.scrollTop = out.scrollHeight; }
  win.querySelector('#term-btn').addEventListener('click', ()=>{ runCmd(input.value.trim()); input.value=''; });
  input.addEventListener('keydown', (e)=>{ if (e.key==='Enter'){ runCmd(input.value.trim()); input.value=''; } });

  function runCmd(cmd){ if (!cmd) return; echo('> '+cmd);
    const parts = cmd.split(' ');
    const c = parts[0].toLowerCase();
    if (c==='help') echo('Available: help, echo, ls, pwd, date, free, reboot');
    else if (c==='echo') echo(parts.slice(1).join(' '));
    else if (c==='ls') echo('bin\nboot\nhome\nusr\nvar\netc');
    else if (c==='pwd') echo('/home/user');
    else if (c==='date') echo(new Date().toString());
    else if (c==='free') echo('Mem: 4096MB total, 2048MB free');
    else if (c==='reboot') echo('Simulating reboot... (reload)') && setTimeout(()=>location.reload(),800);
    else echo('Command not found: '+c);
  }
}

// Clock with alarms
function openClock(){
  const alarms = store.get('alarms',[]);
  const content = `<div style='display:flex;flex-direction:column;height:100%'>
    <div style='padding:8px'><strong>Current time: </strong><span id='clock-now'></span></div>
    <div style='flex:1;overflow:auto;padding:8px' id='alarm-list'></div>
    <div style='padding:8px;display:flex;gap:8px'><input id='alarm-time' type='time'/><input id='alarm-label' placeholder='label'/><button id='alarm-add'>Add</button></div>
  </div>`;
  const win = WindowManager.createWindow({id:'win-clock', title:'Clock', width:420, height:320, x:200, y:160, content});
  const nowSpan = win.querySelector('#clock-now'); const list = win.querySelector('#alarm-list');
  function renderAlarms(){ list.innerHTML=''; (store.get('alarms',[])).forEach((a,i)=>{ const r=document.createElement('div'); r.style.padding='6px'; r.textContent = a.time+' — '+(a.label||''); const del=document.createElement('button'); del.textContent='Delete'; del.style.marginLeft='8px'; del.addEventListener('click', ()=>{ const as=store.get('alarms',[]); as.splice(i,1); store.set('alarms',as); renderAlarms(); }); r.appendChild(del); list.appendChild(r); }) }
  renderAlarms();
  win.querySelector('#alarm-add').addEventListener('click', ()=>{
    const t = win.querySelector('#alarm-time').value; const l = win.querySelector('#alarm-label').value; if (!t) return; const as = store.get('alarms',[]); as.push({time:t,label:l}); store.set('alarms',as); renderAlarms();
  });
  setInterval(()=>{ nowSpan.textContent = new Date().toLocaleTimeString(); checkAlarms(); },1000);
  function checkAlarms(){ const now = new Date(); const hh = String(now.getHours()).padStart(2,'0'); const mm = String(now.getMinutes()).padStart(2,'0'); const cur = hh+':'+mm; const as = store.get('alarms',[]); as.forEach((a,idx)=>{ if (!a.fired && a.time===cur){ alert('Alarm: '+(a.label||a.time)); a.fired = true; as[idx]=a; store.set('alarms',as); } }); }
}

// Settings app (wallpaper etc.)
function openSettings(){
  const wp = store.get('wallpaper','');
  const content = `<div style='padding:8px;display:flex;flex-direction:column;height:100%'>
    <h2>Clock</h2>
    <p>
      Date format: <select id='date-format'>
        <option value='dmy'>date, month, year</option>
        <option value='mdy'>month, day, year</option>
        <option value='ymd'>year, month, day</option>
        <option value='ydm'>year, day, month</option>
        <option value='dym'>day, year, month</option>
        <option value='myd'>month, year, day</option>
        <option value='unix'>unix</option>
        <option value='milennium'>milennium</option>
      </select>
    </p>
    <h2>Desktop</h2>
    <button onclick='stopCam();' class='btn-red'>Stop camera</button>
    <button onclick='startCam();' class='btn-green'>Start camera</button>
    <div style='display:flex;gap:8px;align-items:center'><label>Wallpaper URL</label><input id='wp-url' type='text' style='flex:1' value='${wp||''}'/></div>
  </div>`;
  const win=WindowManager.createWindow({id:'win-settings', title:'Settings', width:520, height:300, x:220, y:120, content});
  win.querySelector('#wp-save').addEventListener('click', ()=>{ const v = win.querySelector('#wp-url').value; store.set('wallpaper', v); applyWallpaper(); });
  win.querySelector('#wp-camera').addEventListener('click', ()=>{ startCam(); store.set('wallpaper','camera'); applyWallpaper(); });
}

function applyWallpaper(){ const wp = store.get('wallpaper',''); const bg = qs('#bgcontainer'); if (wp==='camera') { bg.style.display='block'; } else if (wp) { bg.style.display='none'; document.documentElement.style.backgroundImage = `url('${wp}')`; } else { bg.style.display='block'; document.documentElement.style.backgroundImage=''; } }

function openCamera(){ startCam(); WindowManager.createWindow({id:'win-camera', title:'Camera', width:640, height:480, x:260, y:120, content:`<video autoplay muted playsinline style='width:100%;height:100%;background:#000' id='cam-preview'></video>`});
  const v = qs('#cam-preview'); if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia({video:true}).then(s=>{ v.srcObject = s; try{ v.play(); }catch{} });
}

function openNotepad(){ const content = `<textarea style='width:100%;height:100%'>${store.get('notepad','')}</textarea>`; const win = WindowManager.createWindow({id:'win-notepad', title:'Notepad', width:560, height:420, x:260, y:180, content}); const ta = win.querySelector('textarea'); ta.addEventListener('input', ()=> store.set('notepad', ta.value)); }

// Setup dock and menu bar
function setupShell(){
  // menu bar
  const mb = document.createElement('div'); mb.className='menu-bar'; mb.innerHTML = `<div class='left'><div style='font-weight:700'>Osmium VR</div></div><div class='right'><div id='menu-time'></div></div>`;
  document.body.appendChild(mb);
  setInterval(()=> qs('#menu-time').textContent = new Date().toLocaleTimeString(), 1000);

  // dock
  const dock = document.createElement('div'); dock.className='nav-bar';
  const apps = [ {id:'expert', icon:'🌐'}, {id:'terminal', icon:'>_'},{id:'notepad', icon:'📝'},{id:'camera', icon:'📷'},{id:'clock', icon:'⏰'},{id:'settings', icon:'⚙️'},{id:'run', icon:'▶'} ];
  apps.forEach(a=>{
    const d=document.createElement('div'); d.className='dock-item nav-item'; d.datatarget=a.id; d.title=a.id; d.innerHTML = `<div style='text-align:center'>${a.icon}</div>`;
    d.addEventListener('click', ()=>{
      // if a window exists and is hidden (minimized), restore it; otherwise open
      const existing = getWindowElementForApp(a.id);
      if (existing){ existing.classList.remove('hidden-win'); existing.style.display='block'; existing.style.zIndex = 99999; existing.querySelectorAll('iframe[data-src]').forEach(ifr=>{ if (!ifr.src) ifr.src = ifr.getAttribute('data-src'); }); WindowManager.focus(existing.id); }
      else openApp(a.id);
    });
    dock.appendChild(d);
  });
  document.body.appendChild(dock);

  // enable start menu drag ordering
  const startGrid = qs('#start-grid'); if (startGrid){ let dragging=null; qsa('#start .nav-item').forEach(n=>{ n.draggable=true; n.addEventListener('dragstart',(e)=>{ dragging=n; }); n.addEventListener('dragover',(e)=> e.preventDefault()); n.addEventListener('drop',(e)=>{ if (dragging && dragging!==n){ startGrid.insertBefore(dragging, n); saveStartOrder(); } }); }); loadStartOrder(); }
}

function saveStartOrder(){ const ids = qsa('#start .nav-item').map(n=> n.getAttribute('data-target') + '||' + n.textContent.trim()); store.set('startOrder', ids); }
function loadStartOrder(){ const ids = store.get('startOrder', null); if (!ids) return; const sg = qs('#start-grid'); const mapping = {}; qsa('#start .nav-item').forEach(n=> mapping[n.getAttribute('data-target') + '||' + n.textContent.trim()] = n ); ids.forEach(k=>{ if (mapping[k]) sg.appendChild(mapping[k]); }); }

// Wire existing nav items to open windows
function wireNav(){ qsa('.nav-item').forEach(item=>{ item.addEventListener('click', ()=>{ const t = item.getAttribute('data-target'); if (!t) return; if (t==='#start'){ qsa('.content-section').forEach(s=> s.classList.remove('active')); qs('#start').classList.add('active'); } else if (t==='#clock'){ openClock(); } else if (t==='#expert'){ openExpert(); } else if (t==='#controls'){ openSettings(); } else { /* open page by id if exists */ const el = qs(t); if (el) el.classList.add('active'); } }); }); }

// Init
// Turn existing content-section apps into windows and wire them
async function migrateContentSections(){
  const secs = qsa('.content-section');
  let offset = 80;
  secs.forEach(s => {
    const id = s.id || ('section-'+Math.random().toString(36).slice(2,7));
    const key = '#'+id;
    const titleEl = s.querySelector('.page-title') || s.querySelector('h1') || {textContent: id};
    // remove embedded scripts to avoid double-execution; keep iframes as data-src for lazy load
    const tmp = s.cloneNode(true);
    tmp.querySelectorAll('script').forEach(sc=> sc.remove());
    tmp.querySelectorAll('iframe').forEach(ifr=>{ const src = ifr.getAttribute('src'); if (src){ ifr.removeAttribute('src'); ifr.setAttribute('data-src', src); } });
    const contentHtml = tmp.innerHTML;
    appRegistry[key] = { id, title: titleEl.textContent.trim()||id, content: contentHtml };
    // hide original content sections except start (leave start as home screen)
    if (id !== 'start') s.style.display = 'none';
    offset += 24;
  });
}

// Open a registered app lazily (creates window when needed)
function openRegisteredApp(target){
  const reg = appRegistry[target];
  if (!reg) return;
  const winId = 'win-'+reg.id;
  // create window with app-menu and lazy-loading of iframes
  const content = `<div class='app-menu' style='display:flex;gap:8px;padding:6px;border-bottom:1px solid rgba(0,0,0,0.06)'><button data-file-save>Save</button><button data-file-open>Open</button><button data-capture>Capture</button></div><div class='app-body' style='padding:8px; height: calc(100% - 56px); overflow:auto'>${reg.content}</div>`;
  const win = WindowManager.createWindow({id:winId, title:reg.title, width:720, height:480, x:120, y:120, content});
  // attach file buttons
  win.querySelector('[data-file-open]')?.addEventListener('click', async ()=> await fsOpenFile(win));
  win.querySelector('[data-file-save]')?.addEventListener('click', async ()=> await fsSaveFile(win));
  win.querySelector('[data-capture]')?.addEventListener('click', ()=> capturePhoto());
  // lazy-load iframes
  win.querySelectorAll('iframe[data-src]').forEach(ifr=> ifr.src = ifr.getAttribute('data-src'));
  // app-specific enhancements
  if (reg.id === 'organiser') enhanceOrganiser(win);
  if (reg.id === 'sentence') enhanceSentence(win);
  if (reg.id === 'polanco') enhancePolanco(win);
}

// File System Access helpers (if available)
async function fsSaveFile(win){
  try{
    const body = win.querySelector('.app-body');
    const textareas = body.querySelectorAll('textarea');
    if (textareas.length){
      const v = textareas[0].value;
      if (window.showSaveFilePicker){
        const handle = await window.showSaveFilePicker({types:[{description:'Text',accept:{'text/plain':['.txt']}}]});
        const writable = await handle.createWritable();
        await writable.write(v); await writable.close();
        alert('Saved.');
        return;
      }
      // fallback: download
      const blob = new Blob([v], {type:'text/plain'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = (win.id||'file')+'.txt'; a.click(); URL.revokeObjectURL(url);
    } else alert('No editable region found.');
  }catch(e){ console.error(e); alert('Save failed'); }
}

async function fsOpenFile(win){
  try{
    if (window.showOpenFilePicker){
      const [h] = await window.showOpenFilePicker();
      const f = await h.getFile(); const text = await f.text(); const body = win.querySelector('.app-body'); body.innerHTML = `<textarea style='width:100%;height:100%'>${text.replace(/</g,'&lt;')}</textarea>`; return;
    }
    // fallback input
    const input = document.createElement('input'); input.type='file'; input.accept='*/*'; input.onchange = e=>{ const file = e.target.files[0]; const reader=new FileReader(); reader.onload = ()=>{ const body = win.querySelector('.app-body'); body.innerHTML = `<textarea style='width:100%;height:100%'>${reader.result.replace(/</g,'&lt;')}</textarea>`; }; reader.readAsText(file); }; input.click();
  }catch(e){ console.error(e); }
}

// Photo capture & gallery
function capturePhoto(){ const video = qs('#bgcontainer'); if (!video || !video.srcObject) { alert('Camera not active'); return; } const canvas = document.createElement('canvas'); canvas.width = video.videoWidth || 1280; canvas.height = video.videoHeight || 720; const ctx = canvas.getContext('2d'); ctx.drawImage(video,0,0,canvas.width,canvas.height); canvas.toBlob(b=>{ const arr = store.get('photos',[]); const url = URL.createObjectURL(b); arr.push(url); store.set('photos',arr); alert('Photo saved to gallery'); }, 'image/png'); }

function openGallery(){ const photos = store.get('photos',[]); const content = `<div style='display:flex;gap:8px;flex-wrap:wrap;padding:8px'>${photos.map(p=>`<img src='${p}' style='width:240px;height:auto;margin:6px;border-radius:8px'/>`).join('')}</div>`; WindowManager.createWindow({id:'win-gallery', title:'Photos', width:900, height:600, x:140, y:120, content}); }

// Extend Expert: history/bookmarks, tab close/reorder, autofill
const Expert = {
  history: store.get('expertHistory',[]),
  bookmarks: store.get('expertBookmarks',[]),
  addHistory(url){ this.history.unshift({url,time:Date.now()}); this.history = this.history.slice(0,200); store.set('expertHistory',this.history); },
  addBookmark(url){ this.bookmarks.push({url}); store.set('expertBookmarks', this.bookmarks); }
};

function openExpert(){
  const content = `
    <div style='display:flex;flex-direction:column;height:100%'>
      <div style='display:flex;gap:8px;padding:6px;align-items:center'>
        <button id='expert-back'>◀</button>
        <button id='expert-forward'>▶</button>
        <input id='expert-address' type='text' style='flex:1'/>
        <button id='expert-go'>Go</button>
        <button id='expert-bookmark'>★</button>
      </div>
      <div id='expert-tabs' style='display:flex;gap:6px;padding:6px;align-items:center;overflow:auto'><button id='expert-new'>+</button></div>
      <div style='flex:1;position:relative'><iframe id='expert-frame' style='width:100%;height:100%;border:0' src='about:blank'></iframe></div>
    </div>`;
  const win = WindowManager.createWindow({id:'win-expert', title:'Expert', width:1000, height:700, x:100, y:80, content});
  const frame = win.querySelector('#expert-frame'); const tabs = win.querySelector('#expert-tabs'); const address = win.querySelector('#expert-address');
  const state = {tabs:[], index: -1};
  function newTab(url='https://duckduckgo.com'){
    const id = 't'+Math.random().toString(36).slice(2,7);
    const b = document.createElement('div'); b.style.padding='6px'; b.style.border='1px solid rgba(0,0,0,0.06)'; b.textContent = url.replace(/^https?:\/\//,'').slice(0,30);
    const close = document.createElement('button'); close.textContent='x'; close.style.marginLeft='6px'; close.addEventListener('click', ()=>{ const i = state.tabs.findIndex(t=>t.id===id); if (i>-1) state.tabs.splice(i,1); b.remove(); if (state.current && state.current.id===id) frame.src='about:blank'; });
    b.appendChild(close);
    b.addEventListener('click', ()=>{ const t = state.tabs.find(t=>t.id===id); if (t){ frame.src = t.url; state.current = t; address.value = t.url; Expert.addHistory(t.url); } });
    tabs.appendChild(b);
    state.tabs.push({id,url}); state.current = {id,url}; frame.src = url; address.value=''; Expert.addHistory(url);
  }
  win.querySelector('#expert-new').addEventListener('click', ()=> newTab('about:blank'));
  win.querySelector('#expert-go').addEventListener('click', ()=>{ let u = address.value.trim(); if (!u) return; if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(u)) u = 'https://'+u; newTab(u); });
  win.querySelector('#expert-bookmark').addEventListener('click', ()=>{ if (state.current) Expert.addBookmark(state.current.url); alert('Bookmarked'); });
  newTab('https://duckduckgo.com');
}

var directory = 'home';
// More terminal commands
function openTerminal(){
  const content = `<div style='background:black;color:#0f0;padding:8px;font-family:monospace;height:100%;display:flex;flex-direction:column'><div id='term-out' style='flex:1;overflow:auto'></div><div style='display:flex;gap:8px'>~/<input id='term-in' style='flex:1;background:#111;color:#0f0;border:1px solid #222;padding:6px;text-align:left;font-family:courier;' type='text'/><button id='term-btn'>Run</button></div></div>`;
  const win = WindowManager.createWindow({id:'win-term', title:'Terminal', width:640, height:360, x:140, y:120, content});
  const out = win.querySelector('#term-out'); const input = win.querySelector('#term-in');
  function echo(t){ out.innerHTML += '<div>'+t.replace(/</g,'&lt;')+'</div>'; out.scrollTop = out.scrollHeight; }
  win.querySelector('#term-btn').addEventListener('click', ()=>{ runCmd(input.value.trim()); input.value=''; });
  input.addEventListener('keydown', (e)=>{ if (e.key==='Enter'){ runCmd(input.value.trim()); input.value=''; } });
  function runCmd(cmd){ if (!cmd) return; echo('> '+cmd);
    const parts = cmd.split(' ');
    const c = parts[0].toLowerCase();
    if (c==='help') echo('Available: help, echo, ls, pwd, date, free, reboot, calc, open, download, lsmedia');
    else if (c.startsWith('ls')) {
      if (directory.includes('root') || directory.includes('boot')) echo('You do not have permission to view the contents of this folder.');
      else if (directory.includes('fsroot')) echo('boot, home, var, etc, root, .');
      else echo('., ..');
      // so the . and .. always appear that's why this odd layout lol
      if (directory.includes('home')) echo('documents, downloads, public');
      if (directory.includes('etc')) echo('expert, media, sentence, polanco, organiser');
    }
    else if (c.startsWith('cd')) {
      if (directory.includes('home')) {
        if (c.includes('documents')) directory = 'documents';
        else if (c.includes('downloads')) directory = 'downloads';
        else if (c.includes('public')) directory = 'public';
        else if (c.includes('..')) directory = 'fsroot';
        else echo('Directory not found');
      }
      else if (directory.includes('fsroot')) {
        if (c.includes('home')) directory = 'home';
        else if (c.includes('boot')) directory = 'boot';
        else echo('Directory not found');
      }
      else {
        if (c.includes('..')) directory = fsroot;
      }
    }
    else if (c==='echo') echo(parts.slice(1).join(' '));
    //else if (c==='ls') echo('bin\nboot\nhome\nusr\nvar\netc');
    else if (c==='pwd') echo('/home/user');
    else if (c==='date') echo(new Date().toString());
    else if (c==='free') echo('Mem: 4096MB total, 2048MB free');
    else if (c==='reboot') echo('Simulating reboot... (reload)') && setTimeout(()=>location.reload(),800);
    else if (c==='calc') { try{ const res = eval(parts.slice(1).join(' ')); echo(String(res)); }catch(e){ echo('calc error'); } }
    else if (c==='open') { const target = parts[1]; if (target==='gallery') openGallery(); else echo('open: unknown'); }
    else if (c==='download') { const url = parts[1]; if (url) location.href = url; }
    else if (c==='lsmedia') { const photos = store.get('photos',[]); echo(photos.join('\n')); }
    else echo('Command not found: '+c);
  }
}

// Scaffold core apps: Email, Organiser, Polanco, Sentence, Imagine
/*function scaffoldApps(){
  // Email (very simple)
  const emailContent = `<div style='display:flex;flex-direction:column;height:100%'><div style='padding:8px'><button id='email-compose'>Compose</button><button id='email-refresh'>Refresh</button></div><div id='email-list' style='flex:1;overflow:auto;padding:8px'></div></div>`;
  WindowManager.createWindow({id:'win-email', title:'Mail', width:760, height:520, x:160, y:140, content:emailContent});

  // Organiser (spreadsheet) — simple CSV editor
  const orgContent = `<div style='display:flex;flex-direction:column;height:100%'><div style='padding:8px'><button id='org-new'>New</button><button id='org-save'>Save</button></div><textarea id='org-txt' style='flex:1;width:100%'></textarea></div>`;
  WindowManager.createWindow({id:'win-organiser', title:'Organiser', width:800, height:540, x:180, y:160, content:orgContent});

  // Polanco (presentation) — simple slide list
  const polContent = `<div style='display:flex;flex-direction:column;height:100%'><div style='padding:8px'><button id='pol-new'>New Slide</button><button id='pol-export'>Export PDF</button></div><div id='pol-slides' style='flex:1;overflow:auto;padding:8px'></div></div>`;
  WindowManager.createWindow({id:'win-polanco', title:'Polanco', width:900, height:600, x:200, y:180, content:polContent});

  // Sentence (word processor)
  const sentContent = `<div style='display:flex;flex-direction:column;height:100%'><div style='padding:8px'><button id='sent-save'>Save</button></div><div contenteditable='true' style='flex:1;padding:8px;border:1px solid rgba(0,0,0,0.06);background:white' id='sent-body'>Start writing...</div></div>`;
  WindowManager.createWindow({id:'win-sentence', title:'Sentence', width:900, height:600, x:220, y:200, content:sentContent});

  // Imagine (brainstorm canvas)
  const imgContent = `<div style='display:flex;flex-direction:column;height:100%'><div style='padding:8px'><button id='img-new'>New Sticky</button></div><div id='img-canvas' style='flex:1;background:linear-gradient(#fff,#eee);position:relative;overflow:auto'></div></div>`;
  WindowManager.createWindow({id:'win-imagine', title:'Imagine', width:1000, height:700, x:240, y:220, content:imgContent});
}*/

// Enhance Organiser (spreadsheet)
function enhanceOrganiser(win){
  // replace textarea with a grid
  const body = win.querySelector('.app-body');
  const gridWrap = document.createElement('div'); gridWrap.style.height='100%'; gridWrap.style.display='flex'; gridWrap.style.flexDirection='column';
  const toolbar = document.createElement('div'); toolbar.style.padding='6px'; toolbar.innerHTML = `<button id='org-import'>Import CSV</button><button id='org-export'>Export CSV</button><button id='org-addrow'>Add Row</button><button id='org-addcol'>Add Col</button>`;
  const tableWrap = document.createElement('div'); tableWrap.style.flex='1'; tableWrap.style.overflow='auto';
  const table = document.createElement('table'); table.style.borderCollapse='collapse'; table.id='organiser-table';
  tableWrap.appendChild(table); gridWrap.appendChild(toolbar); gridWrap.appendChild(tableWrap);
  body.innerHTML=''; body.appendChild(gridWrap);

  // build a 10x8 grid
  const rows = 20, cols = 12;
  function build(){ table.innerHTML=''; for(let r=0;r<rows;r++){ const tr=document.createElement('tr'); for(let c=0;c<cols;c++){ const td=document.createElement('td'); td.style.border='1px solid #ccc'; td.style.padding='4px'; td.style.minWidth='80px'; const inp=document.createElement('input'); inp.value=''; inp.dataset.r=r; inp.dataset.c=c; inp.style.width='100%'; inp.addEventListener('change', ()=> computeAll()); td.appendChild(inp); tr.appendChild(td); } table.appendChild(tr); } }
  build();

  function computeAll(){ const data = {}; table.querySelectorAll('input').forEach(i=>{ const r=i.dataset.r,c=i.dataset.c; data[`${r},${c}`]=i.value; }); // simple formula: =SUM(r1:c1,r2:c2) not implemented fully; support =SUM(A1,B1)
    table.querySelectorAll('input').forEach(i=>{ const v=i.value; if (typeof v === 'string' && v.startsWith('=')){ try{ if (v.toUpperCase().startsWith('=SUM(')){ const inner = v.slice(5,-1); const parts = inner.split(','); let s=0; parts.forEach(p=>{ const m = p.match(/([A-Z]+)(\d+)/); if (m){ const col = m[1]; const row = parseInt(m[2])-1; const colIdx = col.split('').reduce((acc,ch)=> acc*26 + (ch.charCodeAt(0)-64),0)-1; const val = parseFloat(table.querySelector(`input[data-r='${row}'][data-c='${colIdx}']`).value)||0; s += val; } }); i.value = s; } }catch(e){} } }); }

  // import/export
  toolbar.querySelector('#org-export').addEventListener('click', ()=>{ const rows = []; table.querySelectorAll('tr').forEach(tr=>{ const cols = []; tr.querySelectorAll('input').forEach(i=> cols.push('"'+(i.value||'')+'"')); rows.push(cols.join(',')); }); const blob = new Blob([rows.join('\n')], {type:'text/csv'}); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='sheet.csv'; a.click(); URL.revokeObjectURL(url); });
  toolbar.querySelector('#org-import').addEventListener('click', ()=>{ const input=document.createElement('input'); input.type='file'; input.accept='.csv'; input.onchange = e=>{ const f=e.target.files[0]; const r=new FileReader(); r.onload = ()=>{ const lines = r.result.split('\n'); lines.forEach((ln,ri)=>{ const cols = ln.split(',').map(c=> c.replace(/^"|"$/g,'')); cols.forEach((val,ci)=>{ const cell = table.querySelector(`input[data-r='${ri}'][data-c='${ci}']`); if(cell) cell.value = val; }); }); }; r.readAsText(f); }; input.click(); });
  toolbar.querySelector('#org-addrow').addEventListener('click', ()=>{ const newRow = document.createElement('tr'); const currentCols = table.querySelectorAll('tr:first-child td').length; const r = table.querySelectorAll('tr').length; for(let c=0;c<currentCols;c++){ const td=document.createElement('td'); td.style.border='1px solid #ccc'; td.style.padding='4px'; const inp=document.createElement('input'); inp.dataset.r=r; inp.dataset.c=c; inp.style.width='100%'; td.appendChild(inp); newRow.appendChild(td); } table.appendChild(newRow); });
  toolbar.querySelector('#org-addcol').addEventListener('click', ()=>{ table.querySelectorAll('tr').forEach((tr,ri)=>{ const td=document.createElement('td'); td.style.border='1px solid #ccc'; td.style.padding='4px'; const inp=document.createElement('input'); inp.dataset.r=ri; inp.dataset.c = tr.querySelectorAll('td').length; inp.style.width='100%'; td.appendChild(inp); tr.appendChild(td); }); });
}

/*// Enhance Sentence (rich text)
function enhanceSentence(win){
  const body = win.querySelector('.app-body');
  const toolbar = document.createElement('div'); toolbar.style.padding='6px'; toolbar.innerHTML = `<button data-cmd='bold'><b>B</b></button><button data-cmd='italic'><i>I</i></button><button data-cmd='underline'><u>U</u></button><button id='sent-export'>Export</button>`;
  const editor = document.createElement('div'); editor.contentEditable = true; editor.id='sentence-editor'; editor.style.flex='1'; editor.style.padding='8px'; editor.style.height='calc(100% - 48px)'; editor.style.overflow='auto'; editor.style.border='1px solid #ddd'; editor.innerHTML = store.get('sentenceDraft',''); body.innerHTML=''; body.appendChild(toolbar); body.appendChild(editor);
  toolbar.querySelectorAll('[data-cmd]').forEach(btn=> btn.addEventListener('click', ()=> document.execCommand(btn.getAttribute('data-cmd'))));
  toolbar.querySelector('#sent-export').addEventListener('click', ()=>{ const html = editor.innerHTML; const blob = new Blob([html], {type:'text/html'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='document.html'; a.click(); URL.revokeObjectURL(url); });
  editor.addEventListener('input', ()=> store.set('sentenceDraft', editor.innerHTML));
}*/

/*// Enhance Polanco (slides)
function enhancePolanco(win){
  const body = win.querySelector('.app-body');
  const toolbar = document.createElement('div'); toolbar.style.padding='6px'; toolbar.innerHTML = `<button id='pol-add'>Add Slide</button><button id='pol-play'>Play</button><button id='pol-export'>Export PDF</button>`;
  const slidesWrap = document.createElement('div'); slidesWrap.id='pol-slides-wrap'; slidesWrap.style.display='flex'; slidesWrap.style.gap='8px'; slidesWrap.style.overflow='auto'; slidesWrap.style.padding='8px'; slidesWrap.style.flex='1';
  body.innerHTML=''; body.appendChild(toolbar); body.appendChild(slidesWrap);
  function addSlide(content='New Slide'){ const slide = document.createElement('div'); slide.contentEditable=true; slide.style.minWidth='300px'; slide.style.minHeight='200px'; slide.style.border='1px solid #ccc'; slide.style.padding='12px'; slide.innerHTML = `<h3>${content}</h3><p>Notes...</p>`; slidesWrap.appendChild(slide); }
  toolbar.querySelector('#pol-add').addEventListener('click', ()=> addSlide());
  toolbar.querySelector('#pol-play').addEventListener('click', ()=>{ const slides = Array.from(slidesWrap.children); let i=0; const w = WindowManager.createWindow({id:'win-pol-play', title:'Polanco Playback', width:900, height:700, x:180, y:160, content:`<div id='pol-play-area' style='width:100%;height:100%'></div>`}); const area = w.querySelector('#pol-play-area'); function show(){ area.innerHTML = slides[i].outerHTML; i++; if (i>=slides.length) i=0; } show(); const iv = setInterval(show, 4000); w.querySelector('.controls button[data-action=close]').addEventListener('click', ()=> clearInterval(iv)); });
  toolbar.querySelector('#pol-export').addEventListener('click', ()=>{ alert('Export stub: use browser Print -> Save as PDF for now'); });
}*/

/*// Media player + Spotify app
function openMedia(){
  const content = `<div style='display:flex;flex-direction:column;height:100%'><div style='padding:8px'><input id='media-file' type='file' accept='audio/*,video/*'/><button id='media-play'>Play</button></div><div style='flex:1;padding:8px'><audio id='media-audio' controls style='width:100%'></audio><div id='spotify-area' style='margin-top:12px'><iframe src='https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M' width='100%' height='380' frameborder='0' allowtransparency='true' allow='encrypted-media'></iframe></div></div></div>`;
  const win = WindowManager.createWindow({id:'win-media', title:'Media Player', width:900, height:600, x:260, y:240, content});
  win.querySelector('#media-file').addEventListener('change', (e)=>{ const f = e.target.files[0]; if (!f) return; const url = URL.createObjectURL(f); const a = win.querySelector('#media-audio'); a.src = url; a.play(); });
}*/

/*// Add Desmos/Maps/Spotify quick apps
function addIframeApps(){
  const apps = [ {id:'desmos', title:'Desmos 3D', src:'https://www.desmos.com/calculator'}, {id:'maps', title:'Maps', src:'https://www.google.com/maps'}, {id:'spotify', title:'Spotify', src:'https://open.spotify.com'} ];
  apps.forEach(a=>{
    const content = `<iframe src='${a.src}' style='width:100%;height:100%;border:0'></iframe>`;
    WindowManager.createWindow({id:'win-'+a.id, title:a.title, width:1000, height:700, x:120, y:120, content});
  });
}*/

// Accessibility/VR affordances (basic)
function applyAccessibility(){
  document.documentElement.style.fontSize = store.get('uiScale', '16px');
}

// Start up
window.addEventListener('DOMContentLoaded', async ()=>{ setupShell(); wireNav(); applyWallpaper(); await migrateContentSections(); scaffoldApps(); addIframeApps(); applyAccessibility(); });

