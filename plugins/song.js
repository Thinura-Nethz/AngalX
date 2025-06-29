const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp3 } = require("@vreden/youtube_scraper");

cmd({
  pattern: "song",
  react: "🎵",
  desc: "Download Song",
  category: "download",
  filename: __filename,
},
async (
  conn,
  mek,
  m,
  { from, q, reply }
) => {
  try {
    if (!q) return reply("*Please provide a YouTube link or song name* 😑");

    const search = await yts(q);
    const data = search.videos[0];
    const url = data.url;

    const caption = `🎶 *ANGAL-X MP3 DOWNLOADER*\n\n📌 *Title*: ${data.title}\n🕒 *Duration*: ${data.timestamp}\n🔗 *URL*: ${url}\n\n*Reply with:*\n1️⃣ = Document\n2️⃣ = Audio`;

    await conn.sendMessage(
      from,
      {
        image: { url: data.thumbnail },
        caption,
      },
      { quoted: mek }
    );

    const quality = "128";
    const songData = await ytmp3(url, quality);

    // Await user reply
    conn.ev.once("messages.upsert", async ({ messages }) => {
      try {
        const msg = messages[0];
        if (!msg || msg.key.fromMe || msg.key.remoteJid !== from) return;

        const userReply = msg.message?.conversation?.toLowerCase().trim();

        if (userReply === "1" || userReply.includes("document")) {
          await conn.sendMessage(
            from,
            {
              document: { url: songData.download.url },
              mimetype: "audio/mpeg",
              fileName: `${data.title}.mp3`,
            },
            { quoted: mek }
          );
          reply("✅ Sent as *Document*");
        } else if (userReply === "2" || userReply.includes("audio")) {
          await conn.sendMessage(
            from,
            {
              audio: { url: songData.download.url },
              mimetype: "audio/mpeg",
            },
            { quoted: mek }
          );
          reply("✅ Sent as *Audio*");
        } else {
          reply("❌ Invalid choice. Reply with 1 (Document) or 2 (Audio).");
        }
      } catch (innerErr) {
        console.error("Reply handling error:", innerErr);
        reply("❌ Error receiving your reply.");
      }
    });

  } catch (e) {
    console.error("Song plugin error:", e);
    reply(`❌ Error: ${e.message}`);
  }
});
