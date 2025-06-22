const { cmd, commands } = require("../command");
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
  async (
    angal,
    mek,
    m,
    {
      from,
      quoted,
      body,
      isCmd,
      command,
      args,
      q,
      isGroup,
      sender,
      reply,
    }
  ) => {
    try {
      if (!q) return reply("*PLEASE PROVIDE LINK OR SONG NAME* :😑");

      // Search for the video
      const search = await yts(q);
      const data = search.videos[0];
      if (!data) return reply("❌ No video found for your query.");

      const url = data.url;

      // Song metadata description
      let desc = `
*ANGAL-X SONG DOWNLOADER*

👻 *Title* : ${data.title}
👻 *Description* : ${data.description || "No description"}
👻 *Duration* : ${data.timestamp}
👻 *Uploaded* : ${data.ago}
👻 *Views* : ${data.views}
👻 *Url* : ${data.url}

*Your Song Is Uploading...📤*

Developer- Thinura_Nethz
`;

      // Send metadata thumbnail message
      await angal.sendMessage(
        from,
        { image: { url: data.thumbnail }, caption: desc },
        { quoted: mek }
      );

      // Validate song duration (limit: 30 minutes)
      let durationParts = data.timestamp.split(":").map(Number);
      let totalSeconds =
        durationParts.length === 3
          ? durationParts[0] * 3600 + durationParts[1] * 60 + durationParts[2]
          : durationParts[0] * 60 + durationParts[1];

      if (totalSeconds > 1800) {
        return reply("⏱️ Audio limit is 30 minutes");
      }

      // Download the audio
      const quality = "128"; // Default quality
      const songData = await ytmp3(url, quality);

      // Ask user for preferred audio type with numbers
      await reply(
        "📁 Choose the song format:\n1️⃣ Document\n2️⃣ Audio\n\n_Reply with_: `1` or `2`"
      );

      // Listen once for the next user message to get the choice
      angal.once("message", async (responseMsg) => {
        try {
          const choiceRaw = responseMsg.message?.conversation?.trim();
          let choice;
          if (choiceRaw === "1" || choiceRaw.toLowerCase() === "document") choice = "document";
          else if (choiceRaw === "2" || choiceRaw.toLowerCase() === "audio") choice = "audio";
          else {
            return reply("❌ Invalid choice. Please type `1` for Document or `2` for Audio.");
          }

          const sendAsDocument = choice === "document";

          // Send audio file based on choice
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

          return reply(
            "*✅ File sent as* " + (sendAsDocument ? "📁 Document" : "🎵 Audio") + "!"
          );
        } catch (err) {
          console.error(err);
          return reply("❌ Something went wrong sending the file.");
        }
      });
    } catch (e) {
      console.log(e);
      reply(`❌ Error: ${e.message}`);
    }
  }
);
