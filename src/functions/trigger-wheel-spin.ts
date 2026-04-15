import { z } from "zod";
import { supabase } from "../lib/supabase";

export type TriggerWheelSpinInput = {
  userId: string;
  presetId: string;
  source?: string;
};

export type TriggerWheelSpinErrorCode =
  | "VALIDATION_ERROR"
  | "PRESET_NOT_FOUND"
  | "PRESET_OWNERSHIP_MISMATCH"
  | "INSERT_FAILED";

export class TriggerWheelSpinError extends Error {
  public readonly code: TriggerWheelSpinErrorCode;
  public readonly details?: Record<string, unknown>;
  public override cause?: unknown;

  constructor(
    code: TriggerWheelSpinErrorCode,
    message: string,
    options?: { details?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message);
    this.name = "TriggerWheelSpinError";
    this.code = code;
    this.details = options?.details;
    this.cause = options?.cause;
  }
}

const inputSchema = z.object({
  userId: z.string().uuid(),
  presetId: z.string().uuid(),
  source: z.string().trim().min(1).optional(),
});

export async function triggerWheelSpin(
  input: TriggerWheelSpinInput,
): Promise<void> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    throw new TriggerWheelSpinError(
      "VALIDATION_ERROR",
      "Invalid triggerWheelSpin input",
      { details: { issues: parsed.error.issues } },
    );
  }

  const { userId, presetId, source } = parsed.data;

  const { data: preset, error: presetError } = await supabase
    .from("wheel_presets")
    .select("id, user_id")
    .eq("id", presetId)
    .maybeSingle();

  if (presetError) {
    throw new TriggerWheelSpinError(
      "PRESET_NOT_FOUND",
      "Failed to verify wheel preset",
      {
        details: { userId, presetId },
        cause: presetError,
      },
    );
  }

  if (!preset) {
    throw new TriggerWheelSpinError(
      "PRESET_NOT_FOUND",
      "Wheel preset not found",
      { details: { userId, presetId } },
    );
  }

  if (preset.user_id !== userId) {
    throw new TriggerWheelSpinError(
      "PRESET_OWNERSHIP_MISMATCH",
      "Wheel preset does not belong to provided user",
      {
        details: {
          userId,
          presetId,
          presetOwnerUserId: preset.user_id,
        },
      },
    );
  }

  const { error: insertError } = await supabase.from("wheel_spin_events").insert({
    user_id: userId,
    preset_id: presetId,
    source: source ?? "backend",
  });

  if (insertError) {
    throw new TriggerWheelSpinError(
      "INSERT_FAILED",
      "Failed to insert wheel spin event",
      {
        details: { userId, presetId, source: source ?? "backend" },
        cause: insertError,
      },
    );
  }
}
