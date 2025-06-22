// plugins/song.js
const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp3 } = require("@vreden/youtube_scraper");

const pendingChoices = {}; // Tracks which users are choosing format

// Song Command
cmd(
  {
    pattern: "song",
    react: "🎵",
    desc: "Download Song from YouTube",
    category: "download",
    filename: __filename,
  },
  async (bot, msg, m, { from, reply, q }) => {
    try {
      if (!q) return reply("Please provide a YouTube link or song name.");

      const search = await yts(q);
      const data = search.videos[0];
      if (!data) return reply("No video found for your query.");

      const parts = data.timestamp.split(":").map(Number);
      const duration = parts.length === 3
        ? parts[0] * 3600 + parts[1] * 60 + parts[2]
        : parts[0] * 60 + parts[1];

      if (duration > 1800) return reply("Audio is longer than 30 minutes.");

      const quality = "128";
      const songData = await ytmp3(data.url, quality);

      if (!songData || !songData.download?.url) {
        return reply("Failed to fetch download URL.");
      }

      const caption = `
ANGAL-X SONG DOWNLOADER

Title    : ${data.title}
Duration : ${data.timestamp}
Uploaded : ${data.ago}
Views    : ${data.views}
Url      : ${data.url}

Your song is uploading...

Developer - Thinura_Nethz
      `;

      await bot.sendMessage(from, { image: { url: data.thumbnail }, caption }, { quoted: msg });

      pendingChoices[from] = { songData, data, msg };

      await reply("Choose the format:\n1. Document\n2. Audio\n\nReply with: 1 or 2");

      setTimeout(() => {
        if (pendingChoices[from]) delete pendingChoices[from];
      }, 5 * 60 * 1000); // Clear after 5 minutes

    } catch (err) {
      console.error(err);
      reply("Error: " + err.message);
    }
  }
);

// Export the choice handler for global use
module.exports.handlePendingChoice = async function (bot, m) {
  const from = m.key.remoteJid;
  const choiceText =
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text || "";

  if (!pendingChoices[from]) return false;

  const { songData, data, msg } = pendingChoices[from];
  const choice = choiceText.trim();

  let asDocument = false;
  if (choice === "1") asDocument = true;
  else if (choice === "2") asDocument = false;
  else {
    await bot.sendMessage(
      from,
      { text: "Invalid option. Type 1 for Document or 2 for Audio." },
      { quoted: m }
    );
    return true;
  }

  try {
    if (asDocument) {
      await bot.sendMessage(
        from,
        {
          document: { url: songData.download.url },
          mimetype: "audio/mpeg",
          fileName: `${data.title}.mp3`,
        },
        { quoted: msg }
      );
    } else {
      await bot.sendMessage(
        from,
        {
          audio: { url: songData.download.url },
          mimetype: "audio/mpeg",
        },
        { quoted: msg }
      );
    }

    await bot.sendMessage(
      from,
      {
        text: `File sent as ${asDocument ? "Document" : "Audio"}.`,
      },
      { quoted: m }
    );
  } catch (err) {
    console.error("Send error:", err);
    await bot.sendMessage(from, { text: "Failed to send the file." }, { quoted: m });
  }

  delete pendingChoices[from];
  return true;
};
