export type Labels = Record<string, string>;

export type MetricSample = {
  name: string;
  labels: Labels;
  value: number;
};

export type SessionSnapshot = {
  bytesSent: number;
  packetsSent: number;
  packetsLost: number;
  packetsReceived: number;
};
