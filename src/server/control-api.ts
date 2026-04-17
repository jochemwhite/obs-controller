import { Hono } from "hono";
import { createBunWebSocket } from "hono/bun";
import { env } from "../lib/env";
import { obs } from "../lib/obs";
import {
  TriggerWheelSpinError,
  type TriggerWheelSpinInput,
  triggerWheelSpin,
} from "../functions/trigger-wheel-spin";

type ControlAction =
  | "start_stream"
  | "stop_stream"
  | "stream_status"
  | "list_scenes"
  | "current_scene"
  | "switch_scene"
  | "trigger_wheel"
  | "ping";

type SceneSwitchInput = {
  sceneUuid?: string;
  sceneName?: string;
};

type ControlWsMessage = {
  action?: ControlAction;
  payload?: TriggerWheelSpinInput | SceneSwitchInput;
};

// Only these scene UUIDs are exposed to frontend list endpoints.
// Add/remove UUIDs here to control what the frontend can see.
const FRONTEND_SCENE_UUID_ALLOWLIST = [
  "634bde8d-3e72-484d-96d4-e9d62e6096b1",
  "c627638d-a94c-429f-8779-87b3aa943637",
  "f7a0baa4-d5c5-46d2-9f61-0bd7245c7aa1",
];

function isAuthorizedRequest(inputKey: string | null): boolean {
  return Boolean(inputKey && inputKey === env.CONTROL_API_KEY);
}

function getRequestKey(authHeader: string | undefined, queryKey?: string): string | null {
  if (queryKey) return queryKey;
  if (!authHeader) return null;

  const bearerPrefix = "Bearer ";
  if (authHeader.startsWith(bearerPrefix)) {
    return authHeader.slice(bearerPrefix.length).trim();
  }

  return authHeader.trim();
}

const { upgradeWebSocket, websocket } = createBunWebSocket();
const app = new Hono();

async function getSceneList() {
  const sceneList = (await obs.listScenes()) as {
    scenes?: Array<{
      sceneUuid?: string;
      sceneName?: string;
    }>;
    currentProgramSceneUuid?: string;
    currentProgramSceneName?: string;
  };

  return {
    currentProgramSceneUuid: sceneList.currentProgramSceneUuid ?? null,
    currentProgramSceneName: sceneList.currentProgramSceneName ?? null,
    scenes: (sceneList.scenes ?? []).map((scene) => ({
      sceneUuid: scene.sceneUuid ?? null,
      sceneName: scene.sceneName ?? null,
    })),
  };
}

function filterSceneListByUuids(
  sceneList: Awaited<ReturnType<typeof getSceneList>>,
  allowedUuids: string[],
) {
  const allowed = new Set(allowedUuids);
  const filteredScenes = sceneList.scenes.filter(
    (scene) => !!scene.sceneUuid && allowed.has(scene.sceneUuid),
  );

  return {
    ...sceneList,
    scenes: filteredScenes,
  };
}

async function resolveSceneUuidFromInput(input: SceneSwitchInput): Promise<string> {
  if (input.sceneUuid) {
    return input.sceneUuid;
  }

  if (!input.sceneName) {
    throw new Error("sceneUuid or sceneName is required");
  }

  const list = await getSceneList();
  const scene = list.scenes.find((item) => item.sceneName === input.sceneName);
  if (!scene?.sceneUuid) {
    throw new Error(`Scene not found by name: ${input.sceneName}`);
  }
  return scene.sceneUuid;
}

app.get("/", (c) => c.json({ ok: true, service: "obs-control-api" }));

app.use("/control/*", async (c, next) => {
  const requestKey = getRequestKey(
    c.req.header("authorization") ?? c.req.header("x-api-key"),
    c.req.query("key"),
  );

  if (!isAuthorizedRequest(requestKey)) {
    return c.json({ ok: false, error: "UNAUTHORIZED" }, 401);
  }

  await next();
});

app.get("/control/stream-status", async (c) => {
  try {
    const status = await obs.getStreamStatus();
    return c.json({ ok: true, status });
  } catch (error) {
    return c.json(
      { ok: false, error: "OBS_STREAM_STATUS_FAILED", details: String(error) },
      500,
    );
  }
});

app.post("/control/start-stream", async (c) => {
  try {
    await obs.startStream();
    return c.json({ ok: true, action: "start_stream" });
  } catch (error) {
    return c.json(
      { ok: false, error: "OBS_START_STREAM_FAILED", details: String(error) },
      500,
    );
  }
});

app.post("/control/stop-stream", async (c) => {
  try {
    await obs.stopStream();
    return c.json({ ok: true, action: "stop_stream" });
  } catch (error) {
    return c.json(
      { ok: false, error: "OBS_STOP_STREAM_FAILED", details: String(error) },
      500,
    );
  }
});

app.get("/control/scenes", async (c) => {
  try {
    const sceneList = filterSceneListByUuids(
      await getSceneList(),
      FRONTEND_SCENE_UUID_ALLOWLIST,
    );
    return c.json({ ok: true, ...sceneList });
  } catch (error) {
    return c.json(
      { ok: false, error: "OBS_LIST_SCENES_FAILED", details: String(error) },
      500,
    );
  }
});

