import { obs } from "./lib/obs";
import { startScoringMonitor } from "./scoring/monitor";
import { handleSceneSwitchFromScore } from "./scoring/scene-switch-callback";
import { TwitchEventSubReceiver } from "./twitch/eventsub-client";
import { handlers } from "./handlers/eventHandler";

void obs.connect().then(() => {
  startScoringMonitor({
    onScoreUpdate: handleSceneSwitchFromScore,
  });
});

const conduitId = "a9680d16-1f72-46ef-b021-3ec5ade1ad41";

if (!conduitId) {
  console.warn(
    "TWITCH_EVENTSUB_CONDUIT_ID is not set, skipping EventSub startup",
  );
} else {
  const eventSubReceiver = new TwitchEventSubReceiver(handlers, {
    conduitId,
  });

  void eventSubReceiver.connect().catch((error) => {
    console.error("Failed to start Twitch EventSub receiver:", error);
  });
}