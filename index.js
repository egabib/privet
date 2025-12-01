const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// --- ХРАНИЛИЩЕ ---
const rooms = {};

const htmlContent = `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Gartic v7.1 Fixed</title>
    <link href="https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@700;900&display=swap" rel="stylesheet">
    <script src="/socket.io/socket.io.js"></script>
    <style>
        :root {
            --bg: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            --glass: rgba(255, 255, 255, 0.95);
            --primary: #6c5ce7; --accent: #00b894; --warn: #ff7675;
            --shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        * { box-sizing: border-box; user-select: none; -webkit-tap-highlight-color: transparent; }
        body { margin: 0; padding: 0; height: 100vh; overflow: hidden; background: var(--bg); font-family: 'Nunito', sans-serif; display: flex; align-items: center; justify-content: center; }
        .hidden { display: none !important; }

        /* HEADER */
        #gameHeader {
            position: fixed; top: 0; left: 0; width: 100%; height: 50px;
            background: rgba(255,255,255,0.95); box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            display: flex; justify-content: space-between; align-items: center; padding: 0 15px;
            z-index: 2000; font-weight: bold;
        }
        .timer-badge { background: var(--warn); color: white; padding: 4px 10px; border-radius: 8px; font-family: monospace; font-size: 1.2rem; }

        /* PANELS */
        .panel {
            background: var(--glass); padding: 20px; border-radius: 25px;
            box-shadow: var(--shadow); text-align: center; width: 95%; max-width: 500px;
            display: flex; flex-direction: column; gap: 10px; max-height: 90vh; overflow-y: auto;
            position: relative; z-index: 10;
        }
        .btn {
            border: none; padding: 12px; border-radius: 50px;
            font-family: 'Fredoka One', cursive; font-size: 1.1rem;
            color: white; background: var(--primary); box-shadow: 0 4px 0 #4834d4;
            cursor: pointer; transition: 0.1s; width: 100%; margin-top: 5px;
        }
        .btn:active { transform: translateY(3px); box-shadow: none; }
        .btn-accent { background: var(--accent); box-shadow: 0 4px 0 #00a884; }
        .btn-warn { background: var(--warn); box-shadow: 0 4px 0 #d63031; }
        .input-std { padding: 10px; border-radius: 12px; border: 2px solid #ddd; width: 100%; font-weight: bold; }

        /* DRAW LAYOUT */
        .game-layout {
            display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 10px;
            width: 98vw; max-width: 1200px; height: 75vh;
        }
        .palette-side {
            display: flex; flex-direction: column; gap: 5px; background: white; padding: 5px;
            border-radius: 15px; box-shadow: var(--shadow); height: 100%; justify-content: center; overflow-y: auto;
        }
        .color-dot { width: 30px; height: 30px; border-radius: 50%; border: 2px solid rgba(0,0,0,0.1); cursor: pointer; }
        .color-dot.active { transform: scale(1.2); border-color: #333; }
        .canvas-wrapper {
            position: relative; border-radius: 15px; overflow: hidden;
            box-shadow: var(--shadow); background: white;
            flex-grow: 1; height: 100%; aspect-ratio: 16/9; cursor: crosshair; touch-action: none;
        }
        canvas { display: block; width: 100%; height: 100%; }

        /* TOOLBAR */
        .toolbar {
            background: white; padding: 8px; border-radius: 20px; box-shadow: var(--shadow);
            display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; align-items: center;
            margin-top: 5px; z-index: 100;
        }
        .tool-btn {
            width: 40px; height: 40px; border-radius: 10px; border: none; background: #f0f2f5;
            font-size: 1.2rem; cursor: pointer; display: flex; justify-content: center; align-items: center;
        }
        .tool-btn.active { background: var(--primary); color: white; transform: scale(1.1); }

        /* GHOST */
        #ghostElem {
            position: fixed; pointer-events: none; opacity: 0.7; z-index: 9999;
            transform-origin: center center; display: none; white-space: nowrap; font-family: 'Nunito'; font-weight: 900;
        }

        /* CHAT */
        #presContainer { width: 100%; height: 50vh; background: rgba(255,255,255,0.7); border-radius: 15px; padding: 10px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
        .msg { max-width: 90%; padding: 8px 12px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .msg-info { align-self: center; background: var(--accent); color: white; }
        .msg-l { align-self: flex-start; background: white; }
        .msg-r { align-self: flex-end; background: #dfe6e9; text-align: right; }
        .msg img { max-width: 100%; border-radius: 8px; }
    </style>
</head>
<body>

    <!-- HEADER (Visible inside game) -->
    <div id="gameHeader" class="hidden">
        <div style="display:flex; gap:10px">
            <button class="btn btn-warn" style="padding:5px 15px; width:auto; font-size:0.9rem; margin:0" onclick="leaveRoom()">🚪 ВЫЙТИ</button>
            <button class="btn" style="padding:5px 15px; width:auto; font-size:0.9rem; margin:0; background:#0984e3" onclick="copyLink()">🔗 COPY</button>
        </div>
        <div>
            <span id="lblReadyCount" style="color:var(--accent); margin-right:10px; font-size:0.9rem"></span>
            <span id="lblTimer" class="timer-badge">00:00</span>
        </div>
    </div>

    <!-- GHOST PREVIEW -->
    <div id="ghostElem"></div>

    <!-- 1. LOGIN -->
    <div id="screenLogin" class="panel">
        <h1>Gartic <span style="color:var(--accent)">v7.1</span></h1>
        <input id="inpName" class="input-std" placeholder="Никнейм" maxlength="12">
        <input id="inpRoom" class="input-std" placeholder="ID Комнаты" maxlength="10">
        <button class="btn" onclick="join()">ВОЙТИ</button>
    </div>

    <!-- 2. LOBBY -->
    <div id="screenLobby" class="panel hidden">
        <h2>Комната: <span id="lblRoom" style="color:var(--primary)"></span></h2>
        <div id="listPlayers" style="display:flex; flex-wrap:wrap; justify-content:center; gap:5px; margin-bottom:10px"></div>
        
        <div id="hostArea" class="hidden" style="border-top: 2px solid #eee; padding-top: 10px; width:100%; text-align:left">
            <label><b>Режим игры:</b></label>
            <select id="selGameMode" class="input-std" onchange="updSet('mode', this.value)" style="margin-bottom:5px">
                <option value="std">🎨 Стандарт (Текст - Рисунок)</option>
                <option value="story">📜 История (Только текст, 2x шагов)</option>
            </select>

            <div style="display:flex; justify-content:space-between; font-size:0.8rem;">
                <span>Текст: <b id="valTimeText">60</b>с</span>
                <span>Рис: <b id="valTimeDraw">120</b>с</span>
            </div>
            <input type="range" min="30" max="180" step="10" value="60" oninput="updSet('write', this.value)" style="width:100%">
            <input type="range" min="60" max="300" step="10" value="120" oninput="updSet('draw', this.value)" style="width:100%">
            
            <p style="margin:5px 0 0 0; font-size:0.9rem">Длительность: <b id="valPerc">100%</b></p>
            <input type="range" min="50" max="300" step="50" value="100" oninput="updSet('mod', this.value)" style="width:100%">
            
            <button class="btn btn-accent" style="margin-top:10px" onclick="startGame()">НАЧАТЬ ИГРУ</button>
        </div>
        <p id="waitMsg" class="hidden">Ждем хоста...</p>
        
        <!-- BIG BUTTONS FOR LOBBY -->
        <div style="display:flex; gap:10px; margin-top:10px">
            <button class="btn btn-warn" onclick="leaveRoom()">🚪 ВЫЙТИ</button>
            <button class="btn" style="background:#0984e3" onclick="copyLink()">🔗 ССЫЛКА</button>
        </div>
    </div>

    <!-- SPECTATOR -->
    <div id="screenSpec" class="panel hidden">
        <h2>Идет игра...</h2>
        <p>Вы наблюдатель.</p>
        <button class="btn btn-warn" onclick="leaveRoom()">ВЫЙТИ ИЗ КОМНАТЫ</button>
    </div>

    <!-- 3. TEXT ROUND -->
    <div id="screenText" class="panel hidden" style="margin-top:60px">
        <div id="prevDrawContainer"></div>
        <h3 id="textPrompt">Задание:</h3>
        <textarea id="inpGameText" class="input-std" rows="4" placeholder="Пиши сюда..."></textarea>
        <button id="btnSubText" class="btn" onclick="subText()">ГОТОВО</button>
        <p id="txtStatus" style="font-size:0.8rem; color:#aaa"></p>
    </div>

    <!-- 4. DRAW ROUND -->
    <div id="screenDraw" class="hidden" style="width:100vw; height:100vh; flex-direction:column; align-items:center; justify-content:center; padding-top:50px">
        <div style="background:white; padding:5px 20px; border-radius:20px; margin-bottom:5px; box-shadow:0 3px 6px rgba(0,0,0,0.1); font-weight:bold; z-index:100">
            <span id="lblPrompt">...</span>
        </div>

        <div class="game-layout">
            <!-- PALETTE LEFT -->
            <div class="palette-side">
                <div class="color-dot active" style="background:#000000" onclick="setColor('#000000', this)"></div>
                <div class="color-dot" style="background:#555555" onclick="setColor('#555555', this)"></div>
                <div class="color-dot" style="background:#d63031" onclick="setColor('#d63031', this)"></div>
                <div class="color-dot" style="background:#e17055" onclick="setColor('#e17055', this)"></div>
                <div class="color-dot" style="background:#fdcb6e" onclick="setColor('#fdcb6e', this)"></div>
                <div class="color-dot" style="background:#00b894" onclick="setColor('#00b894', this)"></div>
                <div class="color-dot" style="background:#0984e3" onclick="setColor('#0984e3', this)"></div>
                <div class="color-dot" style="background:#74b9ff" onclick="setColor('#74b9ff', this)"></div>
                <div class="color-dot" style="background:#6c5ce7" onclick="setColor('#6c5ce7', this)"></div>
                <div class="color-dot" style="background:#e84393" onclick="setColor('#e84393', this)"></div>
                <div class="color-dot" style="background:#634c46" onclick="setColor('#634c46', this)"></div>
                <div class="color-dot" style="background:#ffffff; border:1px solid #ccc" onclick="setColor('#ffffff', this)"></div>
            </div>

            <div class="canvas-wrapper">
                <canvas id="cvs" width="1280" height="720"></canvas>
            </div>
        </div>

        <!-- TOOLBAR -->
        <div class="toolbar">
            <button class="tool-btn active" onclick="setTool('brush', this)">🖌️</button>
            <input type="range" min="1" max="50" value="5" style="width:60px" oninput="brushSize=parseInt(this.value)">
            
            <button class="tool-btn" onclick="setTool('fill', this)">🪣</button>
            <button class="tool-btn" onclick="setTool('rect', this)">⬜</button>
            <button class="tool-btn" onclick="setTool('circle', this)">⚪</button>
            <label style="display:flex; align-items:center; font-size:0.8rem; cursor:pointer; gap:3px">
                <input type="checkbox" id="chkFillShape" style="width:16px; height:16px"> Залив
            </label>

            <div style="width:1px;height:30px;background:#ccc;margin:0 5px"></div>
            
            <button class="tool-btn" onclick="setTool('text', this)">A</button>
            <label class="tool-btn">🖼️ <input type="file" hidden accept="image/*" onchange="loadImg(this)"></label>
            
            <button class="tool-btn" onclick="undo()">↩️</button>
            <button class="tool-btn" style="color:red" onclick="wipe()">🗑️</button>
            <button id="btnSubDraw" class="btn btn-accent" style="width:auto; padding:0 20px;" onclick="subDraw()">✔</button>
        </div>

        <!-- STAMP UI -->
        <div id="stampControls" class="toolbar hidden" style="margin-top:5px; background:#f1f2f6">
            <input id="txtInput" class="input-std" style="width:150px; padding:5px;" placeholder="Текст..." oninput="updateGhost()">
            <span>Размер:</span>
            <input type="range" min="10" max="300" step="10" value="100" oninput="ghostScale=parseFloat(this.value)/100; updateGhost()">
            <span>Угол:</span>
            <input type="range" min="0" max="360" step="5" value="0" oninput="ghostRot=parseInt(this.value); updateGhost()">
        </div>
    </div>

    <!-- 5. PRES -->
    <div id="screenPres" class="panel hidden" style="width:95%; max-width:600px; padding-top:20px">
        <h2>Результаты</h2>
        <div id="presContainer"></div>
        <div id="hostControls" class="hidden" style="display:flex; gap:10px; justify-content:center; margin-top:10px">
            <button class="btn" style="width:auto" onclick="socket.emit('presNext')">👇 ДАЛЕЕ</button>
            <button class="btn btn-warn" style="width:auto" onclick="socket.emit('presSkip')">⏭ АЛЬБОМ</button>
        </div>
        <div id="lobbyBtn" class="hidden">
             <button class="btn btn-accent" onclick="socket.emit('returnToLobby')">🏠 В ЛОББИ</button>
        </div>
    </div>

    <script>
        const socket = io();
        let myId, room, isHost=false, isSpec=false;
        
        // AUTO FILL ROOM FROM URL
        window.onload = () => {
            const urlParams = new URLSearchParams(window.location.search);
            if(urlParams.has('room')) {
                document.getElementById('inpRoom').value = urlParams.get('room');
            }
        };

        // CANVAS
        const cvs = document.getElementById('cvs');
        const ctx = cvs.getContext('2d', {willReadFrequently: true});
        let painting=false, tool='brush', color='black', brushSize=5;
        let hist=[], snapshot;
        let startX, startY;
        
        // STAMP
        let ghostMode = null, ghostObj = null, ghostScale=1, ghostRot=0;

        ctx.fillStyle='white'; ctx.fillRect(0,0,1280,720); save();

        function save() { if(hist.length>8) hist.shift(); hist.push(cvs.toDataURL()); }
        function undo() { if(hist.length) { let i=new Image(); i.src=hist.pop(); i.onload=()=>ctx.drawImage(i,0,0); } }
        function wipe() { ctx.fillStyle='white'; ctx.fillRect(0,0,1280,720); save(); }
        
        function setColor(c, el) { 
            color=c; 
            if(el) { document.querySelectorAll('.color-dot').forEach(d=>d.classList.remove('active')); el.classList.add('active'); }
            updateGhost(); 
        }
        
        function setTool(t, el) {
            tool = t;
            document.querySelectorAll('.tool-btn').forEach(b=>b.classList.remove('active'));
            if(el) el.classList.add('active');
            
            document.getElementById('stampControls').classList.add('hidden');
            document.getElementById('ghostElem').style.display = 'none';
            ghostMode = null;
            
            if(t === 'text') {
                ghostMode = 'text';
                document.getElementById('stampControls').classList.remove('hidden');
                document.getElementById('txtInput').style.display = 'block';
                document.getElementById('txtInput').focus();
                updateGhost();
            }
        }

        function loadImg(inp) {
            if(inp.files && inp.files[0]) {
                const r = new FileReader();
                r.onload = e => {
                    let i = new Image();
                    i.src = e.target.result;
                    i.onload = () => {
                        ghostMode = 'img'; ghostObj = i; tool = 'stamp';
                        document.querySelectorAll('.tool-btn').forEach(b=>b.classList.remove('active'));
                        document.getElementById('stampControls').classList.remove('hidden');
                        document.getElementById('txtInput').style.display = 'none';
                        updateGhost();
                    }
                };
                r.readAsDataURL(inp.files[0]);
            }
            inp.value = '';
        }

        function updateGhost() {
            const el = document.getElementById('ghostElem');
            if(!ghostMode) { el.style.display='none'; return; }
            const r = cvs.getBoundingClientRect();
            const visualRatio = (r.width / 1280) * ghostScale;
            el.style.display = 'block';
            el.style.transform = \`translate(-50%, -50%) rotate(\${ghostRot}deg) scale(\${visualRatio})\`;
            
            if(ghostMode === 'text') {
                const txt = document.getElementById('txtInput').value || 'Текст';
                ghostObj = txt;
                el.innerText = txt;
                el.style.color = color;
                el.style.fontSize = '40px';
                el.innerHTML = txt; 
                while(el.firstChild && el.firstChild.tagName==='IMG') el.removeChild(el.firstChild);
            } else if(ghostMode === 'img' && ghostObj) {
                el.innerText = '';
                if(!el.querySelector('img')) el.appendChild(ghostObj.cloneNode());
                else el.querySelector('img').src = ghostObj.src;
            }
        }

        function getPos(e) {
            const r = cvs.getBoundingClientRect();
            const clientX = e.touches?e.touches[0].clientX:e.clientX;
            const clientY = e.touches?e.touches[0].clientY:e.clientY;
            return { 
                x: (clientX - r.left) * (1280/r.width), 
                y: (clientY - r.top) * (720/r.height),
                cX: clientX, cY: clientY
            };
        }

        window.addEventListener('mousemove', e => {
            const el = document.getElementById('ghostElem');
            if(ghostMode && el.style.display !== 'none') { el.style.left=e.clientX+'px'; el.style.top=e.clientY+'px'; }
        });
        window.addEventListener('touchmove', e => {
             const el = document.getElementById('ghostElem');
             if(ghostMode && el.style.display !== 'none' && e.touches.length>0) {
                el.style.left=e.touches[0].clientX+'px'; el.style.top=e.touches[0].clientY+'px';
            }
        }, {passive:false});

        cvs.addEventListener('mousedown', start); cvs.addEventListener('touchstart', start, {passive:false});
        cvs.addEventListener('mousemove', move); cvs.addEventListener('touchmove', move, {passive:false});
        cvs.addEventListener('mouseup', end); cvs.addEventListener('touchend', end);

        function start(e) {
            if(e.type === 'touchstart') e.preventDefault();
            const p = getPos(e);
            startX = p.x; startY = p.y;
            
            if(ghostMode) {
                const el = document.getElementById('ghostElem');
                el.style.left = p.cX + 'px'; el.style.top = p.cY + 'px';
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(ghostRot * Math.PI/180);
                ctx.scale(ghostScale, ghostScale);
                if(ghostMode === 'text') {
                    ctx.font = "bold 40px Nunito"; ctx.fillStyle = color;
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(ghostObj, 0, 0);
                } else ctx.drawImage(ghostObj, -ghostObj.width/2, -ghostObj.height/2);
                ctx.restore();
                save();
                return;
            }

            if(tool === 'fill') { floodFill(Math.floor(p.x), Math.floor(p.y), color); save(); return; }
            
            painting = true;
            snapshot = ctx.getImageData(0,0,1280,720); 
            ctx.beginPath(); ctx.moveTo(p.x, p.y);
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.lineWidth = brushSize; ctx.strokeStyle = color; ctx.fillStyle = color;
        }

        function move(e) {
            if(!painting) return;
            e.preventDefault();
            const p = getPos(e);
            
            if(tool === 'brush') {
                ctx.lineTo(p.x, p.y); ctx.stroke();
            } else if (tool === 'rect' || tool === 'circle') {
                ctx.putImageData(snapshot, 0, 0);
                ctx.beginPath();
                const w = p.x - startX, h = p.y - startY;
                const shouldFill = document.getElementById('chkFillShape').checked;
                
                if(tool === 'rect') {
                    if(shouldFill) ctx.fillRect(startX, startY, w, h);
                    else ctx.strokeRect(startX, startY, w, h);
                } else if(tool === 'circle') {
                    ctx.ellipse(startX + w/2, startY + h/2, Math.abs(w/2), Math.abs(h/2), 0, 0, 2 * Math.PI);
                    if(shouldFill) ctx.fill(); else ctx.stroke();
                }
            }
        }

        function end() { if(painting) save(); painting=false; }

        function floodFill(x,y,hex) {
            const id = ctx.getImageData(0,0,1280,720);
            const d = id.data;
            const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
            const pos = (y*1280+x)*4;
            const sr=d[pos], sg=d[pos+1], sb=d[pos+2];
            if(sr===r && sg===g && sb===b) return;
            const q=[[x,y]];
            while(q.length) {
                const [cx,cy] = q.pop();
                const i = (cy*1280+cx)*4;
                if(cx<0||cy<0||cx>=1280||cy>=720 || d[i]!==sr || d[i+1]!==sg || d[i+2]!==sb) continue;
                d[i]=r; d[i+1]=g; d[i+2]=b; d[i+3]=255;
                q.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);
            }
            ctx.putImageData(id,0,0);
        }

        // --- UI & LOGIC ---
        function show(id) { 
            document.querySelectorAll('.panel, #screenDraw').forEach(e=>e.classList.add('hidden')); 
            document.getElementById(id).classList.remove('hidden'); 
            if(id.includes('screen')) document.getElementById(id).style.display = 'flex';
            
            const h = document.getElementById('gameHeader');
            // Hide header in Login only. Show in Lobby, Game, Spec.
            if(id === 'screenLogin') h.classList.add('hidden');
            else h.classList.remove('hidden');
        }
        
        function join() {
            const name = document.getElementById('inpName').value;
            room = document.getElementById('inpRoom').value;
            if(name && room) socket.emit('join', {name, room});
            else alert("Заполни поля");
        }
        
        function leaveRoom() { window.location.href = window.location.href.split('?')[0]; }
        
        function copyLink() { 
            // FIX: Generate proper URL
            const url = window.location.protocol + '//' + window.location.host + '/?room=' + room;
            navigator.clipboard.writeText(url).then(() => {
                alert("Ссылка скопирована: " + url);
            });
        }
        
        function updSet(key, val) { 
            if(key==='write') document.getElementById('valTimeText').innerText = val;
            if(key==='draw') document.getElementById('valTimeDraw').innerText = val;
            if(key==='mod') document.getElementById('valPerc').innerText = val+'%';
            socket.emit('set', {room, key, val}); 
        }

        function startGame() { socket.emit('start', room); }
        
        function subText() { 
            const txt = document.getElementById('inpGameText').value;
            if(!txt) return alert("Напиши что-нибудь!");
            socket.emit('turn', {room, type:'text', data: txt}); 
            document.getElementById('btnSubText').innerText = "ОБНОВИТЬ";
            document.getElementById('btnSubText').classList.add('btn-accent');
            document.getElementById('txtStatus').innerText = "Принято. Ждем таймер.";
        }
        
        function subDraw() { 
            setTool('brush', document.querySelector('.tool-btn')); 
            socket.emit('turn', {room, type:'img', data: cvs.toDataURL('image/jpeg', 0.6)}); 
            const btn = document.getElementById('btnSubDraw');
            btn.innerText = "ОБНОВИТЬ"; btn.classList.remove('btn-accent'); btn.style.background = '#0984e3';
        }

        socket.on('joined', d => {
            isHost = d.isHost; isSpec = d.spectator;
            if(isSpec) { show('screenSpec'); document.getElementById('lblRoom').innerText = room; }
            else {
                show('screenLobby');
                document.getElementById('lblRoom').innerText = room;
                if(isHost) document.getElementById('hostArea').classList.remove('hidden');
                else document.getElementById('waitMsg').classList.remove('hidden');
            }
        });

        socket.on('players', list => {
            const doneCount = list.filter(p => p.done).length;
            const total = list.filter(p => !p.spectator).length;
            document.getElementById('lblReadyCount').innerText = \`Готово: \${doneCount}/\${total}\`;
            document.getElementById('listPlayers').innerHTML = list.map(p=>
                \`<div style="background:\${p.done?'#00b894':'white'}; padding:8px 12px; border-radius:12px; box-shadow:0 3px 0 #ccc; opacity:\${p.spectator?0.6:1}">
                \${p.isHost?'👑':''} \${p.name} \${p.spectator?'(👁)':''}</div>\`
            ).join('');
        });
        
        socket.on('settings', s => {
             document.getElementById('valTimeText').innerText = s.tWrite;
             document.getElementById('valTimeDraw').innerText = s.tDraw;
             document.getElementById('valPerc').innerText = s.mod + '%';
             if(isHost) document.getElementById('selGameMode').value = s.gameMode;
             else document.getElementById('selGameMode').value = s.gameMode;
        });

        socket.on('round', d => {
            if(isSpec) return;
            // Reset Buttons
            document.getElementById('btnSubText').innerText = "ГОТОВО";
            document.getElementById('btnSubText').classList.remove('btn-accent');
            document.getElementById('txtStatus').innerText = "";
            document.getElementById('btnSubDraw').innerText = "✔";
            document.getElementById('btnSubDraw').classList.add('btn-accent');
            document.getElementById('btnSubDraw').style.background = '';

            if(d.type==='text') {
                show('screenText');
                document.getElementById('inpGameText').value = '';
                if(d.mode === 'story') {
                     document.getElementById('textPrompt').innerText = d.prev ? "ПРОДОЛЖИ ИСТОРИЮ:" : "НАЧНИ ИСТОРИЮ:";
                     document.getElementById('prevDrawContainer').innerHTML = d.prev ? \`<div class="msg msg-l" style="font-size:1.1rem; text-align:left">\${d.prev}</div>\` : '';
                } else {
                     document.getElementById('textPrompt').innerText = d.prev ? "Что это такое?" : "Придумай задание:";
                     document.getElementById('prevDrawContainer').innerHTML = d.prev ? \`<img src="\${d.prev}" style="max-height:200px; border-radius:15px; border:2px solid #ccc">\` : '';
                }
            } else {
                show('screenDraw');
                wipe();
                document.getElementById('lblPrompt').innerText = d.prev;
                setTool('brush', document.querySelector('.tool-btn'));
            }
        });
        
        socket.on('timer', t => {
            const el = document.getElementById('lblTimer');
            el.innerText = t; el.style.background = parseInt(t)<=10 ? 'red' : 'var(--warn)';
        });

        socket.on('presStart', () => {
            show('screenPres');
            document.getElementById('presContainer').innerHTML = '';
            document.getElementById('lobbyBtn').classList.add('hidden');
            if(isHost) document.getElementById('hostControls').classList.remove('hidden');
        });

        socket.on('presItem', d => {
            const c = document.getElementById('presContainer');
            let h = '';
            if(d.type==='info') h = \`<div class="msg msg-info">Цепочка: \${d.owner}</div>\`;
            else if(d.type==='text') h = \`<div class="msg msg-l"><b>\${d.author}</b><br>\${d.data}</div>\`;
            else h = \`<div class="msg msg-r"><b>\${d.author}</b><br><img src="\${d.data}"></div>\`;
            let e = document.createElement('div'); e.innerHTML = h; c.appendChild(e.firstChild);
            c.scrollTop = c.scrollHeight;
        });

        socket.on('gameOver', () => {
            document.getElementById('hostControls').classList.add('hidden');
            if(isHost) document.getElementById('lobbyBtn').classList.remove('hidden');
        });

        socket.on('lobbyReturn', () => {
            isSpec = false;
            show('screenLobby');
            document.getElementById('waitMsg').classList.remove('hidden');
            if(isHost) document.getElementById('hostArea').classList.remove('hidden');
        });
    </script>
</body>
</html>
`;

