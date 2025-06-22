const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp3 } = require("@vreden/youtube_scraper");

const pendingChoices = {}; // Store pending song replies

// === SONG COMMAND ===
cmd(
  {
    pattern: "song",
    react: "🎵",
    desc: "Download Song",
    category: "download",
    filename: __filename,
  },
  async (angal, mek, m, { from, reply, q }) => {
    try {
      if (!q) return reply("🎧 Please enter a song name or YouTube link.");

      const search = await yts(q);
      const data = search.videos[0];
      if (!data) return reply("❌ Song not found.");

      const parts = data.timestamp.split(":").map(Number);
      const seconds = parts.length === 3
        ? parts[0] * 3600 + parts[1] * 60 + parts[2]
        : parts[0] * 60 + parts[1];

      if (seconds > 1800) return reply("⏱️ Song too long. 30 min max.");

      const songData = await ytmp3(data.url, "128");

      await angal.sendMessage(from, {
        image: { url: data.thumbnail },
        caption: `🎶 *ANGAL-X MP3 DOWNLOADER*\n\n📌 *Title:* ${data.title}\n🕒 *Duration:* ${data.timestamp}\n🔗 *URL:* ${data.url}\n\n_Reply with:_\n1️⃣ = Document\n2️⃣ = Audio`,
      }, { quoted: mek });

      pendingChoices[from] = {
        songData,
        data,
        mek,
        created: Date.now(),
      };

      console.log(`[song] Waiting for reply from: ${from}`);
    } catch (e) {
      console.error("SONG ERROR:", e);
      reply("❌ Error downloading song.");
    }
  }
);

// === HANDLE FORMAT REPLY ===
const handlePendingChoice = async (angal, m) => {
  const from = m.key.remoteJid;
  if (!pendingChoices[from]) return false;

  const extractText = (msg) => {
    try {
      const message = msg.message || {};
      const textSources = [
        message?.conversation,
        message?.extendedTextMessage?.text,
        message?.buttonsResponseMessage?.selectedButtonId,
        message?.listResponseMessage?.singleSelectReply?.selectedRowId,
        message?.templateButtonReplyMessage?.selectedId,
        message?.interactiveResponseMessage?.body?.text,
      ];

      const extracted = textSources.find((x) => typeof x === "string" && x.trim().length === 1);
      return extracted ? extracted.trim() : "";
    } catch (err) {
      console.error("Text extraction error:", err);
      return "";
    }
  };

  const choice = extractText(m);
  console.log("[PendingChoice] User replied:", choice);

  const isDoc = choice === "1" || choice === "document";
  const isAud = choice === "2" || choice === "audio";

  if (!isDoc && !isAud) {
    await angal.sendMessage(from, {
      text: "❌ Invalid choice. Reply with `1` (Document) or `2` (Audio)."
    }, { quoted: m });

    delete pendingChoices[from];
    return true;
  }

  const { songData, data, mek } = pendingChoices[from];
  delete pendingChoices[from];

  try {
    await angal.sendMessage(
      from,
      isDoc
        ? {
            document: { url: songData.download.url },
            mimetype: "audio/mpeg",
            fileName: `${data.title}.mp3`,
          }
        : {
            audio: { url: songData.download.url },
            mimetype: "audio/mpeg",
          },
      { quoted: mek }
    );

    await angal.sendMessage(from, {
      text: `✅ Sent as ${isDoc ? "📁 Document" : "🎵 Audio"}!`,
    }, { quoted: m });

    return true;
  } catch (err) {
    console.error("SEND ERROR:", err);
    await angal.sendMessage(from, {
      text: "❌ Error sending the song file.",
    }, { quoted: m });
    return true;
  }
};

module.exports = {
  handlePendingChoice,
};
