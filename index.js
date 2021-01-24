process.on("unhandledRejection", ()=>{ process.exit(-1); });
const debug = require("debug")("cliprecv");
const nacl = require("tweetnacl");
const qrcodeJs = require("qrcode-js");
const electron = require("electron");

const listenForDweet = require("./listenForDweet");
const hex = require("./hex");

let win = null;
const startNewRecvSession = ()=>{
    if (win !== null) {
        win.focus();
        return;
    }
    const kp = nacl.box.keyPair();
    debug(JSON.stringify({pk: hex.to(kp.publicKey)}));
    
    const qrcodeString = JSON.stringify({pk: hex.to(kp.publicKey)});
    const qrcodeUri = qrcodeJs.toDataURL(qrcodeString, 6);
    
    win = new electron.BrowserWindow({
        useContentSize: true,
        height: 246,
        width: 246,
        title: "cliprecv",
        type: "toolbar",
        skipTaskbar: true,
        alwaysOnTop: true,
        center: true,
        resizable: false,
        minimizable: false,
        maximizable: false,
        show: false
    });
    win.setMenu(null);
    win.loadURL(qrcodeUri);
    win.once('ready-to-show', async()=>{
        await win.webContents.executeJavaScript("document.addEventListener('dragover', event => event.preventDefault())");
        await win.webContents.executeJavaScript("document.addEventListener('drop', event => event.preventDefault())");
        
        win.show();
    });
    win.on('page-title-updated', (event)=>{
        event.preventDefault();
    });
    
    const listener = listenForDweet(hex.to(kp.publicKey), (dweet)=>{
        debug(dweet);
        
        const b = {};
        try {
            b.c = hex.from(dweet.content.c);
            b.n = hex.from(dweet.content.n);
            b.pk = hex.from(dweet.content.pk);
        } catch (e) { debug(e); }
        debug(b);
        
        try {
            m = nacl.box.open(b.c, b.n, b.pk, kp.secretKey);
            if (m === null) throw new Error("unboxing failed, likely due to an authentication error.");
        } catch (e) { debug(e); }
        debug(m);
        
        m = Buffer.from(m).toString("utf8");
        debug(m);
        
        m = JSON.parse(m);
        debug(m);
        
        if (typeof m !== "string") m = JSON.stringify(m, "  ");
        debug(m);
        
        m = m.replace(/\r?\n/g, "\r\n");
        debug(m);
        
        electron.clipboard.writeText(m);
        
        win.close();
    });
    win.on('close', ()=>{
        listener.abort();
        win = null;
    });
};

electron.app.on('window-all-closed', (event) => {
    //electron.app.quit();
    event.preventDefault();
});

electron.app.on("ready", ()=>{
    const tray = new electron.Tray(electron.nativeImage.createFromPath("icon.png"));
    tray.setToolTip("cliprecv");
    tray.setContextMenu(electron.Menu.buildFromTemplate([
        {label: 'Quit', type: 'normal', role: "quit"}
    ]));
    tray.on("click", ()=>{
        startNewRecvSession();
    });
});