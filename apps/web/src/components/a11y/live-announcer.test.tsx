// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LiveAnnouncerProvider, useAnnounce } from "./live-announcer";
import { SkipLink } from "./skip-link";

afterEach(() => cleanup());

function Trigger({
	message,
	assertive,
}: {
	message: string;
	assertive?: boolean;
}) {
	const announce = useAnnounce();
	return (
		<button onClick={() => announce(message, { assertive })} type="button">
			announce
		</button>
	);
}

describe("LiveAnnouncerProvider", () => {
	it("renders both polite (status) and assertive (alert) live regions", () => {
		render(
			<LiveAnnouncerProvider>
				<span>child</span>
			</LiveAnnouncerProvider>
		);
		const polite = screen.getByRole("status");
		const assertive = screen.getByRole("alert");
		expect(polite.getAttribute("aria-live")).toBe("polite");
		expect(assertive.getAttribute("aria-live")).toBe("assertive");
		// Children still render alongside the regions.
		expect(screen.getByText("child")).toBeTruthy();
	});

	it("announces a polite message into the status region", async () => {
		render(
			<LiveAnnouncerProvider>
				<Trigger message="Coordinates ready" />
			</LiveAnnouncerProvider>
		);
		screen.getByText("announce").click();
		await waitFor(() =>
			expect(screen.getByRole("status").textContent).toBe("Coordinates ready")
		);
	});

	it("routes assertive messages to the alert region", async () => {
		render(
			<LiveAnnouncerProvider>
				<Trigger assertive message="Request failed" />
			</LiveAnnouncerProvider>
		);
		screen.getByText("announce").click();
		await waitFor(() =>
			expect(screen.getByRole("alert").textContent).toBe("Request failed")
		);
		// Polite region stays empty for assertive announcements.
		expect(screen.getByRole("status").textContent).toBe("");
	});

	it("useAnnounce outside the provider is a no-op (does not throw)", () => {
		expect(() => render(<Trigger message="x" />)).not.toThrow();
		expect(() => screen.getByText("announce").click()).not.toThrow();
	});
});

describe("SkipLink", () => {
	it("links to the #main-content target and is hidden until focused", () => {
		render(<SkipLink />);
		const link = screen.getByRole("link", { name: "Skip to main content" });
		expect(link.getAttribute("href")).toBe("#main-content");
		// Visually hidden by default; revealed via focus utilities.
		expect(link.className).toContain("sr-only");
		expect(link.className).toContain("focus:not-sr-only");
	});
});
