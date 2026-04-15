import { TwitchApiBaseClient } from "./base-client";
import type { GetClipsParams, GetClipsResponse, CreateClipParams, CreateClipResponse } from "../../types/helix";

export class TwitchClipsClient extends TwitchApiBaseClient {
  constructor(broadcaster_id: string | null = null) {
    super(broadcaster_id);
  }

  async getClips(options: GetClipsParams): Promise<GetClipsResponse> {
    const response = await this.appApi().get<GetClipsResponse>("/clips", {
      params: options,
    });
    return response.data;
  }

  async createClip(params: Omit<CreateClipParams, "broadcaster_id"> = {}): Promise<CreateClipResponse> {
    const response = await this.clientApi().post<CreateClipResponse>("/clips", null, {
      params: {
        broadcaster_id: this.broadcaster_id,
        ...params,
      } as CreateClipParams,
    });
    return response.data;
  }

  async createClipFromVod(params: Omit<CreateClipParams, "broadcaster_id">): Promise<CreateClipResponse> {
    const response = await this.clientApi().post<CreateClipResponse>("/videos/clips", null, {
      params: {
        broadcaster_id: this.broadcaster_id,
        ...params,
      } as CreateClipParams,
    });
    return response.data;
  }
}