app.get('/', (req,res) => res.send(htmlContent));

io.on('connection', s => {
    s.on('join', ({name, room}) => {
        s.join(room);
        // Default mod is 100%
        if(!rooms[room]) rooms[room] = { id:room, pl:[], state:'lobby', round:0, chains:[], settings:{gameMode:'std', mod:100, tWrite:60, tDraw:120} };
        const r = rooms[room];
        const isSpec = r.state !== 'lobby';
        r.pl.push({id:s.id, name, isHost: !isSpec && r.pl.length===0, done:false, spectator: isSpec});
        s.emit('joined', {isHost: !isSpec && r.pl.length===1, spectator: isSpec});
        io.to(room).emit('players', r.pl);
        s.emit('settings', r.settings);
    });

    s.on('set', ({room, key, val}) => { 
        if(rooms[room]) {
            if(key==='write') rooms[room].settings.tWrite = parseInt(val);
            if(key==='draw') rooms[room].settings.tDraw = parseInt(val);
            if(key==='mod') rooms[room].settings.mod = parseInt(val); // Restore Mod
            if(key==='mode') rooms[room].settings.gameMode = val;
            io.to(room).emit('settings', rooms[room].settings);
        }
    });

    s.on('start', room => {
        const r = rooms[room];
        if(!r) return;
        r.state = 'game'; r.round = 1; r.roundData=[];
        const active = r.pl.filter(p => !p.spectator);
        r.chains = active.map(p=>[]); 
        
        // CALC ROUNDS WITH SLIDER %
        const modMultiplier = r.settings.mod / 100;
        if(r.settings.gameMode === 'story') {
            r.maxRounds = Math.max(2, Math.ceil((active.length * 2) * modMultiplier));
        } else {
            r.maxRounds = Math.max(2, Math.ceil(active.length * modMultiplier));
        }
        
        newRound(r);
    });

    s.on('turn', ({room, type, data}) => {
        const r = rooms[room];
        if(!r || r.state!=='game') return;
        const p = r.pl.find(x=>x.id===s.id);
        if(p) {
            p.done = true;
            const idx = r.roundData.findIndex(x => x.uid === s.id);
            if(idx >= 0) { r.roundData[idx].data = data; r.roundData[idx].type = type; }
            else r.roundData.push({uid:s.id, author:p.name, type, data});
            io.to(room).emit('players', r.pl);
            const active = r.pl.filter(x => !x.spectator);
            if(active.every(x=>x.done)) endRound(r);
        }
    });

    s.on('presNext', () => {
        const r = getRoom(s);
        if(!r || r.presIdx >= r.chains.length) return;
        const chain = r.chains[r.presIdx];
        if(r.presStep < 0) {
             const ownerName = r.chainOwners ? r.chainOwners[r.presIdx] : "???";
             io.to(r.id).emit('presItem', {type:'info', owner: ownerName});
             r.presStep = 0;
        } else if(r.presStep < chain.length) {
             io.to(r.id).emit('presItem', chain[r.presStep]);
             r.presStep++;
        }
    });

    s.on('presSkip', () => {
        const r = getRoom(s);
        if(!r) return;
        r.presIdx++;
        if(r.presIdx >= r.chains.length) io.to(r.id).emit('gameOver');
        else {
            r.presStep = -1;
            io.to(r.id).emit('presStart'); 
            const ownerName = r.chainOwners ? r.chainOwners[r.presIdx] : "???";
            io.to(r.id).emit('presItem', {type:'info', owner: ownerName});
            r.presStep = 0;
        }
    });

    s.on('returnToLobby', () => {
        const r = getRoom(s);
        if(r) {
            r.state = 'lobby'; r.round = 0; r.roundData = []; r.chains = [];
            r.pl.forEach(p => { p.done = false; p.spectator = false; });
            io.to(r.id).emit('lobbyReturn');
            io.to(r.id).emit('players', r.pl);
        }
    });

    s.on('disconnect', () => {
        for(let id in rooms) {
            const r = rooms[id];
            const idx = r.pl.findIndex(p => p.id === s.id);
            if(idx !== -1) {
                const p = r.pl[idx];
                r.pl.splice(idx, 1);
                if(r.pl.length === 0) delete rooms[id];
                else {
                    if(p.isHost && r.pl[0]) r.pl[0].isHost = true;
                    io.to(id).emit('players', r.pl);
                    if(r.state === 'game') {
                         const active = r.pl.filter(x => !x.spectator);
                         if(active.length > 0 && active.every(x=>x.done)) endRound(r);
                    }
                }
            }
        }
    });
});

