const debug = require("debug")("cliprecv");
import nacl from "tweetnacl";
import qrcodeJs from "qrcode-js";
import {
    QAction,
    QApplication,
    QClipboardMode,
    QIcon,
    QLabel,
    QMainWindow,
    QMenu,
    QPixmap,
    QSystemTrayIcon,
    QSystemTrayIconActivationReason,
    WidgetAttribute,
    WidgetEventTypes,
    WindowType,
} from "@nodegui/nodegui";

import listenForDweet from "./listenForDweet";
import * as hex from "./hex";
import logo from "../assets/logo.png";

const newPixmap = (buf: Buffer) => {
    const retval = new QPixmap();
    retval.loadFromData(buf, "PNG");
    return retval;
};
const newPixmapLabel = (pixmap: QPixmap) => {
    const retval = new QLabel();
    retval.setPixmap(pixmap);
    return retval;
};

const icon = new QIcon(logo);

const newQRCodeWin = (qrcodeBuf: Buffer) => {
    const win = new QMainWindow();
    win.setWindowTitle("cliprecv");
    win.setWindowIcon(icon);
    win.setWindowFlag(WindowType.CustomizeWindowHint, true);
    win.setWindowFlag(WindowType.Tool, true);
    win.setWindowFlag(WindowType.WindowStaysOnTopHint, true);
    win.setWindowFlag(WindowType.WindowSystemMenuHint, false);
    win.setWindowFlag(WindowType.WindowMinimizeButtonHint, false);
    win.setWindowFlag(WindowType.WindowMaximizeButtonHint, false);
    win.setWindowFlag(WindowType.WindowCloseButtonHint, true);
    win.setWindowFlag(WindowType.MSWindowsFixedSizeDialogHint, true);
    win.setAttribute(WidgetAttribute.WA_MacAlwaysShowToolWindow, true);
    win.setAttribute(WidgetAttribute.WA_QuitOnClose, false);
    win.setCentralWidget(newPixmapLabel(newPixmap(qrcodeBuf)));
    win.center();
    win.setFixedSize(246, 246);
    return win;
};

let win: QMainWindow | null = null;
const startNewRecvSession = () => {
    if (win !== null) {
        win.show();
        win.activateWindow();
        return;
    }
    const kp = nacl.box.keyPair();
    debug(JSON.stringify({pk: hex.to(kp.publicKey)}));

    const qrcodeString = JSON.stringify({pk: hex.to(kp.publicKey)});
    const qrcodeBuf = Buffer.from(qrcodeJs.toBase64(qrcodeString, 6), "base64");
    win = newQRCodeWin(qrcodeBuf);

    const listener = listenForDweet(hex.to(kp.publicKey), (dweet) => {
        debug(dweet);

        const b: {
            c: Buffer,
            n: Buffer,
            pk: Buffer,
        } = {
            c: Buffer.from([]),
            n: Buffer.from([]),
            pk: Buffer.from([]),
        };
        try {
            b.c = hex.from(dweet.content.c);
            b.n = hex.from(dweet.content.n);
            b.pk = hex.from(dweet.content.pk);
        } catch (e) { debug(e); }
        debug(b);

        try {
            let mRaw = nacl.box.open(b.c, b.n, b.pk, kp.secretKey);
            if (mRaw === null) {
                throw new Error("unboxing failed, likely due to an authentication error.");
            }
            debug(mRaw);

            const mBuf = Buffer.from(mRaw).toString("utf8");
            debug(mBuf);

            let m = JSON.parse(mBuf);
            debug(m);

            if (typeof m !== "string") {
                m = JSON.stringify(m, undefined, "  ");
            }
            debug(m);

            m = m.replace(/\r?\n/g, "\r\n");
            debug(m);

            QApplication.clipboard().setText(m, QClipboardMode.Clipboard);
            debug("clipboard set");
        } catch (e) {
            debug(e);
        } finally {
            win?.hide();
            debug("window closed");
        }
    });
    win.addEventListener(WidgetEventTypes.Close, () => {
        debug("window close event");
        listener.abort();
        win = null;
        (global as any).win = null;
    });

    win.show();
    win.activateWindow();
    (global as any).win = win;
};

const newAction = (text: string, fn: (...args: any[]) => any) => {
    const retval = new QAction();
    retval.setText(text);
    retval.addEventListener("triggered", fn);
    return retval;
};
const newMenu = (items: (QAction | null)[]) => {
    const retval = new QMenu();
    for (let item of items) {
        if (item === null) {
            retval.addSeparator();
        } else {
            retval.addAction(item);
        }
    }
    return retval;
};

const tray = new QSystemTrayIcon();
tray.setIcon(icon);
tray.setToolTip("cliprecv");
tray.setContextMenu(newMenu([
    newAction("Receive", () => {
        debug("tray menu receive");
        setTimeout(startNewRecvSession, 0);
    }),
    null,
    newAction("Quit", () => {
        debug("tray menu quit");
        win?.hide();
        tray?.hide();
        process.exit(0);
    }),
]));
tray.addEventListener("activated", (reason) => {
    if (reason !== QSystemTrayIconActivationReason.Trigger) {
        return;
    }
    debug("tray menu triggered");
    setTimeout(startNewRecvSession, 0);
});
tray.show();
(global as any).tray = tray;
