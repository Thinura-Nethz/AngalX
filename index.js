// == REQUIRED LIBRARIES ==
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  jidNormalizedUser,
  getContentType,
  fetchLatestBaileysVersion,
  Browsers
} = require('@whiskeysockets/baileys');

const fs = require('fs');
const P = require('pino');
const config = require('./config');
const qrcode = require('qrcode-terminal');
const { sms, downloadMediaMessage } = require('./lib/msg');
const { getBuffer, getGroupAdmins } = require('./lib/functions');
const axios = require('axios');
const { File } = require('megajs');
const prefix = '.';
const ownerNumber = ['94774571418'];
const express = require("express");
const app = express();
const port = process.env.PORT || 8000;

// ✅ IMPORT SONG FORMAT HANDLER
const { handlePendingChoice } = require("./plugins/song");

// == SESSION SETUP ==
if (!fs.existsSync(__dirname + '/auth_info_baileys/creds.json')) {
  if (!config.SESSION_ID) return console.log('Please add your session to SESSION_ID env !!');
  const sessdata = config.SESSION_ID;
  const filer = File.fromURL(`https://mega.nz/file/${sessdata}`);
  filer.download((err, data) => {
    if (err) throw err;
    fs.writeFile(__dirname + '/auth_info_baileys/creds.json', data, () => {
      console.log("Session downloaded ✅");
    });
  });
}

// == MAIN FUNCTION ==
async function connectToWA() {
  console.log("Connecting AngalX bot 🧬...");
  const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/auth_info_baileys/');
  const { version } = await fetchLatestBaileysVersion();

  const conn = makeWASocket({
    logger: P({ level: 'silent' }),
    printQRInTerminal: false,
    browser: Browsers.macOS("Firefox"),
    syncFullHistory: true,
    auth: state,
    version
  });

  // Handle disconnections
  conn.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) connectToWA();
    } else if (connection === 'open') {
      console.log('😼 Installing plugins...');
      const path = require('path');
      fs.readdirSync("./plugins/").forEach(file => {
        if (path.extname(file) === ".js") {
          require("./plugins/" + file);
        }
      });

      console.log('✅ Plugins installed');
      console.log('✅ AngalX connected to WhatsApp');

      // Notify Owner
      await conn.sendMessage(ownerNumber[0] + "@s.whatsapp.net", {
        image: {
          url: `https://raw.githubusercontent.com/Thinura-Nethz/HELP/refs/heads/main/ChatGPT%20Image%20Jun%2015%2C%202025%2C%2004_55_04%20PM.png`
        },
        caption: `🤖 AngalX Connected Successfully!\n\n🔧 Prefix: ${prefix}`
      });
    }
  });

  conn.ev.on('creds.update', saveCreds);

  // == MAIN MESSAGE HANDLER ==
  conn.ev.on('messages.upsert', async (msg) => {
    let mek = msg.messages[0];
    if (!mek.message) return;

    const from = mek.key.remoteJid;

    // ✅ Handle replies for song format (1/2)
    const wasHandled = await handlePendingChoice(conn, mek);
    if (wasHandled) return;

    // ✅ If message is ephemeral
    if (getContentType(mek.message) === 'ephemeralMessage') {
      mek.message = mek.message.ephemeralMessage.message;
    }

    // Format message structure
    const m = sms(conn, mek);
    const type = getContentType(mek.message);
    const body =
      (type === 'conversation') ? mek.message.conversation :
      (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text :
      (type === 'imageMessage' && mek.message.imageMessage.caption) ? mek.message.imageMessage.caption :
      (type === 'videoMessage' && mek.message.videoMessage.caption) ? mek.message.videoMessage.caption :
      '';

    const isCmd = body.startsWith(prefix);
    const command = isCmd ? body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
    const args = body.trim().split(/\s+/).slice(1);
    const q = args.join(" ");

    // Group + User Info
    const isGroup = from.endsWith('@g.us');
    const sender = mek.key.fromMe ? conn.user.id.split(':')[0] + '@s.whatsapp.net' : (mek.key.participant || from);
    const senderNumber = sender.split('@')[0];
    const botNumber = conn.user.id.split(':')[0];
    const botNumber2 = await jidNormalizedUser(conn.user.id);
    const pushname = mek.pushName || 'Sin Nombre';
    const isMe = botNumber.includes(senderNumber);
    const isOwner = ownerNumber.includes(senderNumber) || isMe;

    const groupMetadata = isGroup ? await conn.groupMetadata(from).catch(() => {}) : {};
    const groupName = groupMetadata.subject || '';
    const participants = groupMetadata.participants || [];
    const groupAdmins = isGroup ? await getGroupAdmins(participants) : [];
    const isBotAdmins = isGroup && groupAdmins.includes(botNumber2);
    const isAdmins = isGroup && groupAdmins.includes(sender);

    const reply = (text) => conn.sendMessage(from, { text }, { quoted: mek });

    // MODE Access
    if (!isOwner && config.MODE === "public") return;
    if (!isOwner && isGroup && config.MODE === "inbox") return;
    if (!isOwner && !isGroup && config.MODE === "groups") return;

    // Command Execution
    const events = require('./command');
    const cmdName = isCmd ? body.slice(1).split(" ")[0].toLowerCase() : false;
    if (isCmd) {
      const cmd = events.commands.find((c) => c.pattern === cmdName) || events.commands.find((c) => c.alias?.includes(cmdName));
      if (cmd) {
        if (cmd.react) conn.sendMessage(from, { react: { text: cmd.react, key: mek.key } });

        try {
          await cmd.function(conn, mek, m, {
            from, quoted: {}, body, isCmd, command, args, q,
            isGroup, sender, senderNumber, botNumber2, botNumber,
            pushname, isMe, isOwner, groupMetadata, groupName,
            participants, groupAdmins, isBotAdmins, isAdmins, reply
          });
        } catch (err) {
          console.error(`[PLUGIN ERROR: ${cmdName}]`, err);
        }
      }
    }
  });
}

// == EXPRESS API ==
app.get("/", (req, res) => {
  res.send("🤖 AngalX Bot is running.");
});

app.listen(port, () => console.log(`🌐 Server running at http://localhost:${port}`));

// == START BOT ==
setTimeout(() => {
  connectToWA();
}, 4000);