function newRound(r) {
    const active = r.pl.filter(p => !p.spectator);
    active.forEach(p=>p.done=false);
    io.to(r.id).emit('players', r.pl);
    r.roundData = [];
    
    if(r.round === 1) r.chainOwners = active.map(p => p.name);

    let isText = true;
    let time = r.settings.tWrite;
    
    if(r.settings.gameMode === 'story') {
        isText = true;
        time = r.settings.tWrite;
    } else {
        isText = r.round%2 !== 0;
        time = isText ? r.settings.tWrite : r.settings.tDraw;
    }
    
    active.forEach((p, i) => {
        let chainIdx = (i + (r.round-1)) % active.length;
        p.chainIdx = chainIdx; 
        let prev = null;
        if(r.round > 1) {
            let c = r.chains[chainIdx];
            if(c && c.length > 0) prev = c[c.length-1].data;
        }
        io.to(p.id).emit('round', {type: isText?'text':'img', prev, mode: r.settings.gameMode});
    });

    let t = time;
    if(r.tm) clearInterval(r.tm);
    r.tm = setInterval(()=> {
        t--; io.to(r.id).emit('timer', t<10?'0'+t:t);
        if(t<=0) endRound(r);
    }, 1000);
}

function endRound(r) {
    clearInterval(r.tm);
    const active = r.pl.filter(p => !p.spectator);
    active.forEach(p => {
        const t = r.roundData.find(x=>x.uid===p.id);
        const item = t ? t : {type:'text', data:'...', author:p.name};
        if(r.chains[p.chainIdx]) r.chains[p.chainIdx].push(item);
    });

    if(r.round >= r.maxRounds) {
        r.state = 'pres'; r.presIdx=0; r.presStep=-1;
        io.to(r.id).emit('presStart');
        const ownerName = r.chainOwners ? r.chainOwners[0] : "???";
        io.to(r.id).emit('presItem', {type:'info', owner: ownerName});
        r.presStep = 0;
    } else {
        r.round++;
        newRound(r);
    }
}

function getRoom(s) { for(let id in rooms) if(rooms[id].pl.find(p=>p.id===s.id)) return rooms[id]; return null; }

const PORT = process.env.PORT || 3000;
http.listen(PORT, ()=>console.log('Server 3000'));
