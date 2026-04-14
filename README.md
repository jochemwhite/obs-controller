# OBS Stream Guard (MediaMTX + OBS)

This service watches MediaMTX stream metrics and automates OBS behavior:

- computes a health score every 2 seconds
- logs score details to console
- switches scenes by UUID when stream quality drops/recovers
- toggles a warning source in OBS for "degraded but not failed" quality

It is designed for a phone -> SRT -> MediaMTX -> RTSP -> OBS workflow.

## How It Works

1. `src/scoring/monitor.ts` polls MediaMTX `/metrics` (Prometheus text format).
2. `src/scoring/parser.ts` parses metrics into typed samples.
3. `src/scoring/scorers.ts` computes:
   - SRT ingest score (loss, RTT, receive rate, traffic deltas)
   - RTSP egress score (packet flow, loss, jitter, traffic deltas)
4. Weighted total score is logged:
   - `[stream-score] ... total=.. srt=.. rtsp=..`
5. `src/scoring/scene-switch-callback.ts` receives score updates and applies OBS logic:
   - main/fallback/starting-soon scene guard by UUID
   - fallback switch on sustained bad score
   - return-to-main on sustained recovery
   - warning source visibility in a middle-quality band

## Project Structure

- `src/index.ts` - startup wiring (connect OBS, start monitor)
- `src/lib/obs.ts` - OBS websocket controller helpers
- `src/lib/mediamtx-client.ts` - Axios client for MediaMTX metrics
- `src/lib/env.ts` - environment parsing/validation
- `src/scoring/constants.ts` - polling/scoring constants
- `src/scoring/monitor.ts` - polling loop + callback hook
- `src/scoring/parser.ts` - Prometheus parser + metric lookup
- `src/scoring/scorers.ts` - SRT/RTSP scoring models
- `src/scoring/scene-switch-callback.ts` - scene/message automation policy

## Requirements

- Bun
- OBS with websocket enabled
- MediaMTX with metrics enabled

## Install

```bash
bun install
```

## Environment

Create `.env` with:

```env
OBS_HOST=ws://<obs-host>:4455
OBS_PASSWORD=<obs-websocket-password>
MEDIAMTX_API_URL=http://10.10.10.237:9998
```

Notes:

- metrics are read from `MEDIAMTX_API_URL + /metrics`
- this project sets `Accept: text/plain; version=0.0.4` for Prometheus text

## Run

```bash
bun run src/index.ts
```

or

```bash
bun run dev
```

## MediaMTX Example Config

For path `xpudu`:

```yaml
metrics: yes
metricsAddress: :9998

srt: true
srtAddress: :8890

rtsp: true
rtspTransports: [tcp]
rtspAddress: :8554

paths:
  xpudu:
    source: publisher
    alwaysAvailable: true
    # Required with alwaysAvailable: choose one of:
    # alwaysAvailableFile: /absolute/path/offline.mp4
    # alwaysAvailableTracks:
    #   - codec: H264
    #   - codec: Opus
    srtPublishPassphrase: "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET"
```

Important:

- if `alwaysAvailable: true`, MediaMTX requires `alwaysAvailableFile` or at least one `alwaysAvailableTracks` entry
- your OBS RTSP URL remains stable: `rtsp://10.10.10.237:8554/xpudu`

## OBS Setup

In `src/scoring/scene-switch-callback.ts` set your UUIDs:

- `MAIN_SCENE_UUID`
- `FALLBACK_SCENE_UUID`
- `STARTING_SOON_SCENE_UUID`

Set warning source name:

- `MESSAGE_SOURCE_NAME` (must exist in each scene where you want toggling)

If the source does not exist in the current managed scene, OBS toggle calls will fail with:

- `Source "<name>" not found in scene <uuid>`

## Current Automation Policy

The callback currently uses:

- scene switch thresholds:
  - `UNWATCHABLE_THRESHOLD`
  - `CRITICAL_THRESHOLD`
  - `RECOVERY_THRESHOLD`
- streaks:
  - `BAD_STREAK_TO_SWITCH`
  - `GOOD_STREAK_TO_RETURN`
- warning message band:
  - show only when score is between `UNWATCHABLE_THRESHOLD` and `MESSAGE_THRESHOLD`
  - requires `MESSAGE_BAD_STREAK_TO_SHOW` consecutive polls
  - skipped on polls where a scene switch is about to happen

All policy tuning lives in `src/scoring/scene-switch-callback.ts`.

## Logging

Examples:

- score:
  - `[stream-score] 2026-... total=73/100 srt=45/100 (conns=1) rtsp=100/100 (sessions=1)`
- scene action:
  - `[scene-switch] ... -> FALLBACK scene uuid=...`
- message toggle:
  - `[scene-switch] ... message source "bad-bitrate" -> ON`

## Troubleshooting

- `unable to read MediaMTX metrics`
  - verify `MEDIAMTX_API_URL`
  - verify MediaMTX metrics listener/permissions
- `Source "<name>" not found in scene ...`
  - add the source to that OBS scene or change `MESSAGE_SOURCE_NAME`
- no switching happens
  - ensure current OBS program scene UUID is one of managed UUIDs
  - check score/streak thresholds are reachable
