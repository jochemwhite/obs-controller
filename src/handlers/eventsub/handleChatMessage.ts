import { TwitchApi } from "../../twitch/twitch-api";
import type { ChannelChatMessageEvent } from "../../schemas/twitch-eventsub-subscription-events";
import { ChatCommandHandlers } from "./commands";

export async function handleChatMessage(
  message: ChannelChatMessageEvent,
  twitchApi: TwitchApi,
) {
  console.log(
    `[${message.broadcaster_user_name}] ${message.chatter_user_name}: ${message.message.text}`,
  );

  const chatMessage = message.message.text.trim();
  const [command, ...args] = chatMessage.split(/\s+/);
  const normalizedCommand = command?.toLowerCase();

  if (!normalizedCommand) {
    return;
  }

  const commandHandler = ChatCommandHandlers[normalizedCommand];
  if (!commandHandler) {
    return;
  }

  await commandHandler({ message, twitchApi, args });
}
