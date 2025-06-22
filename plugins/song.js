// At the top of your plugin or bot main file:
const pendingChoices = {}; // Keeps track of users waiting to choose file type

// Your song command plugin
const { cmd } = require("../command");
const yts = require("yt-search");
const { ytmp3 } = require("@vreden/youtube_scraper");

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
      if (!q) return reply("*PLEASE PROVIDE LINK OR SONG NAME* :😑");

      // Search YouTube
      const search = await yts(q);
      const data = search.videos[0];
      if (!data) return reply("❌ No video found for your query.");

      // Validate duration (30 minutes max)
      let durationParts = data.timestamp.split(":").map(Number);
      let totalSeconds =
        durationParts.length === 3
          ? durationParts[0] * 3600 + durationParts[1] * 60 + durationParts[2]
          : durationParts[0] * 60 + durationParts[1];

      if (totalSeconds > 1800) return reply("⏱️ Audio limit is 30 minutes");

      // Download audio
      const quality = "128";
      const songData = await ytmp3(data.url, quality);

      // Send metadata + thumbnail
      let desc = `
*ANGAL-X SONG DOWNLOADER*

👻 *Title* : ${data.title}
👻 *Duration* : ${data.timestamp}
👻 *Uploaded* : ${data.ago}
👻 *Views* : ${data.views}
👻 *Url* : ${data.url}

*Your Song Is Uploading...📤*

Developer- Thinura_Nethz
`;
      await angal.sendMessage(
        from,
        { image: { url: data.thumbnail }, caption: desc },
        { quoted: mek }
      );

      // Save pending choice state for this user
      pendingChoices[from] = { songData, data, mek };

      // Ask user to choose
      await reply(
        "📁 Choose the song format:\n1️⃣ Document\n2️⃣ Audio\n\n_Reply with_: `1` or `2`"
      );
    } catch (e) {
      console.log(e);
      reply(`❌ Error: ${e.message}`);
    }
  }
);

// ------------------------------
// In your global message handler (where you receive all incoming messages):
// Call this function for every incoming message `m`

async function handlePendingChoice(angal, m) {
  const from = m.key.remoteJid;

  if (!pendingChoices[from]) return false; // no pending choice, continue normal flow

  const { songData, data, mek } = pendingChoices[from];

  const text =
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    "";
  const choiceRaw = text.trim();

  let choice;
  if (choiceRaw === "1" || choiceRaw.toLowerCase() === "document") choice = "document";
  else if (choiceRaw === "2" || choiceRaw.toLowerCase() === "audio") choice = "audio";
  else {
    await angal.sendMessage(
      from,
      { text: "❌ Invalid choice. Please type `1` for Document or `2` for Audio." },
      { quoted: m }
    );
    return true; // handled message
  }

  const sendAsDocument = choice === "document";

  try {
    await angal.sendMessage(
      from,
      sendAsDocument
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

    await angal.sendMessage(
      from,
      {
        text: "*✅ File sent as* " + (sendAsDocument ? "📁 Document" : "🎵 Audio") + "!",
      },
      { quoted: m }
    );
  } catch (err) {
    console.error(err);
    await angal.sendMessage(
      from,
      { text: "❌ Something went wrong sending the file." },
      { quoted: m }
    );
  }

  delete pendingChoices[from]; // clear pending choice after done

  return true; // handled the message
}

// ------------------------------
// Example integration inside your main message handler (simplified):

// async function onMessage(angal, m) {
//   // Check if user has pending choice
//   const handled = await handlePendingChoice(angal, m);
//   if (handled) return; // stop further processing

//   // Your normal command processing here...
// }

