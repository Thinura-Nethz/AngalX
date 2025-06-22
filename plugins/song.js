const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp3 } = require("@vreden/youtube_scraper");

// Store user choices temporarily
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

      // Search song
      const search = await yts(q);
      const data = search.videos[0];
      if (!data) return reply("❌ Song not found.");

      // Check duration
      const durationParts = data.timestamp.split(":").map(Number);
      const seconds = durationParts.length === 3
        ? durationParts[0] * 3600 + durationParts[1] * 60 + durationParts[2]
        : durationParts[0] * 60 + durationParts[1];

      if (seconds > 1800) return reply("⏱️ Song is too long. 30 minutes max.");

      // Download song
      const songData = await ytmp3(data.url, "128");

      // Send info & ask format
      await angal.sendMessage(from, {
        image: { url: data.thumbnail },
        caption: `🎶 *ANGAL-X MP3 DOWNLOADER*\n\n📌 *Title:* ${data.title}\n🕒 *Duration:* ${data.timestamp}\n🔗 *URL:* ${data.url}\n\n🧾 Reply with:\n1️⃣ For *Document*\n2️⃣ For *Audio*`,
      }, { quoted: mek });

      // Store state
      pendingChoices[from] = { songData, data, mek };
    } catch (e) {
      console.error("Song command error:", e);
      reply("❌ Failed to fetch or send the song.");
    }
  }
);

// HANDLE USER FORMAT CHOICE (global handler must call this)
const handlePendingChoice = async (angal, m) => {
  const from = m.key.remoteJid;
  if (!pendingChoices[from]) return false;

  const { songData, data, mek } = pendingChoices[from];

  const text =
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    "";
  const choiceRaw = text.trim();

  let type;
  if (choiceRaw === "1" || choiceRaw.toLowerCase() === "document") {
    type = "document";
  } else if (choiceRaw === "2" || choiceRaw.toLowerCase() === "audio") {
    type = "audio";
  } else {
    await angal.sendMessage(from, { text: "❌ Invalid choice. Reply with `1` or `2`." }, { quoted: m });
    return true;
  }

  try {
    await angal.sendMessage(
      from,
      type === "document"
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
      text: `✅ File sent as ${type === "document" ? "📁 Document" : "🎵 Audio"}!`,
    }, { quoted: m });
  } catch (err) {
    console.error("Send error:", err);
    await angal.sendMessage(from, { text: "❌ Error sending the file." }, { quoted: m });
  }

  delete pendingChoices[from]; // clear state
  return true;
};

module.exports = {
  handlePendingChoice,
};