app.get("/control/scene/current", async (c) => {
  try {
    const sceneList = await getSceneList();
    return c.json({
      ok: true,
      sceneUuid: sceneList.currentProgramSceneUuid,
      sceneName: sceneList.currentProgramSceneName,
    });
  } catch (error) {
    return c.json(
      { ok: false, error: "OBS_CURRENT_SCENE_FAILED", details: String(error) },
      500,
    );
  }
});

app.post("/control/scene/switch", async (c) => {
  try {
    const payload = (await c.req.json()) as SceneSwitchInput;
    const sceneUuid = await resolveSceneUuidFromInput(payload);
    await obs.switchScene(sceneUuid);
    return c.json({ ok: true, action: "switch_scene", sceneUuid });
  } catch (error) {
    return c.json(
      { ok: false, error: "OBS_SWITCH_SCENE_FAILED", details: String(error) },
      400,
    );
  }
});

app.post("/control/trigger-wheel", async (c) => {
  try {
    const payload = (await c.req.json()) as TriggerWheelSpinInput;
    await triggerWheelSpin(payload);
    return c.json({ ok: true, action: "trigger_wheel" });
  } catch (error) {
    if (error instanceof TriggerWheelSpinError) {
      return c.json(
        {
          ok: false,
          error: error.code,
          message: error.message,
          details: error.details,
        },
        400,
      );
    }

    return c.json(
      { ok: false, error: "WHEEL_TRIGGER_FAILED", details: String(error) },
      500,
    );
  }
});

app.get(
  "/control/ws",
  upgradeWebSocket(() => ({
    onOpen(_, ws) {
      ws.send(
        JSON.stringify({
          ok: true,
          type: "connected",
          message: "control websocket ready",
        }),
      );
    },
    async onMessage(event, ws) {
      let message: ControlWsMessage;
      try {
        message = JSON.parse(String(event.data)) as ControlWsMessage;
      } catch {
        ws.send(
          JSON.stringify({
            ok: false,
            error: "INVALID_JSON",
          }),
        );
        return;
      }

      try {
        switch (message.action) {
          case "ping":
            ws.send(JSON.stringify({ ok: true, action: "ping", result: "pong" }));
            return;
          case "start_stream":
            await obs.startStream();
            ws.send(JSON.stringify({ ok: true, action: "start_stream" }));
            return;
          case "stop_stream":
            await obs.stopStream();
            ws.send(JSON.stringify({ ok: true, action: "stop_stream" }));
            return;
          case "stream_status": {
            const status = await obs.getStreamStatus();
            ws.send(
              JSON.stringify({
                ok: true,
                action: "stream_status",
                status,
              }),
            );
            return;
          }
          case "list_scenes": {
            const sceneList = filterSceneListByUuids(
              await getSceneList(),
              FRONTEND_SCENE_UUID_ALLOWLIST,
            );
            ws.send(
              JSON.stringify({
                ok: true,
                action: "list_scenes",
                ...sceneList,
              }),
            );
            return;
          }
          case "current_scene": {
            const sceneList = await getSceneList();
            ws.send(
              JSON.stringify({
                ok: true,
                action: "current_scene",
                sceneUuid: sceneList.currentProgramSceneUuid,
                sceneName: sceneList.currentProgramSceneName,
              }),
            );
            return;
          }
          case "switch_scene": {
            const sceneUuid = await resolveSceneUuidFromInput(
              (message.payload ?? {}) as SceneSwitchInput,
            );
            await obs.switchScene(sceneUuid);
            ws.send(
              JSON.stringify({
                ok: true,
                action: "switch_scene",
                sceneUuid,
              }),
            );
            return;
          }
          case "trigger_wheel":
            await triggerWheelSpin((message.payload ?? {}) as TriggerWheelSpinInput);
            ws.send(JSON.stringify({ ok: true, action: "trigger_wheel" }));
            return;
          default:
            ws.send(
              JSON.stringify({
                ok: false,
                error: "UNKNOWN_ACTION",
                action: message.action ?? null,
              }),
            );
            return;
        }
      } catch (error) {
        if (error instanceof TriggerWheelSpinError) {
          ws.send(
            JSON.stringify({
              ok: false,
              error: error.code,
              message: error.message,
              details: error.details,
            }),
          );
          return;
        }

        ws.send(
          JSON.stringify({
            ok: false,
            error: "ACTION_FAILED",
            details: String(error),
          }),
        );
      }
    },
  })),
);

export function startControlApiServer() {
  const server = Bun.serve({
    port: 8080,
    fetch: app.fetch,
    websocket,
  });

  console.log(
    `[control-api] listening on http://localhost:${server.port} (auth via x-api-key or Authorization: Bearer <key>)`,
  );
  if (env.CONTROL_API_KEY === "change-me-control-key") {
    console.warn(
      "[control-api] using default CONTROL_API_KEY, set a real key in env",
    );
  }
  return server;
}
