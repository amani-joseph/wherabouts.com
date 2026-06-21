import { describe, expect, it } from "vitest";
import {
	arcPath,
	COVERAGE_ARCS,
	COVERAGE_REGIONS,
	MAP_HEIGHT,
	MAP_WIDTH,
	project,
} from "./coverage-geo";

const MOVE_TO_START = /^M /;

describe("project (equirectangular)", () => {
	it("maps the antimeridian/poles to viewBox corners", () => {
		expect(project({ lat: 90, lng: -180 })).toEqual({ x: 0, y: 0 });
		expect(project({ lat: -90, lng: 180 })).toEqual({
			x: MAP_WIDTH,
			y: MAP_HEIGHT,
		});
	});

	it("maps the origin (0,0) to the map centre", () => {
		expect(project({ lat: 0, lng: 0 })).toEqual({
			x: MAP_WIDTH / 2,
			y: MAP_HEIGHT / 2,
		});
	});

	it("puts higher latitudes higher on screen (smaller y)", () => {
		expect(project({ lat: 50, lng: 0 }).y).toBeLessThan(
			project({ lat: 10, lng: 0 }).y
		);
	});
});

describe("arcPath", () => {
	it("produces a quadratic bezier between the two projected endpoints", () => {
		const d = arcPath({ lat: 0, lng: -90 }, { lat: 0, lng: 90 });
		expect(d).toMatch(MOVE_TO_START);
		expect(d).toContain(" Q ");
		// Starts at the first point's projection.
		const start = project({ lat: 0, lng: -90 });
		expect(d.startsWith(`M ${start.x.toFixed(1)} ${start.y.toFixed(1)}`)).toBe(
			true
		);
	});

	it("bows the control point upward (toward the pole, smaller y)", () => {
		const from = { lat: 0, lng: -60 };
		const to = { lat: 0, lng: 60 };
		const midY = project({ lat: 0, lng: 0 }).y;
		const controlY = Number(arcPath(from, to).split(" Q ")[1].split(" ")[1]);
		expect(controlY).toBeLessThan(midY);
	});
});

describe("coverage data integrity", () => {
	it("every arc references a defined region id", () => {
		const ids = new Set(COVERAGE_REGIONS.map((r) => r.id));
		for (const [a, b] of COVERAGE_ARCS) {
			expect(ids.has(a)).toBe(true);
			expect(ids.has(b)).toBe(true);
		}
	});

	it("only uses the two documented statuses", () => {
		for (const r of COVERAGE_REGIONS) {
			expect(["live", "beta"]).toContain(r.status);
		}
	});
});
