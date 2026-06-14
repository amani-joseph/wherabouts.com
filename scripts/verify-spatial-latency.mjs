// Usage: DATABASE_URL=... node scripts/verify-spatial-latency.mjs
// Asserts the nearby query plan is index-ordered KNN (no Sort node) and fast.
import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const url = process.env.DATABASE_URL;
if (!url) {
	console.error("Set DATABASE_URL");
	process.exit(2);
}
const pool = new Pool({ connectionString: url });

const cases = [
	{ name: "Sydney r=2000", lng: 151.2093, lat: -33.8688, r: 2000 },
	{ name: "Melbourne r=1000", lng: 144.9631, lat: -37.8136, r: 1000 },
	{ name: "Ocean/no-match r=5000", lng: 155.0, lat: -40.0, r: 5000 },
];

let failed = 0;
const client = await pool.connect();
try {
	await client.query("SET statement_timeout = '10s'");
	for (const c of cases) {
		const point = `ST_SetSRID(ST_MakePoint(${c.lng},${c.lat}),4326)::geography`;
		const sql = `EXPLAIN (ANALYZE, BUFFERS) SELECT id,
        ST_Distance(geom::geography, ${point}) d
      FROM addresses
      WHERE ST_DWithin(geom::geography, ${point}, ${c.r})
      ORDER BY geom::geography <-> ${point}
      LIMIT 10`;
		try {
			const r = await client.query(sql);
			const plan = r.rows.map((row) => row["QUERY PLAN"]).join("\n");
			const usesKnn = /Order By:.*<->/.test(plan);
			const noSort = !/\bSort\b/.test(plan);
			const execMs = Number(
				(plan.match(/Execution Time: ([\d.]+) ms/) || [])[1] ?? "99999"
			);
			const ok = usesKnn && noSort && execMs < 2000;
			console.log(
				`${ok ? "PASS" : "FAIL"} ${c.name}: knn=${usesKnn} noSort=${noSort} exec=${execMs}ms`
			);
			if (!ok) {
				failed++;
			}
		} catch (e) {
			console.log(`FAIL ${c.name}: ${e.message}`);
			failed++;
		}
	}
} finally {
	client.release();
	await pool.end();
}
process.exit(failed === 0 ? 0 : 1);
