import type { CallOptions, Requester } from "../shared-types.ts";

export interface BoundaryCrossing {
	event: "entry" | "exit";
	zoneId: number;
	zoneName: string;
}

export interface PushLocationBody {
	lat: number;
	lng: number;
}

export interface PushLocationResponse {
	crossings: BoundaryCrossing[];
	zones: number[];
}

export interface DeviceZonesResponse {
	deviceId: string;
	latitude: number | null;
	longitude: number | null;
	updatedAt: string | null;
	zoneIds: number[];
}

export interface DevicesResource {
	pushLocation(
		deviceId: string,
		body: PushLocationBody,
		options?: CallOptions
	): Promise<PushLocationResponse>;
	zones(deviceId: string, options?: CallOptions): Promise<DeviceZonesResponse>;
}

export const createDevices = (request: Requester): DevicesResource => ({
	pushLocation: (deviceId, body, options) =>
		request<PushLocationResponse>({
			method: "POST",
			path: `/api/v1/devices/${deviceId}/location`,
			body,
			...options,
		}),
	zones: (deviceId, options) =>
		request<DeviceZonesResponse>({
			method: "GET",
			path: `/api/v1/devices/${deviceId}/zones`,
			...options,
		}),
});
