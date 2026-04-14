import type { ScoreUpdate } from "./monitor";
import { obs } from "../lib/obs";

const UNWATCHABLE_THRESHOLD = 60;
const CRITICAL_THRESHOLD = 50;
const RECOVERY_THRESHOLD = 75;
const MESSAGE_THRESHOLD = 75;
const MESSAGE_SOURCE_NAME = "bad-bitrate";
const MESSAGE_BAD_STREAK_TO_SHOW = 3;

const BAD_STREAK_TO_SWITCH = 3;
const GOOD_STREAK_TO_RETURN = 3;

type SceneMode = "main" | "fallback" | "startingSoon";

// scenes UUIDs
const MAIN_SCENE_UUID = "634bde8d-3e72-484d-96d4-e9d62e6096b1";
const FALLBACK_SCENE_UUID = "c627638d-a94c-429f-8779-87b3aa943637";
const STARTING_SOON_SCENE_UUID = "f7a0baa4-d5c5-46d2-9f61-0bd7245c7aa1";

let currentSceneMode: SceneMode = "main";
let badStreak = 0;
let goodStreak = 0;
let messageVisibleState: boolean | null = null;
let messageBadStreak = 0;

type SceneListResponse = {
  currentProgramSceneUuid?: string;
};

type ManagedSceneState = {
  mode: SceneMode;
  sceneUuid: string;
};

async function getManagedCurrentSceneState(): Promise<ManagedSceneState | null> {
  const sceneList = (await obs.listScenes()) as SceneListResponse;
  const currentProgramSceneUuid = sceneList.currentProgramSceneUuid;

  if (currentProgramSceneUuid === MAIN_SCENE_UUID) {
    return { mode: "main", sceneUuid: MAIN_SCENE_UUID };
  }
  if (currentProgramSceneUuid === FALLBACK_SCENE_UUID) {
    return { mode: "fallback", sceneUuid: FALLBACK_SCENE_UUID };
  }
  if (
    STARTING_SOON_SCENE_UUID.length > 0 &&
    currentProgramSceneUuid === STARTING_SOON_SCENE_UUID
  ) {
    return { mode: "startingSoon", sceneUuid: STARTING_SOON_SCENE_UUID };
  }
  return null;
}

export async function handleSceneSwitchFromScore(
  update: ScoreUpdate,
): Promise<void> {
  const observedState = await getManagedCurrentSceneState();
  if (!observedState) {
    console.log(
      `[scene-switch] ${update.timestamp} skip: current scene is not managed (main/fallback/starting-soon UUID guard)`,
    );
    return;
  }

  currentSceneMode = observedState.mode;

  const isBad = update.totalScore < UNWATCHABLE_THRESHOLD;
  const isGood = update.totalScore >= RECOVERY_THRESHOLD;

  badStreak = isBad ? badStreak + 1 : 0;
  goodStreak = isGood ? goodStreak + 1 : 0;

  const shouldSwitchToFallback =
    currentSceneMode === "main" &&
    (update.totalScore < CRITICAL_THRESHOLD ||
      badStreak >= BAD_STREAK_TO_SWITCH);

  const shouldReturnToMain =
    (currentSceneMode === "fallback" || currentSceneMode === "startingSoon") &&
    goodStreak >= GOOD_STREAK_TO_RETURN;

  const willSwitchScene = shouldSwitchToFallback || shouldReturnToMain;

  const isMessageRangeScore =
    update.totalScore >= UNWATCHABLE_THRESHOLD &&
    update.totalScore < MESSAGE_THRESHOLD;
  messageBadStreak = isMessageRangeScore ? messageBadStreak + 1 : 0;

  const shouldShowMessage =
    isMessageRangeScore && messageBadStreak >= MESSAGE_BAD_STREAK_TO_SHOW;

  if (!willSwitchScene && messageVisibleState !== shouldShowMessage) {
    try {
      await obs.setSourceVisibilityInScene(
        observedState.sceneUuid,
        MESSAGE_SOURCE_NAME,
        shouldShowMessage,
      );
      messageVisibleState = shouldShowMessage;
      console.log(
        `[scene-switch] ${update.timestamp} message source "${MESSAGE_SOURCE_NAME}" -> ${shouldShowMessage ? "ON" : "OFF"} (score=${update.totalScore})`,
      );
    } catch (error) {
      console.error(
        `[scene-switch] failed toggling message source "${MESSAGE_SOURCE_NAME}"`,
        error,
      );
    }
  }

  if (shouldSwitchToFallback) {
    currentSceneMode = "fallback";
    badStreak = 0;

    try {
      await obs.switchScene(FALLBACK_SCENE_UUID);
      console.log(
        `[scene-switch] ${update.timestamp} -> FALLBACK scene uuid=${FALLBACK_SCENE_UUID} (score=${update.totalScore})`,
      );
    } catch (error) {
      console.error("[scene-switch] failed switching to FALLBACK scene", error);
    }
    return;
  }

  if (shouldReturnToMain) {
    currentSceneMode = "main";
    goodStreak = 0;

    try {
      await obs.switchScene(MAIN_SCENE_UUID);
      console.log(
        `[scene-switch] ${update.timestamp} -> MAIN scene uuid=${MAIN_SCENE_UUID} (score=${update.totalScore})`,
      );
    } catch (error) {
      console.error("[scene-switch] failed switching to MAIN scene", error);
    }
  }
}
