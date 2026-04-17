import { handleClipCommand } from "./clip";
import { handleTriggerCommand } from "./trigger";
import type { ChatCommandHandler } from "./types";

export const ChatCommandHandlers: Record<string, ChatCommandHandler> = {
  "!clip": handleClipCommand,
  "!trigger": handleTriggerCommand,
};
