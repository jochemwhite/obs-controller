import { supabase } from "../../../lib/supabase";
import {
  TriggerWheelSpinError,
  triggerWheelSpin,
} from "../../../functions/trigger-wheel-spin";
import type { ChatCommandHandler } from "./types";

export const handleTriggerCommand: ChatCommandHandler = async ({
  message,
  args,
}) => {
  const maybePresetId = args[0];

  const { data: integration, error: integrationError } = await supabase
    .from("integrations_twitch")
    .select("user_id")
    .eq("twitch_user_id", message.broadcaster_user_id)
    .maybeSingle();

  if (integrationError || !integration) {
    console.error(
      `[chat-trigger] no integration found for broadcaster ${message.broadcaster_user_id}`,
      integrationError,
    );
    return;
  }

  let presetId = maybePresetId;
  if (!presetId) {
    const { data: defaultPreset, error: defaultPresetError } = await supabase
      .from("wheel_presets")
      .select("id")
      .eq("user_id", integration.user_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (defaultPresetError || !defaultPreset) {
      console.error(
        `[chat-trigger] no wheel preset available for user ${integration.user_id}`,
        defaultPresetError,
      );
      return;
    }

    presetId = defaultPreset.id;
  }

  try {
    await triggerWheelSpin({
      userId: integration.user_id,
      presetId,
      source: "twitch:channel.chat.message:trigger",
    });
    console.log(
      `[chat-trigger] queued wheel spin for user=${integration.user_id} preset=${presetId}`,
    );
  } catch (error) {
    if (error instanceof TriggerWheelSpinError) {
      console.error(
        `[chat-trigger] triggerWheelSpin failed (${error.code})`,
        error.details,
      );
      return;
    }
    console.error(
      "[chat-trigger] unexpected error while triggering wheel spin",
      error,
    );
  }
};
