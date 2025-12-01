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
    <title>Gartic v5.0 Fixed</title>
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

        /* UI */
        .panel {
            background: var(--glass); padding: 25px; border-radius: 30px;
            box-shadow: var(--shadow); text-align: center; width: 95%; max-width: 500px;
            display: flex; flex-direction: column; gap: 10px; max-height: 95vh; overflow-y: auto;
        }
        .btn {
            border: none; padding: 12px 20px; border-radius: 50px;
            font-family: 'Fredoka One', cursive; font-size: 1.1rem;
            color: white; background: var(--primary); box-shadow: 0 5px 0 #4834d4;
            cursor: pointer; transition: 0.1s; position: relative; top: 0; width: 100%;
        }
        .btn:active { top: 5px; box-shadow: none; }
        .btn-accent { background: var(--accent); box-shadow: 0 5px 0 #00a884; }
        .input-std { padding: 12px; border-radius: 15px; border: 2px solid #ddd; font-size: 1rem; width: 100%; outline: none; font-weight: bold; }
        
        /* CANVAS */
        .canvas-wrapper {
            position: relative; border-radius: 15px; overflow: hidden;
            box-shadow: var(--shadow); background: white;
            width: 85vw; max-width: 1000px; aspect-ratio: 16/9; cursor: crosshair; margin: 0 auto;
        }
        canvas { display: block; width: 100%; height: 100%; }

        /* TOOLS */
        .toolbar {
            background: white; padding: 10px; border-radius: 20px; box-shadow: var(--shadow);
            display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; align-items: center;
            margin-top: 10px; width: 90vw;
        }
        .tool-btn {
            width: 40px; height: 40px; border-radius: 10px; border: none; background: #f0f2f5;
            font-size: 1.2rem; cursor: pointer; display: flex; justify-content: center; align-items: center;
        }
        .tool-btn.active { background: var(--primary); color: white; transform: scale(1.1); }
        .color-dot { width: 25px; height: 25px; border-radius: 50%; border: 2px solid #ddd; cursor: pointer; }
        .color-dot.active { transform: scale(1.3); border-color: #333; }

        /* GHOST ELEMENT (TEXT/IMG PREVIEW) */
        #ghostElem {
            position: fixed; pointer-events: none; opacity: 0.7; z-index: 999;
            transform-origin: center center; display: none; white-space: nowrap; font-family: 'Nunito'; font-weight: 900;
        }

        /* CHAT */
        #presContainer {
            width: 100%; height: 60vh; background: rgba(255,255,255,0.7);
            border-radius: 20px; padding: 15px; overflow-y: auto;
            display: flex; flex-direction: column; gap: 10px; scroll-behavior: smooth;
        }
        .msg { max-width: 85%; padding: 10px 15px; border-radius: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); animation: slideUp 0.3s; }
        .msg-info { align-self: center; background: var(--accent); color: white; font-weight: bold; }
        .msg-l { align-self: flex-start; background: white; border-bottom-left-radius: 2px; }
        .msg-r { align-self: flex-end; background: #d1d8e0; border-bottom-right-radius: 2px; text-align: right; }
        .msg img { max-width: 100%; border-radius: 10px; border: 2px solid white; }
        @keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
    </style>
</head>
<body>

    <!-- GHOST PREVIEW -->
    <div id="ghostElem"></div>

    <!-- 1. LOGIN -->
    <div id="screenLogin" class="panel">
        <h1>Gartic <span style="color:var(--accent)">v5.0</span></h1>
        <input id="inpName" class="input-std" placeholder="Никнейм" maxlength="12">
        <input id="inpRoom" class="input-std" placeholder="Комната" maxlength="10">
        <button class="btn" onclick="join()">ВОЙТИ</button>
    </div>

    <!-- 2. LOBBY -->
    <div id="screenLobby" class="panel hidden">
        <h2>Комната: <span id="lblRoom" style="color:var(--primary)"></span></h2>
        <div id="listPlayers" style="display:flex; flex-wrap:wrap; justify-content:center; gap:5px"></div>
        
        <div id="hostArea" class="hidden" style="border-top: 2px solid #eee; padding-top: 10px; width:100%">
            <div style="display:flex; justify-content:space-between; font-size:0.9rem;">
                <span>Текст: <b id="valTimeText">60</b>с</span>
                <span>Рис: <b id="valTimeDraw">120</b>с</span>
            </div>
            <input type="range" min="30" max="180" step="10" value="60" oninput="updSet('write', this.value)">
            <input type="range" min="60" max="300" step="10" value="120" oninput="updSet('draw', this.value)">
            
            <p style="margin:5px 0">Длительность игры: <b id="valPerc">100%</b></p>
            <input type="range" min="50" max="300" step="50" value="100" oninput="updSet('mod', this.value)">
            
            <button class="btn btn-accent" style="margin-top:10px" onclick="startGame()">НАЧАТЬ</button>
        </div>
        <p id="waitMsg" class="hidden">Ждем хоста...</p>
    </div>

    <!-- 3. TEXT ROUND -->
    <div id="screenText" class="panel hidden">
        <div id="prevDrawContainer"></div>
        <h3 id="textPrompt">Задание:</h3>
        <input id="inpGameText" class="input-std" placeholder="Пиши сюда...">
        <button class="btn" onclick="subText()">ГОТОВО</button>
    </div>

    <!-- 4. DRAW ROUND -->
    <div id="screenDraw" class="hidden" style="width:100vw; height:100vh; flex-direction:column; align-items:center; justify-content:center;">
        <div style="background:white; padding:5px 20px; border-radius:20px; margin-bottom:5px; box-shadow:0 5px 10px rgba(0,0,0,0.1); font-weight:bold; z-index:100">
            <span id="lblPrompt">...</span> | <span id="lblTimer" style="color:var(--warn)">00:00</span>
        </div>

        <div class="canvas-wrapper">
            <canvas id="cvs" width="1280" height="720"></canvas>
        </div>

        <div class="toolbar">
            <input type="color" id="colorPicker" value="#000000" onchange="setColor(this.value)" style="width:30px;height:30px;border:none;padding:0;background:none;cursor:pointer">
            <div class="color-dot" style="background:white" onclick="setColor('white')"></div>
            <div class="color-dot" style="background:black" onclick="setColor('black')"></div>
            <div class="color-dot" style="background:#d63031" onclick="setColor('#d63031')"></div>
            <div class="color-dot" style="background:#0984e3" onclick="setColor('#0984e3')"></div>
            <div style="width:1px;height:25px;background:#ccc;margin:0 5px"></div>

            <button class="tool-btn active" onclick="setTool('brush', this)">🖌️</button>
            <button class="tool-btn" onclick="setTool('fill', this)">🪣</button>
            <button class="tool-btn" onclick="setTool('rect', this)">⬜</button>
            <button class="tool-btn" onclick="setTool('circle', this)">⚪</button>
            <label style="font-size:0.8rem; display:flex; align-items:center; gap:2px">
                <input type="checkbox" id="chkFill"> Залив
            </label>
            
            <div style="width:1px;height:25px;background:#ccc;margin:0 5px"></div>
            
            <button class="tool-btn" onclick="setTool('text', this)" title="Текст-штамп">A</button>
            <label class="tool-btn" title="Загрузить фото">
                🖼️ <input type="file" hidden accept="image/*" onchange="loadImg(this)">
            </label>
            
            <button class="tool-btn" onclick="undo()">↩️</button>
            <button class="tool-btn" style="color:red" onclick="wipe()">🗑️</button>
            <button class="btn btn-accent" style="width:auto; padding:8px 20px; font-size:1rem" onclick="subDraw()">✔</button>
        </div>

        <!-- STAMP CONTROLS (TEXT/IMG) -->
        <div id="stampControls" class="toolbar hidden" style="margin-top:5px; background:#f1f2f6">
            <input id="txtInput" class="input-std" style="width:150px; padding:5px;" placeholder="Текст..." oninput="updateGhost()">
            <span>Размер:</span>
            <input type="range" min="0.5" max="5" step="0.1" value="1" oninput="ghostScale=parseFloat(this.value); updateGhost()">
            <span>Угол:</span>
            <input type="range" min="0" max="360" step="5" value="0" oninput="ghostRot=parseInt(this.value); updateGhost()">
        </div>
    </div>

    <!-- 5. PRES -->
    <div id="screenPres" class="panel hidden" style="max-height:90vh; width:95%; max-width:600px">
        <h2>Результаты</h2>
        <div id="presContainer"></div>
        <div id="hostControls" class="hidden" style="display:flex; gap:10px; justify-content:center; margin-top:10px">
            <button class="btn" style="width:auto" onclick="socket.emit('presNext')">👇</button>
            <button class="btn btn-warn" style="width:auto" onclick="socket.emit('presSkip')">⏭</button>
        </div>
        <div id="lobbyBtn" class="hidden">
             <button class="btn btn-accent" onclick="socket.emit('returnToLobby')">🏠 В ЛОББИ (Без перезагрузки)</button>
        </div>
    </div>

    <script>
        const socket = io();
        let myId, room, isHost=false;
        
        // CANVAS VARS
        const cvs = document.getElementById('cvs');
        const ctx = cvs.getContext('2d', {willReadFrequently: true});
        let painting=false, tool='brush', color='black';
        let hist=[], snapshot;
        let startX, startY;
        
        // STAMP VARS (Text/Img)
        let ghostMode = null; // 'text' or 'img'
        let ghostObj = null; // Image object or Text string
        let ghostScale=1, ghostRot=0;
        let mouseX=0, mouseY=0;

        ctx.fillStyle='white'; ctx.fillRect(0,0,1280,720); save();

        function save() { if(hist.length>8) hist.shift(); hist.push(cvs.toDataURL()); }
        function undo() { if(hist.length) { let i=new Image(); i.src=hist.pop(); i.onload=()=>ctx.drawImage(i,0,0); } }
        function wipe() { ctx.fillRect(0,0,1280,720); save(); }
        
        function setColor(c) { color=c; updateGhost(); }
        
        function setTool(t, el) {
            tool = t;
            document.querySelectorAll('.tool-btn').forEach(b=>b.classList.remove('active'));
            if(el) el.classList.add('active');
            
            // Ghost Reset
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
                        ghostMode = 'img';
                        ghostObj = i;
                        tool = 'stamp'; // Internal tool name
                        document.getElementById('stampControls').classList.remove('hidden');
                        document.getElementById('txtInput').style.display = 'none';
                        updateGhost();
                    }
                };
                r.readAsDataURL(inp.files[0]);
            }
        }

        // --- GHOST LOGIC (Text/Img Preview) ---
        function updateGhost() {
            const el = document.getElementById('ghostElem');
            if(!ghostMode) { el.style.display='none'; return; }
            
            el.style.display = 'block';
            el.style.transform = \`translate(-50%, -50%) rotate(\${ghostRot}deg) scale(\${ghostScale})\`;
            
            if(ghostMode === 'text') {
                const txt = document.getElementById('txtInput').value || 'Текст';
                ghostObj = txt;
                el.innerText = txt;
                el.style.color = color;
                el.style.fontSize = '40px';
                el.innerHTML = txt; // Reset content
                // Remove img if any
                while(el.firstChild && el.firstChild.tagName==='IMG') el.removeChild(el.firstChild);
            } else if(ghostMode === 'img' && ghostObj) {
                el.innerText = '';
                if(!el.querySelector('img')) el.appendChild(ghostObj.cloneNode());
                else el.querySelector('img').src = ghostObj.src;
            }
        }

        // --- MOUSE EVENTS ---
        function getPos(e) {
            const r = cvs.getBoundingClientRect();
            const x = (e.touches?e.touches[0].clientX:e.clientX) - r.left;
            const y = (e.touches?e.touches[0].clientY:e.clientY) - r.top;
            return { x: x*(1280/r.width), y: y*(720/r.height) };
        }

        window.addEventListener('mousemove', e => {
            const el = document.getElementById('ghostElem');
            if(ghostMode && el.style.display !== 'none') {
                el.style.left = e.clientX + 'px';
                el.style.top = e.clientY + 'px';
            }
        });

        cvs.addEventListener('mousedown', start); cvs.addEventListener('touchstart', start);
        cvs.addEventListener('mousemove', move); cvs.addEventListener('touchmove', move);
        cvs.addEventListener('mouseup', end); cvs.addEventListener('touchend', end);

        function start(e) {
            const p = getPos(e);
            startX = p.x; startY = p.y;
            
            if(ghostMode) {
                // STAMP IT
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(ghostRot * Math.PI/180);
                ctx.scale(ghostScale, ghostScale);
                if(ghostMode === 'text') {
                    ctx.font = "bold 40px Nunito";
                    ctx.fillStyle = color;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(ghostObj, 0, 0);
                } else {
                    ctx.drawImage(ghostObj, -ghostObj.width/2, -ghostObj.height/2);
                }
                ctx.restore();
                save();
                return;
            }

            if(tool === 'fill') { floodFill(Math.floor(p.x), Math.floor(p.y), color); save(); return; }
            
            painting = true;
            snapshot = ctx.getImageData(0,0,1280,720); // Save for shapes
            ctx.beginPath(); ctx.moveTo(p.x, p.y);
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.lineWidth = 5; ctx.strokeStyle = color; ctx.fillStyle = color;
        }

        function move(e) {
            if(!painting) return;
            e.preventDefault();
            const p = getPos(e);
            
            if(tool === 'brush') {
                ctx.lineTo(p.x, p.y); ctx.stroke();
            } else if (tool === 'rect' || tool === 'circle') {
                ctx.putImageData(snapshot, 0, 0); // Restore prev frame
                ctx.beginPath();
                const w = p.x - startX, h = p.y - startY;
                const fill = document.getElementById('chkFill').checked;
                
                if(tool === 'rect') {
                    if(fill) ctx.fillRect(startX, startY, w, h);
                    else ctx.strokeRect(startX, startY, w, h);
                } else {
                    ctx.beginPath();
                    // Ellipse approximation
                    ctx.ellipse(startX + w/2, startY + h/2, Math.abs(w/2), Math.abs(h/2), 0, 0, 2*Math.PI);
                    if(fill) ctx.fill(); else ctx.stroke();
                }
            }
        }

        function end() { if(painting) save(); painting=false; }

        // FLOOD FILL
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

        // --- GAME LOGIC ---
        function show(id) { document.querySelectorAll('.panel, #screenDraw').forEach(e=>e.classList.add('hidden')); document.getElementById(id).classList.remove('hidden'); if(id.includes('screen')) document.getElementById(id).style.display = 'flex'; }
        
        function join() {
            const name = document.getElementById('inpName').value;
            room = document.getElementById('inpRoom').value;
            if(name&&room) socket.emit('join', {name, room});
        }
        
        function updSet(key, val) { 
            if(key==='write') document.getElementById('valTimeText').innerText = val;
            if(key==='draw') document.getElementById('valTimeDraw').innerText = val;
            if(key==='mod') document.getElementById('valPerc').innerText = val+'%';
            socket.emit('set', {room, key, val}); 
        }
        function startGame() { socket.emit('start', room); }
        function subText() { socket.emit('turn', {room, type:'text', data: document.getElementById('inpGameText').value}); showWait(); }
        function subDraw() { socket.emit('turn', {room, type:'img', data: cvs.toDataURL('image/jpeg', 0.6)}); showWait(); }
        function showWait() { show('screenLobby'); document.getElementById('waitMsg').classList.remove('hidden'); document.getElementById('hostArea').classList.add('hidden'); }

        socket.on('joined', d => {
            isHost = d.isHost;
            show('screenLobby');
            document.getElementById('lblRoom').innerText = room;
            if(isHost) document.getElementById('hostArea').classList.remove('hidden');
            else document.getElementById('waitMsg').classList.remove('hidden');
        });

        socket.on('players', list => {
            document.getElementById('listPlayers').innerHTML = list.map(p=>
                \`<div style="background:\${p.done?'#00b894':'white'}; padding:8px 12px; border-radius:15px; box-shadow:0 3px 0 #ccc">\${p.isHost?'👑':''} \${p.name}</div>\`
            ).join('');
        });
        
        socket.on('settings', s => {
             document.getElementById('valTimeText').innerText = s.tWrite;
             document.getElementById('valTimeDraw').innerText = s.tDraw;
             document.getElementById('valPerc').innerText = s.mod+'%';
        });

        socket.on('round', d => {
            if(d.type==='text') {
                show('screenText');
                document.getElementById('inpGameText').value = '';
                document.getElementById('textPrompt').innerText = d.prev ? "Что это такое?" : "Придумай что-нибудь:";
                document.getElementById('prevDrawContainer').innerHTML = d.prev ? \`<img src="\${d.prev}" style="max-height:200px; border-radius:15px">\` : '';
            } else {
                show('screenDraw');
                wipe();
                document.getElementById('lblPrompt').innerText = d.prev;
                // Reset tools
                setTool('brush', document.querySelector('.tool-btn'));
            }
        });
        
        socket.on('timer', t => document.getElementById('lblTimer').innerText = t);

        socket.on('presStart', () => {
            show('screenPres');
            document.getElementById('presContainer').innerHTML = '';
            document.getElementById('lobbyBtn').classList.add('hidden');
            if(isHost) document.getElementById('hostControls').classList.remove('hidden');
        });

        socket.on('presItem', d => {
            const c = document.getElementById('presContainer');
            let h = '';
            if(d.type==='info') h = \`<div class="msg msg-info">\${d.owner}</div>\`;
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
            show('screenLobby');
            document.getElementById('waitMsg').classList.remove('hidden');
            if(isHost) document.getElementById('hostArea').classList.remove('hidden');
            // Clean UI
            document.getElementById('presContainer').innerHTML = '';
        });

    </script>
</body>
</html>
`;

app.get('/', (req,res) => res.send(htmlContent));

io.on('connection', s => {
    s.on('join', ({name, room}) => {
        s.join(room);
        if(!rooms[room]) rooms[room] = { id:room, pl:[], state:'lobby', round:0, chains:[], settings:{mod:100, tWrite:60, tDraw:120} };
        const r = rooms[room];
        r.pl.push({id:s.id, name, isHost: r.pl.length===0, done:false});
        s.emit('joined', {isHost: r.pl[0].id===s.id});
        io.to(room).emit('players', r.pl);
        s.emit('settings', r.settings);
    });

    s.on('set', ({room, key, val}) => { 
        if(rooms[room]) {
            if(key==='write') rooms[room].settings.tWrite = parseInt(val);
            if(key==='draw') rooms[room].settings.tDraw = parseInt(val);
            if(key==='mod') rooms[room].settings.mod = parseInt(val);
            io.to(room).emit('settings', rooms[room].settings);
        }
    });

    s.on('start', room => {
        const r = rooms[room];
        if(!r) return;
        r.state = 'game'; r.round = 1; r.chains = r.pl.map(p=>[]); r.roundData=[];
        r.maxRounds = Math.max(2, Math.ceil(r.pl.length * (r.settings.mod/100)));
        newRound(r);
    });

    s.on('turn', ({room, type, data}) => {
        const r = rooms[room];
        if(!r || r.state!=='game') return;
        const p = r.pl.find(x=>x.id===s.id);
        if(p && !p.done) {
            p.done = true;
            r.roundData.push({uid:s.id, author:p.name, type, data});
            io.to(room).emit('players', r.pl);
            if(r.pl.every(x=>x.done)) endRound(r);
        }
    });

    s.on('presNext', () => {
        const r = getRoom(s);
        if(!r) return;
        const chain = r.chains[r.presIdx];
        if(r.presStep < 0) {
             io.to(r.id).emit('presItem', {type:'info', owner: r.pl[r.presIdx].name});
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
        if(r.presIdx >= r.pl.length) io.to(r.id).emit('gameOver');
        else {
            r.presStep = -1;
            io.to(r.id).emit('presStart');
            io.to(r.id).emit('presItem', {type:'info', owner: r.pl[r.presIdx].name});
            r.presStep = 0;
        }
    });

    // --- FIX: RETURN TO LOBBY WITHOUT DISCONNECT ---
    s.on('returnToLobby', () => {
        const r = getRoom(s);
        if(r) {
            r.state = 'lobby';
            r.round = 0;
            r.playersData = [];
            r.chains = [];
            r.pl.forEach(p => p.done = false);
            io.to(r.id).emit('lobbyReturn');
            io.to(r.id).emit('players', r.pl);
        }
    });

    s.on('disconnect', () => {
        // Simple cleanup
        for(let id in rooms) {
            rooms[id].pl = rooms[id].pl.filter(p=>p.id!==s.id);
            if(rooms[id].pl.length===0) delete rooms[id];
            else io.to(id).emit('players', rooms[id].pl);
        }
    });
});

function newRound(r) {
    r.pl.forEach(p=>p.done=false);
    io.to(r.id).emit('players', r.pl);
    r.roundData = [];
    
    const isText = r.round%2 !== 0;
    const time = isText ? r.settings.tWrite : r.settings.tDraw;
    
    r.pl.forEach((p, i) => {
        let chainIdx = (i - (r.round-1)) % r.pl.length;
        if(chainIdx < 0) chainIdx += r.pl.length;
        p.chainIdx = chainIdx;
        let prev = null;
        if(r.round > 1) {
            let c = r.chains[chainIdx];
            prev = c[c.length-1].data;
        }
        io.to(p.id).emit('round', {type: isText?'text':'img', prev});
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
    r.pl.forEach(p => {
        const t = r.roundData.find(x=>x.uid===p.id);
        const item = t ? t : {type:'text', data:'AFK', author:p.name};
        r.chains[p.chainIdx].push(item);
    });
    if(r.round >= r.maxRounds) {
        r.state = 'pres'; r.presIdx=0; r.presStep=-1;
        io.to(r.id).emit('presStart');
    } else {
        r.round++;
        newRound(r);
    }
}

function getRoom(s) { for(let id in rooms) if(rooms[id].pl.find(p=>p.id===s.id)) return rooms[id]; return null; }

const PORT = process.env.PORT || 3000;
http.listen(PORT, ()=>console.log('Server 3000'));