import { SCORE_MAX, SCORE_MIN } from "./constants";
import { selectMetric } from "./parser";
import type { Labels, MetricSample, SessionSnapshot } from "./types";

const previousSrtSnapshot = new Map<string, SessionSnapshot>();
const previousRtspSnapshot = new Map<string, SessionSnapshot>();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toKey(labels: Labels, fields: string[]): string {
  return fields.map((field) => `${field}=${labels[field] ?? ""}`).join("|");
}

export function calculateSrtScore(samples: MetricSample[]): {
  score: number;
  activeConnections: number;
} {
  const connections = samples.filter((sample) => sample.name === "srt_conns" && sample.value > 0);
  if (connections.length === 0) return { score: 0, activeConnections: 0 };

  const scores = connections.map((connection) => {
    const key = toKey(connection.labels, ["id", "path", "remoteAddr", "state"]);

    const packetsReceived = selectMetric(samples, "srt_conns_packets_received", connection.labels);
    const bytesReceived = selectMetric(samples, "srt_conns_bytes_received", connection.labels);
    const sendLossRate = selectMetric(samples, "srt_conns_packets_send_loss_rate", connection.labels);
    const receiveLossRate = selectMetric(
      samples,
      "srt_conns_packets_received_loss_rate",
      connection.labels,
    );
    const rttMs = selectMetric(samples, "srt_conns_ms_rtt", connection.labels);
    const mbpsReceiveRate = selectMetric(samples, "srt_conns_mbps_receive_rate", connection.labels);

    const previous = previousSrtSnapshot.get(key);
    const deltaPacketsReceived = previous ? packetsReceived - previous.packetsReceived : 0;
    const deltaBytesReceived = previous ? bytesReceived - previous.bytesSent : 0;

    previousSrtSnapshot.set(key, {
      bytesSent: bytesReceived,
      packetsSent: 0,
      packetsLost: 0,
      packetsReceived,
    });

    let score = 100;
    score -= Math.min(45, sendLossRate * 4.5);
    score -= Math.min(45, receiveLossRate * 4.5);

    if (rttMs > 80) {
      score -= Math.min(20, (rttMs - 80) / 6);
    }

    if (mbpsReceiveRate <= 0.05) {
      score -= 15;
    }

    if (previous && deltaPacketsReceived <= 0) {
      score -= 25;
    }

    if (previous && deltaBytesReceived <= 0) {
      score -= 15;
    }

    return clamp(score, SCORE_MIN, SCORE_MAX);
  });

  const avgScore = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  return { score: Math.round(avgScore), activeConnections: connections.length };
}

export function calculateRtspScore(samples: MetricSample[]): {
  score: number;
  activeSessions: number;
} {
  const sessions = samples.filter(
    (sample) =>
      sample.name === "rtsp_sessions" &&
      sample.value > 0 &&
      typeof sample.labels.path === "string" &&
      sample.labels.path.length > 0,
  );
  if (sessions.length === 0) return { score: 0, activeSessions: 0 };

  const scores = sessions.map((session) => {
    const key = toKey(session.labels, ["id", "path", "remoteAddr", "state"]);

    const packetsSent = selectMetric(samples, "rtsp_sessions_rtp_packets_sent", session.labels);
    const packetsLost = selectMetric(samples, "rtsp_sessions_rtp_packets_lost", session.labels);
    const packetsJitter = selectMetric(samples, "rtsp_sessions_rtp_packets_jitter", session.labels);
    const bytesSent = selectMetric(samples, "rtsp_sessions_bytes_sent", session.labels);

    const previous = previousRtspSnapshot.get(key);
    const deltaPacketsSent = previous ? packetsSent - previous.packetsSent : 0;
    const deltaPacketsLost = previous ? packetsLost - previous.packetsLost : 0;
    const deltaBytesSent = previous ? bytesSent - previous.bytesSent : 0;

    previousRtspSnapshot.set(key, {
      bytesSent,
      packetsSent,
      packetsLost,
      packetsReceived: 0,
    });

    let score = 100;
    if (previous && deltaPacketsSent <= 0) {
      score -= 45;
    }
    if (previous && deltaBytesSent <= 0) {
      score -= 20;
    }
    if (previous && deltaPacketsSent > 0 && deltaPacketsLost > 0) {
      const lossRatio = deltaPacketsLost / deltaPacketsSent;
      score -= Math.min(45, lossRatio * 200);
    }
    if (packetsJitter > 30) {
      score -= Math.min(20, (packetsJitter - 30) / 4);
    }

    return clamp(score, SCORE_MIN, SCORE_MAX);
  });

  const avgScore = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  return { score: Math.round(avgScore), activeSessions: sessions.length };
}
