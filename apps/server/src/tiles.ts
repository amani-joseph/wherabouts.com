import {
	type Cache,
	EtagMismatch,
	PMTiles,
	type RangeResponse,
	type Source,
} from "pmtiles";

const PMTILES_KEY = "australia.pmtiles";
const TILE_PREFIX = "/tiles/v1";
const TILE_CACHE_CONTROL = "public, max-age=86400, immutable";

/** R2-backed pmtiles source: satisfies range reads via R2 `range` GET. */
class R2Source implements Source {
	constructor(private readonly bucket: R2Bucket) {}

	getKey() {
		return PMTILES_KEY;
	}

	async getBytes(offset: number, length: number): Promise<RangeResponse> {
		const obj = await this.bucket.get(PMTILES_KEY, {
			range: { offset, length },
		});
		if (!obj) {
			throw new Error("pmtiles archive not found in R2");
		}
		const data = await obj.arrayBuffer();
		const etag = obj.etag;
		return { data, etag, cacheControl: TILE_CACHE_CONTROL };
	}
}

// Matches /tiles/v1/{z}/{x}/{y}.mvt
const TILE_RE = /^\/tiles\/v1\/(\d+)\/(\d+)\/(\d+)\.mvt$/;
// Matches /tiles/v1/fonts/{fontstack}/{range}.pbf
const FONT_RE = /^\/tiles\/v1\/fonts\/(.+)\/(\d+-\d+)\.pbf$/;
// Matches /tiles/v1/sprite/dark.{json,png}
const SPRITE_RE = /^\/tiles\/v1\/sprite\/(dark\.(?:json|png))$/;

function r2Passthrough(
	bucket: R2Bucket,
	key: string,
	contentType: string
): Promise<Response> {
	return bucket.get(key).then((obj) => {
		if (!obj) {
			return new Response("Not found", { status: 404 });
		}
		return obj.arrayBuffer().then(
			(body) =>
				new Response(body, {
					headers: {
						"content-type": contentType,
						"cache-control": TILE_CACHE_CONTROL,
					},
				})
		);
	});
}

/**
 * Handle a /tiles/v1/* request against the MAP_TILES R2 bucket.
 * Returns null if the path is not a tiles path (caller continues routing).
 */
export async function handleTileRequest(
	pathname: string,
	bucket: R2Bucket
): Promise<Response | null> {
	if (!pathname.startsWith(TILE_PREFIX)) {
		return null;
	}

	const font = pathname.match(FONT_RE);
	if (font) {
		return r2Passthrough(
			bucket,
			`fonts/${font[1]}/${font[2]}.pbf`,
			"application/x-protobuf"
		);
	}

	const sprite = pathname.match(SPRITE_RE);
	if (sprite) {
		// sprite[1] is guaranteed by the regex capture group
		const filename = sprite[1] as string;
		const isJson = filename.endsWith(".json");
		return r2Passthrough(
			bucket,
			`sprite/${filename}`,
			isJson ? "application/json" : "image/png"
		);
	}

	const tile = pathname.match(TILE_RE);
	if (!tile) {
		return new Response("Not found", { status: 404 });
	}

	const z = Number(tile[1]);
	const x = Number(tile[2]);
	const y = Number(tile[3]);
	const archive = new PMTiles(new R2Source(bucket), undefined as unknown as Cache);
	try {
		const result = await archive.getZxy(z, x, y);
		if (!result) {
			// Empty tile is valid (no data at this z/x/y).
			return new Response(null, { status: 204 });
		}
		return new Response(result.data, {
			headers: {
				"content-type": "application/x-protobuf",
				"cache-control": TILE_CACHE_CONTROL,
			},
		});
	} catch (err) {
		if (err instanceof EtagMismatch) {
			// Archive changed mid-read; client will retry.
			return new Response(null, { status: 503 });
		}
		throw err;
	}
}
