import { OBSWebSocket } from "obs-websocket-js";
import { env } from "./env";

export type ObsControllerOptions = {
  host?: string;
  password?: string;
};

export class ObsController {
  private readonly obs = new OBSWebSocket();
  private readonly host: string;
  private readonly password: string;

  constructor(options: ObsControllerOptions = {}) {
    this.host = options.host ?? env.OBS_HOST;
    this.password = options.password ?? env.OBS_PASSWORD;
  }

  async connect() {
    try {
      await this.obs.connect(this.host, this.password);
      console.log("Connected to OBS");
    } catch (error) {
      console.error("Error connecting to OBS:", error);
    }
  }

  async listScenes() {
    return await this.obs.call("GetSceneList");
  }

  async switchScene(sceneUuid: string) {
    await this.obs.call("SetCurrentProgramScene", { sceneUuid });
  }

  async setSourceVisibilityInScene(
    sceneUuid: string,
    sourceName: string,
    enabled: boolean,
  ) {
    const sceneItems = await this.obs.call("GetSceneItemList", { sceneUuid });
    const sceneItem = sceneItems.sceneItems.find(
      (item: { sourceName?: string }) => item.sourceName === sourceName,
    );

    if (!sceneItem) {
      throw new Error(`Source "${sourceName}" not found in scene ${sceneUuid}`);
    }

    const sceneItemId = Number(
      (sceneItem as { sceneItemId?: number | string }).sceneItemId,
    );
    if (!Number.isFinite(sceneItemId)) {
      throw new Error(`Invalid scene item id for source "${sourceName}"`);
    }

    await this.obs.call("SetSceneItemEnabled", {
      sceneUuid,
      sceneItemId,
      sceneItemEnabled: enabled,
    });
  }

  /** Reconnect automatically when OBS closes the connection. */
  onConnectionClosed() {
    this.obs.on("ConnectionClosed", () => {
      console.log("Disconnected from OBS, reconnecting...");
      this.reconnect();
    });
  }

  private reconnect() {
    const interval = setInterval(async () => {
      try {
        await this.connect();
        console.log("Reconnected to OBS");
        clearInterval(interval);
      } catch (error) {
        console.error("Error reconnecting to OBS:", error);
      }
    }, 5000);
    return interval;
  }

  onSceneChanged(callback: (event: any) => void) {
    this.obs.on("CurrentProgramSceneChanged", (event) => {
      callback(event);
    });
  }
}

/** Default instance using `OBS_HOST` / `OBS_PASSWORD` from the environment. */
export const obs = new ObsController();
