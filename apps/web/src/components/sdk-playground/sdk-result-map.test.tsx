// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EMPTY_SCENE } from "./map-scene.ts";
import { SdkResultMap } from "./sdk-result-map.tsx";

const RE_NO_MAP_VIEW = /no map view/i;

describe("SdkResultMap", () => {
	it("shows the empty-state message when the scene has no features", () => {
		render(<SdkResultMap scene={EMPTY_SCENE} />);
		expect(screen.getByText(RE_NO_MAP_VIEW)).toBeTruthy();
	});
});
