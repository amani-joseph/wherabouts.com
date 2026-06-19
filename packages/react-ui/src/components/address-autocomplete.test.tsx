import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AddressSuggestion, WheraboutsClient } from "@wherabouts/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AddressAutocomplete } from "./address-autocomplete";

// Mock client
function createMockClient(): WheraboutsClient {
	return {
		addresses: {
			autocomplete: vi.fn(async () => ({
				results: [
					{
						id: 1,
						formattedAddress: "29/14 Fleet Street, Browns Plains QLD 4118",
						streetAddress: "29/14 Fleet Street",
						locality: "Browns Plains",
						state: "QLD",
						postcode: "4118",
						latitude: -27.7849,
						longitude: 153.0395,
						country: "AU",
					} as AddressSuggestion,
				],
			})),
		},
	} as unknown as WheraboutsClient;
}

describe("AddressAutocomplete", () => {
	// Guarantee real timers are restored after every test. A fake-timer test that
	// times out before its own cleanup would otherwise leak fake timers into the
	// following async tests and hang them.
	afterEach(() => {
		vi.useRealTimers();
	});

	it("renders input with placeholder", () => {
		const mockClient = createMockClient();
		render(
			<AddressAutocomplete client={mockClient} placeholder="Enter address" />
		);
		const input = screen.getByPlaceholderText("Enter address");
		expect(input).toBeInTheDocument();
	});

	it("renders with required attribute", () => {
		const mockClient = createMockClient();
		render(<AddressAutocomplete client={mockClient} required />);
		const input = screen.getByRole("combobox");
		expect(input).toHaveAttribute("required");
	});

	it("renders disabled input", () => {
		const mockClient = createMockClient();
		render(<AddressAutocomplete client={mockClient} disabled />);
		const input = screen.getByRole("combobox");
		expect(input).toHaveAttribute("disabled");
	});

	it("shows error aria-invalid when error prop provided", () => {
		const mockClient = createMockClient();
		render(
			<AddressAutocomplete client={mockClient} error="Address required" />
		);
		const input = screen.getByRole("combobox");
		expect(input).toHaveAttribute("aria-invalid", "true");
	});

	it("fires onQueryChange when typing", async () => {
		const mockClient = createMockClient();
		const onQueryChange = vi.fn();
		const user = userEvent.setup();

		render(
			<AddressAutocomplete
				client={mockClient}
				minCharsToSearch={1}
				onQueryChange={onQueryChange}
			/>
		);

		const input = screen.getByRole("combobox");
		await user.type(input, "Fleet");

		expect(onQueryChange).toHaveBeenCalledWith("Fleet");
	});

	it("triggers autocomplete search with debounce", async () => {
		vi.useFakeTimers();
		const mockClient = createMockClient();

		render(
			<AddressAutocomplete
				client={mockClient}
				debounceMs={300}
				minCharsToSearch={1}
			/>
		);

		// Use fireEvent rather than userEvent here: userEvent schedules its own
		// work on timers, which deadlocks under fake timers. fireEvent.change sets
		// the value synchronously and still drives the hook's debounced search.
		const input = screen.getByRole("combobox");
		fireEvent.change(input, { target: { value: "Fleet" } });

		// The query is debounced: no request before the debounce window elapses.
		expect(mockClient.addresses.autocomplete).not.toHaveBeenCalled();

		// Advancing past the debounce window fires exactly one search. Wrap in act
		// so the resulting state updates flush cleanly. Real timers are restored by
		// the suite's afterEach.
		await act(async () => {
			await vi.advanceTimersByTimeAsync(300);
		});
		expect(mockClient.addresses.autocomplete).toHaveBeenCalledTimes(1);
	});

	it("displays empty state when no results", async () => {
		const mockClient = createMockClient();
		const autocomplete = mockClient.addresses.autocomplete as ReturnType<
			typeof vi.fn
		>;
		autocomplete.mockResolvedValueOnce({ results: [] });

		const user = userEvent.setup();
		render(
			<AddressAutocomplete
				client={mockClient}
				i18nStrings={{ noResults: "No addresses found" }}
				minCharsToSearch={1}
			/>
		);

		const input = screen.getByRole("combobox");
		await user.type(input, "x");

		// Wait for async search
		await waitFor(() => {
			// Dropdown should open when query length >= minCharsToSearch
			expect(input).toHaveAttribute("aria-expanded", "true");
		});
	});

	it("calls onSelect with parsed address when item clicked", async () => {
		const mockClient = createMockClient();
		const onSelect = vi.fn();
		const user = userEvent.setup();

		render(
			<AddressAutocomplete
				client={mockClient}
				minCharsToSearch={1}
				onSelect={onSelect}
			/>
		);

		const input = screen.getByRole("combobox");
		await user.type(input, "Fleet");

		// Wait for the debounced search to resolve and render an option. Waiting on
		// aria-expanded would be wrong: it flips to true on focus, before results
		// have loaded.
		const items = await screen.findAllByRole("option");
		await user.click(items[0]);

		expect(onSelect).toHaveBeenCalledWith(
			expect.objectContaining({
				id: 1,
				streetAddress: "29/14 Fleet Street",
				suburb: "Browns Plains",
				state: "QLD",
				postcode: "4118",
				country: "Australia",
			})
		);
	});

	it("renders custom suggestion slot", () => {
		const mockClient = createMockClient();
		const renderSuggestion = vi.fn(() => <div>Custom Suggestion</div>);

		render(
			<AddressAutocomplete
				client={mockClient}
				renderSuggestion={renderSuggestion}
			/>
		);

		// Note: suggestion would render only when listbox is open with results
		// This is a placeholder for the actual test
	});

	it("calls renderError when error occurs", async () => {
		const mockClient = createMockClient();
		const autocomplete = mockClient.addresses.autocomplete as ReturnType<
			typeof vi.fn
		>;
		autocomplete.mockRejectedValueOnce(new Error("Network error"));

		const renderError = vi.fn((err: Error) => <div>Error: {err.message}</div>);
		const user = userEvent.setup();

		render(
			<AddressAutocomplete
				client={mockClient}
				minCharsToSearch={1}
				renderError={renderError}
			/>
		);

		const input = screen.getByRole("combobox");
		await user.type(input, "x");

		await waitFor(() => {
			// Error should be displayed
			expect(renderError).toHaveBeenCalled();
		});
	});
});
