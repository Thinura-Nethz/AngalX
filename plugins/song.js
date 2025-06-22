const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp3 } = require("@vreden/youtube_scraper");

// Track users waiting for reply
const pendingChoices = {};

// SONG COMMAND
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
      if (!q) return reply("*😑 Please provide a song name or YouTube link!*");

      // Search YouTube
      const search = await yts(q);
      const data = search.videos[0];
      if (!data) return reply("❌ Song not found.");

      // Validate duration
      const parts = data.timestamp.split(":").map(Number);
      const seconds = parts.length === 3
        ? parts[0] * 3600 + parts[1] * 60 + parts[2]
        : parts[0] * 60 + parts[1];

      if (seconds > 1800) return reply("⏱️ Song too long. 30 min max.");

      const songData = await ytmp3(data.url, "128");

      // Send song info
      await angal.sendMessage(from, {
        image: { url: data.thumbnail },
        caption: `🎶 *ANGAL-X MP3 DOWNLOADER*\n\n📌 *Title:* ${data.title}\n🕒 *Duration:* ${data.timestamp}\n🔗 *URL:* ${data.url}\n\n_Reply with:_\n1️⃣ = Document\n2️⃣ = Audio`,
      }, { quoted: mek });

      // Save state
      pendingChoices[from] = {
        songData,
        data,
        mek,
        created: Date.now(),
      };
    } catch (e) {
      console.error("Song command error:", e);
      reply("❌ Failed to fetch or send the song.");
    }
  }
);

// 🧠 REPLY HANDLER
const handlePendingChoice = async (angal, m) => {
  const from = m.key.remoteJid;

  // Only run if user has pending choice
  if (!pendingChoices[from]) return false;

  const text =
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    "";
  const input = text.trim().toLowerCase();

  const choice = (input === "1" || input === "document")
    ? "document"
    : (input === "2" || input === "audio")
    ? "audio"
    : null;

  // If invalid, clear and warn once
  if (!choice) {
    await angal.sendMessage(from, {
      text: "❌ Invalid choice. Reply with `1` (Document) or `2` (Audio)."
    }, { quoted: m });

    // 💥 Fix spam: clear so it doesn’t repeat!
    delete pendingChoices[from];
    return true;
  }

  const { songData, data, mek } = pendingChoices[from];

  try {
    await angal.sendMessage(
      from,
      choice === "document"
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
      text: `✅ Sent as ${choice === "document" ? "📁 Document" : "🎵 Audio"}!`,
    }, { quoted: m });
  } catch (err) {
    console.error("Send error:", err);
    await angal.sendMessage(from, {
      text: "❌ Failed to send the file."
    }, { quoted: m });
  }

  // ✅ Always remove after handling
  delete pendingChoices[from];
  return true;
};

module.exports = {
  handlePendingChoice,
};
