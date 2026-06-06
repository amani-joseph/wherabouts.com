import { describe, expect, it } from "vitest";
import { composeAddressLabel } from "./address-label.ts";

describe("composeAddressLabel", () => {
	it("formats a unit on a street", () => {
		expect(
			composeAddressLabel({
				flatType: "UNIT",
				flatNumber: "16",
				numberFirst: "14",
				numberLast: null,
				streetName: "BOXGROVE",
				streetType: "AVENUE",
				locality: "MOSMAN",
			})
		).toBe("Unit 16/14 Boxgrove Avenue, Mosman");
	});

	it("formats a plain street number with a range", () => {
		expect(
			composeAddressLabel({
				flatType: null,
				flatNumber: null,
				numberFirst: "10",
				numberLast: "12",
				streetName: "PANSY",
				streetType: "STREET",
				locality: "BOTANY",
			})
		).toBe("10-12 Pansy Street, Botany");
	});

	it("omits missing pieces gracefully", () => {
		expect(
			composeAddressLabel({
				flatType: null,
				flatNumber: null,
				numberFirst: null,
				numberLast: null,
				streetName: "WYNNUM",
				streetType: "ROAD",
				locality: "TINGALPA",
			})
		).toBe("Wynnum Road, Tingalpa");
	});
});
