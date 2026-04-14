import { mediaMtxClient } from "../lib/mediamtx-client";
import { METRICS_ENDPOINT, POLL_INTERVAL_MS } from "./constants";
import { parseMetrics } from "./parser";
import { calculateRtspScore, calculateSrtScore } from "./scorers";

export type ScoreUpdate = {
  timestamp: string;
  totalScore: number;
  srtScore: number;
  rtspScore: number;
  activeSrtConnections: number;
  activeRtspSessions: number;
};

export type ScoreUpdateCallback = (update: ScoreUpdate) => void | Promise<void>;

type StartScoringMonitorOptions = {
  onScoreUpdate?: ScoreUpdateCallback;
};

async function pollAndLogScore(onScoreUpdate?: ScoreUpdateCallback) {
  try {
    const response = await mediaMtxClient.get<string>(METRICS_ENDPOINT, {
      responseType: "text",
    });
    const samples = parseMetrics(response.data);

    const srt = calculateSrtScore(samples);
    const rtsp = calculateRtspScore(samples);

    const totalWeight = 2;
    const weightedScore = Math.round((srt.score + rtsp.score) / totalWeight);
    const timestamp = new Date().toISOString();

    console.log(
      `[stream-score] ${timestamp} total=${weightedScore}/100 srt=${srt.score}/100 (conns=${srt.activeConnections}) rtsp=${rtsp.score}/100 (sessions=${rtsp.activeSessions})`,
    );

    if (onScoreUpdate) {
      await onScoreUpdate({
        timestamp,
        totalScore: weightedScore,
        srtScore: srt.score,
        rtspScore: rtsp.score,
        activeSrtConnections: srt.activeConnections,
        activeRtspSessions: rtsp.activeSessions,
      });
    }
  } catch (error) {
    console.error("[stream-score] unable to read MediaMTX metrics", error);
  }
}

export function startScoringMonitor(options: StartScoringMonitorOptions = {}) {
  const { onScoreUpdate } = options;

  console.log(
    `[stream-score] polling ${METRICS_ENDPOINT} every ${POLL_INTERVAL_MS}ms via ${mediaMtxClient.defaults.baseURL ?? "http://10.10.10.237:9997"}`,
  );

  void pollAndLogScore(onScoreUpdate);
  setInterval(() => {
    void pollAndLogScore(onScoreUpdate);
  }, POLL_INTERVAL_MS);
}
