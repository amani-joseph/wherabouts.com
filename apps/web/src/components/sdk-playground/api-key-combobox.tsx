import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { orpcClient } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import { detectAuthInput, type SavedApiKey } from "./auth-input.ts";

export type ApiKeyAuthValue =
	| { mode: "managed"; managedKeyId: string; label: string }
	| { mode: "raw"; rawApiKey: string };

interface ApiKeyComboboxFieldProps {
	onChange: (value: ApiKeyAuthValue | null) => void;
	value: ApiKeyAuthValue | null;
}

export function ApiKeyComboboxField({
	value,
	onChange,
}: ApiKeyComboboxFieldProps) {
	const [keys, setKeys] = useState<SavedApiKey[]>([]);
	const [text, setText] = useState("");
	const [open, setOpen] = useState(false);
	const [activeIndex, setActiveIndex] = useState(-1);
	const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		let aborted = false;
		orpcClient.apiKeys
			.list()
			.then((rows) => {
				if (!aborted) {
					setKeys(
						rows.map((r) => ({
							id: r.id,
							name: r.name,
							displayLabel: r.displayLabel,
						}))
					);
				}
			})
			.catch(() => {
				if (!aborted) {
					setKeys([]);
				}
			});
		return () => {
			aborted = true;
		};
	}, []);

	useEffect(() => {
		return () => {
			if (blurTimer.current) {
				clearTimeout(blurTimer.current);
			}
		};
	}, []);

	const detection = useMemo(() => detectAuthInput(text, keys), [text, keys]);

	const handleText = (next: string) => {
		setText(next);
		setActiveIndex(-1);
		const result = detectAuthInput(next, keys);
		if (result.kind === "raw") {
			onChange({ mode: "raw", rawApiKey: result.rawApiKey });
		} else if (value?.mode === "managed") {
			// Typing a filter clears a previously selected managed key.
			onChange(null);
		}
	};

	const selectKey = (key: SavedApiKey) => {
		onChange({
			mode: "managed",
			managedKeyId: key.id,
			label: key.displayLabel,
		});
		setText(key.displayLabel);
		setOpen(false);
		setActiveIndex(-1);
	};

	const handleKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
		if (detection.kind !== "filter") {
			return;
		}
		const matches = detection.matches;
		if (ev.key === "ArrowDown") {
			ev.preventDefault();
			if (!open) {
				setOpen(true);
				setActiveIndex(-1);
				return;
			}
			setActiveIndex((prev) => Math.min(prev + 1, matches.length - 1));
			return;
		}
		if (!open) {
			return;
		}
		if (ev.key === "ArrowUp") {
			ev.preventDefault();
			setActiveIndex((prev) => Math.max(prev - 1, 0));
			return;
		}
		if (ev.key === "Enter") {
			if (activeIndex >= 0 && matches[activeIndex]) {
				ev.preventDefault();
				selectKey(matches[activeIndex]);
			}
			return;
		}
		if (ev.key === "Escape") {
			setOpen(false);
			setActiveIndex(-1);
		}
	};

	const activeOptionId =
		open &&
		detection.kind === "filter" &&
		activeIndex >= 0 &&
		detection.matches[activeIndex]
			? `pg-api-key-opt-${detection.matches[activeIndex].id}`
			: undefined;

	return (
		<div className="relative flex flex-col gap-1">
			<label className="text-sm" htmlFor="pg-api-key">
				API key
			</label>
			<input
				aria-activedescendant={activeOptionId}
				aria-autocomplete="list"
				aria-controls="pg-api-key-listbox"
				aria-expanded={open}
				autoComplete="off"
				className="rounded border px-2 py-1 text-sm"
				id="pg-api-key"
				onBlur={() => {
					blurTimer.current = setTimeout(() => setOpen(false), 120);
				}}
				onChange={(ev) => handleText(ev.target.value)}
				onFocus={() => {
					if (blurTimer.current) {
						clearTimeout(blurTimer.current);
					}
					setOpen(true);
					setActiveIndex(-1);
				}}
				onKeyDown={handleKeyDown}
				placeholder="Pick a saved key or paste wh_…"
				role="combobox"
				value={text}
			/>
			{open && detection.kind === "filter" ? (
				<div
					className="absolute top-full z-10 mt-1 max-h-56 w-full overflow-auto rounded border bg-popover text-sm shadow"
					id="pg-api-key-listbox"
					role="listbox"
				>
					{detection.matches.length === 0 ? (
						<div className="px-2 py-1.5 text-muted-foreground">
							No saved keys.{" "}
							<Link className="underline" to="/api-keys">
								Create one
							</Link>{" "}
							or paste a raw key.
						</div>
					) : (
						detection.matches.map((k, index) => (
							<button
								aria-selected={index === activeIndex}
								className={cn(
									"block w-full px-2 py-1.5 text-left hover:bg-accent",
									index === activeIndex && "bg-accent"
								)}
								id={`pg-api-key-opt-${k.id}`}
								key={k.id}
								onClick={() => selectKey(k)}
								onMouseEnter={() => setActiveIndex(index)}
								role="option"
								type="button"
							>
								<span className="font-medium">{k.name}</span>{" "}
								<span className="text-muted-foreground">{k.displayLabel}</span>
							</button>
						))
					)}
				</div>
			) : null}
			{value?.mode === "raw" ? (
				<p className="text-muted-foreground text-xs">Using a pasted raw key.</p>
			) : null}
		</div>
	);
}
