import type { TwitchApi } from "../../../twitch/twitch-api";
import type { ChannelChatMessageEvent } from "../../../schemas/twitch-eventsub-subscription-events";

export type ChatCommandContext = {
  message: ChannelChatMessageEvent;
  twitchApi: TwitchApi;
  args: string[];
};

export type ChatCommandHandler = (context: ChatCommandContext) => Promise<void>;
