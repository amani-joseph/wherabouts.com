import { useEffect, useRef, useState } from "react";
import { orpcClient } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import { coordValueFromCandidate, isValidLatLng } from "./location-value.ts";

interface Candidate {
	formattedAddress: string;
	id: number;
	latitude: number;
	locality: string;
	longitude: number;
	postcode: string;
	state: string;
}

interface LocationInputProps {
	id: string;
	label: string;
	onChange: (sentValue: string) => void;
	onResolvedLabelChange?: (label: string | null) => void;
	placeholder?: string;
	value: string;
}

const DEBOUNCE_MS = 250;
const MIN_QUERY = 3;

export function LocationInput({
	id,
	label,
	placeholder,
	value,
	onChange,
	onResolvedLabelChange,
}: LocationInputProps) {
	const [candidates, setCandidates] = useState<Candidate[]>([]);
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [activeIndex, setActiveIndex] = useState(-1);
	const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	// Monotonic id for the latest in-flight autocomplete request. A slower
	// earlier response must not clobber a newer one (last-response-wins race),
	// and responses arriving after unmount must be ignored.
	const requestSeq = useRef(0);

	useEffect(() => {
		return () => {
			// Invalidate any in-flight request so its resolution is a no-op.
			requestSeq.current++;
			if (debounceTimer.current) {
				clearTimeout(debounceTimer.current);
			}
			if (blurTimer.current) {
				clearTimeout(blurTimer.current);
			}
		};
	}, []);

	const runQuery = (q: string) => {
		const seq = ++requestSeq.current;
		setLoading(true);
		setOpen(true);
		orpcClient.geocode
			.autocomplete({ q })
			.then((res) => {
				if (seq !== requestSeq.current) {
					return;
				}
				setCandidates(res.results);
				setOpen(true);
			})
			.catch(() => {
				if (seq !== requestSeq.current) {
					return;
				}
				setCandidates([]);
			})
			.finally(() => {
				if (seq !== requestSeq.current) {
					return;
				}
				setLoading(false);
			});
	};

	const handleText = (next: string) => {
		onChange(next);
		onResolvedLabelChange?.(null);
		setActiveIndex(-1);
		if (debounceTimer.current) {
			clearTimeout(debounceTimer.current);
		}
		if (next.length < MIN_QUERY || isValidLatLng(next)) {
			setCandidates([]);
			setOpen(false);
			setLoading(false);
			return;
		}
		debounceTimer.current = setTimeout(() => runQuery(next), DEBOUNCE_MS);
	};

	const selectCandidate = (c: Candidate) => {
		onChange(coordValueFromCandidate(c));
		onResolvedLabelChange?.(`${c.locality} ${c.state}`.trim());
		setOpen(false);
		setCandidates([]);
		setActiveIndex(-1);
	};

	const handleKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
		if (!open) {
			if (ev.key === "ArrowDown" && candidates.length > 0) {
				ev.preventDefault();
				setOpen(true);
				setActiveIndex(-1);
			}
			return;
		}
		if (ev.key === "ArrowDown") {
			ev.preventDefault();
			setActiveIndex((prev) => Math.min(prev + 1, candidates.length - 1));
			return;
		}
		if (ev.key === "ArrowUp") {
			ev.preventDefault();
			setActiveIndex((prev) => Math.max(prev - 1, 0));
			return;
		}
		if (ev.key === "Enter") {
			if (activeIndex >= 0 && candidates[activeIndex]) {
				ev.preventDefault();
				selectCandidate(candidates[activeIndex]);
			}
			return;
		}
		if (ev.key === "Escape") {
			setOpen(false);
			setActiveIndex(-1);
		}
	};

	const listboxId = `${id}-listbox`;
	const activeOptionId =
		open && activeIndex >= 0 && candidates[activeIndex]
			? `${id}-opt-${candidates[activeIndex].id}`
			: undefined;
	const showEmptyState = candidates.length === 0;

	return (
		<div className="relative flex flex-col gap-1">
			<label className="text-sm" htmlFor={id}>
				{label}
			</label>
			<input
				aria-activedescendant={activeOptionId}
				aria-autocomplete="list"
				aria-controls={listboxId}
				aria-expanded={open}
				autoComplete="off"
				className="rounded border px-2 py-1 text-sm"
				id={id}
				onBlur={() => {
					blurTimer.current = setTimeout(() => setOpen(false), 120);
				}}
				onChange={(ev) => handleText(ev.target.value)}
				onFocus={() => {
					if (blurTimer.current) {
						clearTimeout(blurTimer.current);
					}
					if (candidates.length > 0) {
						setOpen(true);
					}
				}}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				role="combobox"
				value={value}
			/>
			{open ? (
				<div
					className="absolute top-full z-10 mt-1 max-h-56 w-full overflow-auto rounded border bg-popover text-sm shadow"
					id={listboxId}
					role="listbox"
				>
					{showEmptyState ? (
						<div className="px-2 py-1.5 text-muted-foreground">
							{loading ? "Searching…" : "No matches — paste lat,lng instead."}
						</div>
					) : (
						candidates.map((c, index) => (
							<button
								aria-selected={index === activeIndex}
								className={cn(
									"block w-full px-2 py-1.5 text-left hover:bg-accent",
									index === activeIndex && "bg-accent"
								)}
								id={`${id}-opt-${c.id}`}
								key={c.id}
								onClick={() => selectCandidate(c)}
								onMouseEnter={() => setActiveIndex(index)}
								role="option"
								type="button"
							>
								<span className="block font-medium">{c.formattedAddress}</span>
								<span className="block text-muted-foreground text-xs">
									{c.latitude},{c.longitude}
								</span>
							</button>
						))
					)}
				</div>
			) : null}
		</div>
	);
}
