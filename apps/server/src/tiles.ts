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

const MAX_R2_ATTEMPTS = 3;
const R2_RETRY_BASE_MS = 50;

/**
 * Retry a transient R2 failure. A `remote: true` bucket (MAP_TILES) can throw on
 * the first reads after a `wrangler dev` cold start — the remote binding connects
 * asynchronously, so requests served before it's ready blow up with a generic 500.
 * A short backoff lets local dev self-heal without a manual reload. In production
 * the binding is local and ready immediately, so this is effectively a no-op there.
 */
async function withR2Retry<T>(op: () => Promise<T>): Promise<T> {
	let lastError: unknown;
	for (let attempt = 1; attempt <= MAX_R2_ATTEMPTS; attempt++) {
		try {
			return await op();
		} catch (error) {
			lastError = error;
			if (attempt < MAX_R2_ATTEMPTS) {
				await new Promise((resolve) => {
					setTimeout(resolve, R2_RETRY_BASE_MS * attempt);
				});
			}
		}
	}
	throw lastError;
}

/** R2-backed pmtiles source: satisfies range reads via R2 `range` GET. */
class R2Source implements Source {
	private readonly bucket: R2Bucket;

	constructor(bucket: R2Bucket) {
		this.bucket = bucket;
	}

	getKey() {
		return PMTILES_KEY;
	}

	async getBytes(offset: number, length: number): Promise<RangeResponse> {
		const obj = await withR2Retry(() =>
			this.bucket.get(PMTILES_KEY, {
				range: { offset, length },
			})
		);
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

async function r2Passthrough(
	bucket: R2Bucket,
	key: string,
	contentType: string
): Promise<Response> {
	const obj = await withR2Retry(() => bucket.get(key));
	if (!obj) {
		return new Response("Not found", { status: 404 });
	}
	const body = await obj.arrayBuffer();
	return new Response(body, {
		headers: {
			"content-type": contentType,
			"cache-control": TILE_CACHE_CONTROL,
		},
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
		// MapLibre URL-encodes the fontstack (e.g. "Noto%20Sans%20Regular"); the
		// R2 keys use the literal (space-containing) names, so decode to match.
		const fontstack = decodeURIComponent(font[1] as string);
		return r2Passthrough(
			bucket,
			`fonts/${fontstack}/${font[2]}.pbf`,
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
	const archive = new PMTiles(
		new R2Source(bucket),
		undefined as unknown as Cache
	);
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
