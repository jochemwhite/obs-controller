import { obs } from "./lib/obs";
import { startScoringMonitor } from "./scoring/monitor";
import { handleSceneSwitchFromScore } from "./scoring/scene-switch-callback";

void obs.connect().then(() => {
    // obs.listScenes().then((scenes) => {
    //     console.log(scenes);
    // });
  startScoringMonitor({
    onScoreUpdate: handleSceneSwitchFromScore,
  });
});