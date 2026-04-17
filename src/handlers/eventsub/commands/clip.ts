import type { ChatCommandHandler } from "./types";

export const handleClipCommand: ChatCommandHandler = async ({
  message,
  twitchApi,
}) => {
  try {
    const clip = await twitchApi.clips.createClip();
    const clipData = clip.data[0];
    if (!clipData) {
      console.error(
        `[chat-clip] clip creation returned no data for broadcaster ${message.broadcaster_user_id}`,
      );
      return;
    }

    console.log(
      `[chat-clip] created clip id=${clipData.id} edit_url=${clipData.edit_url}`,
    );

    await twitchApi.chat.sendMessage({
      message: `Oh wat nou weer? Thanks for the clip I guess...`,
      replyToMessageId: message.message_id,
    });
  } catch (error: any) {
    console.error("[chat-clip] failed to create clip", error.response);
  }
};
