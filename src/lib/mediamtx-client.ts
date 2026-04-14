import axios from "axios";
import { env } from "./env";

export const mediaMtxClient = axios.create({
  baseURL: env.MEDIAMTX_API_URL,
  timeout: 5000,
});

mediaMtxClient.interceptors.request.use((config) => {
  config.headers.set("Accept", "text/plain; version=0.0.4");
  return config;
});
