"use client";
import { ArrowRight, Check, MapPin, Search } from "lucide-react";
import {
	AnimatePresence,
	motion,
	useInView,
	useReducedMotion,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import { GlobeDemo } from "@/components/globe-demo";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DemoSuggestion {
	label: string;
	meta: string;
}

interface DemoScenario {
	query: string;
	selectedIndex: number;
	suggestions: readonly DemoSuggestion[];
}

type DemoPhase = "typing" | "matching" | "selecting" | "resting" | "clearing";

const DEMO_SCENARIOS = [
	{
		query: "1600 Amp",
		selectedIndex: 1,
		suggestions: [
			{
				label: "1600 Amber Grove Dr, Sacramento, CA 95834",
				meta: "Looks close, but different street.",
			},
			{
				label: "1600 Amphitheatre Pkwy, Mountain View, CA 94043",
				meta: "Exact rooftop match for a real destination.",
			},
			{
				label: "1600 Amsterdam Ave, New York, NY 10031",
				meta: "Similar prefix, wrong city and route.",
			},
		],
	},
	{
		query: "350 Fifth",
		selectedIndex: 0,
		suggestions: [
			{
				label: "350 Fifth Ave, New York, NY 10118",
				meta: "Canonical building address with postcode.",
			},
			{
				label: "350 Fifth St, Marysville, OH 43040",
				meta: "Valid street, but clearly the wrong locality.",
			},
			{
				label: "350 Fifth Avenue N, Seattle, WA 98109",
				meta: "Another plausible option from a different state.",
			},
		],
	},
	{
		query: "10 Down",
		selectedIndex: 1,
		suggestions: [
			{
				label: "10 Downes St, Redan VIC 3350",
				meta: "A nearby typo trap your users should avoid.",
			},
			{
				label: "10 Downing St, London SW1A 2AA",
				meta: "Precise address selected from confident suggestions.",
			},
			{
				label: "10 Downshire Hill, London NW3 1NR",
				meta: "Looks right at a glance, but isn't the same place.",
			},
		],
	},
] as const satisfies readonly DemoScenario[];

const TYPE_MS = 52;
const DELETE_MS = 28;
const HIGHLIGHT_MS = 360;
const SUGGESTIONS_VISIBLE_AT = 3;
const PANEL_SETTLE_MS = 260;
const PAUSE_SELECTED_MS = 1200;
const PAUSE_FULL_MS = 900;
const PAUSE_EMPTY_MS = 500;

const PHASE_LABELS: Record<DemoPhase, string> = {
	typing: "Typing query",
	matching: "Showing matches",
	selecting: "Selecting result",
	resting: "Correct address captured",
	clearing: "Resetting demo",
};

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

async function eraseDemoAddress(
	full: string,
	setValue: (v: string) => void,
	isCancelled: () => boolean
): Promise<void> {
	for (let c = full.length; c >= 0 && !isCancelled(); c -= 1) {
		setValue(full.slice(0, c));
		await sleep(DELETE_MS);
	}
}

function renderSuggestionLabel(label: string, query: string) {
	const trimmedQuery = query.trim();

	if (!trimmedQuery) {
		return label;
	}

	const lowerLabel = label.toLowerCase();
	const lowerQuery = trimmedQuery.toLowerCase();
	const matchIndex = lowerLabel.indexOf(lowerQuery);

	if (matchIndex === -1) {
		return label;
	}

	const before = label.slice(0, matchIndex);
	const match = label.slice(matchIndex, matchIndex + trimmedQuery.length);
	const after = label.slice(matchIndex + trimmedQuery.length);

	return (
		<>
			{before}
			<span className="font-medium text-foreground">{match}</span>
			{after}
		</>
	);
}

function getPhaseBadgeClasses(hasSelection: boolean): string {
	if (hasSelection) {
		return "border-emerald-400/35 bg-emerald-400/10 text-emerald-300";
	}

	return "border-border/80 bg-background/75 text-muted-foreground";
}

function getSuggestionRowClasses(
	isSelected: boolean,
	isHighlighted: boolean
): string {
	if (isSelected) {
		return "border-emerald-400/35 bg-emerald-400/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";
	}

	if (isHighlighted) {
		return "border-white/15 bg-white/6";
	}

	return "border-transparent bg-transparent";
}

function getSuggestionIconClasses(
	isSelected: boolean,
	isHighlighted: boolean
): string {
	if (isSelected) {
		return "border-emerald-400/35 bg-emerald-400/12 text-emerald-300";
	}

	if (isHighlighted) {
		return "border-white/15 bg-white/8 text-foreground";
	}

	return "border-border/70 bg-background/60 text-muted-foreground";
}

function getSuggestionPillClasses(
	isSelected: boolean,
	isHighlighted: boolean
): string {
	if (isSelected) {
		return "border-emerald-400/35 bg-emerald-400/10 text-emerald-300";
	}

	if (isHighlighted) {
		return "border-white/15 bg-white/8 text-foreground";
	}

	return "border-transparent bg-transparent text-muted-foreground";
}

function getSuggestionPillLabel(
	isSelected: boolean,
	isHighlighted: boolean
): string {
	if (isSelected) {
		return "Selected";
	}

	if (isHighlighted) {
		return "Choose";
	}

	return "Option";
}

interface DemoSuggestionRowProps {
	highlightedIndex: number | null;
	index: number;
	query: string;
	reduceMotion: boolean;
	selectedIndex: number | null;
	suggestion: DemoSuggestion;
}

function DemoSuggestionRow({
	index,
	query,
	selectedIndex,
	highlightedIndex,
	reduceMotion,
	suggestion,
}: DemoSuggestionRowProps) {
	const isHighlighted = highlightedIndex === index;
	const isSelected = selectedIndex === index;
	const rowClasses = getSuggestionRowClasses(isSelected, isHighlighted);
	const iconClasses = getSuggestionIconClasses(isSelected, isHighlighted);
	const pillClasses = getSuggestionPillClasses(isSelected, isHighlighted);
	const pillLabel = getSuggestionPillLabel(isSelected, isHighlighted);

	return (
		<motion.div
			animate={{
				opacity: 1,
				scale: isSelected ? 1.01 : 1,
				x: isSelected ? 4 : 0,
			}}
			className={cn(
				"items-start gap-3 rounded-[1.15rem] border px-2.5 py-2 transition-colors md:px-3.5",
				index === 2 ? "hidden md:flex" : "flex",
				rowClasses
			)}
			initial={reduceMotion ? false : { opacity: 0, y: 10 }}
			transition={{
				duration: reduceMotion ? 0 : 0.18,
				ease: [0.21, 0.47, 0.32, 0.98],
			}}
		>
			<div
				className={cn(
					"mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors md:size-8",
					iconClasses
				)}
			>
				{isSelected ? (
					<Check className="size-4" />
				) : (
					<MapPin className="size-4" />
				)}
			</div>

			<div className="min-w-0 flex-1">
				<p className="truncate text-[13px] text-foreground md:text-sm">
					{renderSuggestionLabel(suggestion.label, query)}
				</p>
				<p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground md:text-xs">
					{suggestion.meta}
				</p>
			</div>

			<div className="pt-0.5">
				<div
					className={cn(
						"rounded-full border px-2 py-1 font-medium text-[9px] uppercase tracking-[0.18em] transition-colors md:text-[10px]",
						pillClasses
					)}
				>
					{pillLabel}
				</div>
			</div>
		</motion.div>
	);
}

interface DemoSuggestionsPanelProps {
	highlightedIndex: number | null;
	query: string;
	reduceMotion: boolean;
	scenario: DemoScenario;
	selectedIndex: number | null;
	showPanel: boolean;
}

function DemoSuggestionsPanel({
	highlightedIndex,
	query,
	reduceMotion,
	scenario,
	selectedIndex,
	showPanel,
}: DemoSuggestionsPanelProps) {
	if (!showPanel) {
		return null;
	}

	return (
		<motion.div
			animate={{ opacity: 1, y: 0, scale: 1 }}
			className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.82))] p-2.5 shadow-[0_34px_90px_-48px_rgba(0,0,0,1)] backdrop-blur-xl"
			exit={{ opacity: 0, y: -8, scale: 0.985 }}
			initial={{ opacity: 0, y: -10, scale: 0.985 }}
			transition={{
				duration: reduceMotion ? 0 : 0.22,
				ease: [0.21, 0.47, 0.32, 0.98],
			}}
		>
			<div className="flex items-center justify-between px-2.5 pt-0.5 pb-2">
				<div className="flex items-center gap-2">
					<div className="size-1.5 rounded-full bg-teal-300/80" />
					<p className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.22em]">
						Possible addresses
					</p>
				</div>
				<div className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-cyan-300">
					Exact match confidence
				</div>
			</div>

			<div className="space-y-1">
				{scenario.suggestions.map((suggestion, index) => (
					<DemoSuggestionRow
						highlightedIndex={highlightedIndex}
						index={index}
						key={`${scenario.query}-${suggestion.label}`}
						query={query}
						reduceMotion={reduceMotion}
						selectedIndex={selectedIndex}
						suggestion={suggestion}
					/>
				))}
			</div>
		</motion.div>
	);
}

interface PlayDemoScenarioOptions {
	isCancelled: () => boolean;
	scenario: DemoScenario;
	scenarioIndex: number;
	setHighlightedIndex: (value: number | null) => void;
	setIsPanelOpen: (value: boolean) => void;
	setPhase: (value: DemoPhase) => void;
	setScenarioIndex: (value: number) => void;
	setSelectedIndex: (value: number | null) => void;
	setValue: (value: string) => void;
}

async function playDemoScenario({
	isCancelled,
	scenario,
	scenarioIndex,
	setHighlightedIndex,
	setIsPanelOpen,
	setPhase,
	setScenarioIndex,
	setSelectedIndex,
	setValue,
}: PlayDemoScenarioOptions): Promise<void> {
	setScenarioIndex(scenarioIndex);
	setValue("");
	setIsPanelOpen(false);
	setHighlightedIndex(null);
	setSelectedIndex(null);
	setPhase("typing");
	await sleep(PAUSE_EMPTY_MS);

	for (let c = 0; c <= scenario.query.length && !isCancelled(); c += 1) {
		setValue(scenario.query.slice(0, c));
		if (c >= SUGGESTIONS_VISIBLE_AT) {
			setIsPanelOpen(true);
		}
		await sleep(TYPE_MS);
	}

	if (isCancelled()) {
		return;
	}

	setIsPanelOpen(true);
	setPhase("matching");
	await sleep(PANEL_SETTLE_MS);

	for (
		let suggestionIndex = 0;
		suggestionIndex <= scenario.selectedIndex && !isCancelled();
		suggestionIndex += 1
	) {
		setHighlightedIndex(suggestionIndex);
		await sleep(HIGHLIGHT_MS);
	}

	if (isCancelled()) {
		return;
	}

	const selectedSuggestion = scenario.suggestions[scenario.selectedIndex];
	setPhase("selecting");
	setHighlightedIndex(scenario.selectedIndex);
	setSelectedIndex(scenario.selectedIndex);
	setValue(selectedSuggestion.label);
	await sleep(PAUSE_SELECTED_MS);

	if (isCancelled()) {
		return;
	}

	setPhase("resting");
	await sleep(PAUSE_FULL_MS);
	setIsPanelOpen(false);
	setPhase("clearing");
	await eraseDemoAddress(selectedSuggestion.label, setValue, isCancelled);

	if (isCancelled()) {
		return;
	}

	setHighlightedIndex(null);
	setSelectedIndex(null);
}

function AddressDemoInput() {
	const shouldReduceMotion = useReducedMotion() ?? false;
	const [value, setValue] = useState("");
	const [scenarioIndex, setScenarioIndex] = useState(0);
	const [isPanelOpen, setIsPanelOpen] = useState(false);
	const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
	const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
	const [phase, setPhase] = useState<DemoPhase>("typing");

	useEffect(() => {
		if (shouldReduceMotion) {
			return;
		}

		let cancelled = false;
		const isCancelled = () => cancelled;
		let nextScenarioIndex = 0;

		const task = async () => {
			while (!isCancelled()) {
				const currentScenarioIndex = nextScenarioIndex % DEMO_SCENARIOS.length;
				const scenario = DEMO_SCENARIOS[currentScenarioIndex];

				await playDemoScenario({
					isCancelled,
					scenario,
					scenarioIndex: currentScenarioIndex,
					setHighlightedIndex,
					setIsPanelOpen,
					setPhase,
					setScenarioIndex,
					setSelectedIndex,
					setValue,
				});

				if (isCancelled()) {
					break;
				}

				nextScenarioIndex += 1;
			}
		};

		task().catch(() => {
			// demo loop stopped on unmount; ignore
		});

		return () => {
			cancelled = true;
		};
	}, [shouldReduceMotion]);

	const currentScenario = DEMO_SCENARIOS[scenarioIndex];
	const staticScenario = DEMO_SCENARIOS[0];
	const displayScenario = shouldReduceMotion ? staticScenario : currentScenario;
	const displaySelectedIndex = shouldReduceMotion
		? staticScenario.selectedIndex
		: selectedIndex;
	const displayHighlightedIndex = shouldReduceMotion
		? staticScenario.selectedIndex
		: highlightedIndex;
	const displayValue = shouldReduceMotion
		? staticScenario.suggestions[staticScenario.selectedIndex].label
		: value;
	const displayQuery =
		shouldReduceMotion || displaySelectedIndex !== null
			? displayScenario.query
			: value;
	const showPanel =
		shouldReduceMotion || isPanelOpen || displaySelectedIndex !== null;
	const currentPhase: DemoPhase = shouldReduceMotion ? "resting" : phase;

	return (
		<div aria-hidden="true" className="mx-auto w-full max-w-xl text-left">
			<div className="relative h-[22rem] overflow-visible rounded-[2rem] border border-white/10 bg-background/70 p-2.5 shadow-[0_28px_90px_-52px_rgba(0,0,0,1)] ring-1 ring-white/5 backdrop-blur-xl md:h-[24rem] md:p-4">
				<div className="mb-3 flex items-center justify-between gap-3 px-1">
					<div className="flex items-center gap-2">
						<div className="size-1.5 rounded-full bg-cyan-300" />
						<p className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.22em]">
							Live address search
						</p>
					</div>
					<div
						className={cn(
							"rounded-full border px-2.5 py-1 font-medium text-[10px] uppercase tracking-[0.18em] transition-colors",
							getPhaseBadgeClasses(displaySelectedIndex !== null)
						)}
					>
						{PHASE_LABELS[currentPhase]}
					</div>
				</div>

				<div className="relative">
					<Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						aria-label="Example address autocomplete"
						className="h-12 rounded-[1.35rem] border-white/10 bg-background/80 pr-4 pl-11 text-left text-sm shadow-[0_18px_40px_-30px_rgba(0,0,0,0.95)] backdrop-blur-sm md:h-13 md:text-[15px]"
						readOnly
						tabIndex={-1}
						value={displayValue}
					/>
				</div>

				<div className="relative">
					<AnimatePresence initial={false}>
						{showPanel ? (
							<motion.div
								animate={{ opacity: 1, y: 0 }}
								className="absolute inset-x-0 top-3"
								exit={{ opacity: 0, y: -6 }}
								initial={{ opacity: 0, y: -8 }}
								transition={{
									duration: shouldReduceMotion ? 0 : 0.18,
									ease: [0.21, 0.47, 0.32, 0.98],
								}}
							>
								<DemoSuggestionsPanel
									highlightedIndex={displayHighlightedIndex}
									query={displayQuery}
									reduceMotion={shouldReduceMotion}
									scenario={displayScenario}
									selectedIndex={displaySelectedIndex}
									showPanel={showPanel}
								/>
							</motion.div>
						) : null}
					</AnimatePresence>
				</div>
			</div>
		</div>
	);
}

export interface BrandList {
	image: string;
	name: string;
}

const HeroSection = () => {
	const sectionRef = useRef<HTMLElement>(null);
	const isInView = useInView(sectionRef, { once: true, amount: 0.1 });

	const containerVariants = {
		hidden: { opacity: 0 },
		visible: {
			opacity: 1,
			transition: {
				staggerChildren: 0.15,
				delayChildren: 0.1,
			},
		},
	};

	const itemVariants = {
		hidden: { opacity: 0, y: 20 },
		visible: {
			opacity: 1,
			y: 0,
			transition: {
				duration: 0.8,
				ease: [0.21, 0.47, 0.32, 0.98] as [number, number, number, number],
			},
		},
	};

	const h1Variants = {
		hidden: { opacity: 1 },
		visible: {
			opacity: 1,
			transition: {
				staggerChildren: 0.02,
			},
		},
	};

	const charVariants = {
		hidden: { opacity: 0, y: 10 },
		visible: {
			opacity: 1,
			y: 0,
			transition: {
				duration: 0.4,
			},
		},
	};

	return (
		<section className="relative" id="top" ref={sectionRef}>
			<motion.div
				animate={isInView ? "visible" : "hidden"}
				className="relative mx-auto flex min-h-[70vh] max-w-7xl flex-col items-center justify-center gap-3 px-4 py-6 text-center md:min-h-[85vh] md:gap-6 md:py-14 lg:px-8 xl:px-16"
				initial="hidden"
				variants={containerVariants}
			>
				<div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
					<div className="absolute top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl md:h-72 md:w-72" />
					<div className="absolute bottom-0 left-1/2 h-96 w-208 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.18),rgba(6,32,86,0.04)_52%,transparent_76%)]" />
					<div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-b from-transparent via-background/30 to-background" />
				</div>

				<div className="relative z-10 flex max-w-3xl flex-col items-center justify-center gap-3 text-center md:gap-4">
					<motion.div
						className="flex w-fit items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1"
						variants={itemVariants}
					>
						<div className="h-1 w-1 rounded-full bg-teal-400" />
						<p className="font-normal text-foreground text-sm">
							Locations API — public beta
						</p>
						<ArrowRight className="text-foreground" size={16} />
					</motion.div>
					<div className="flex flex-col items-center gap-3 text-center">
						<motion.h1
							className="max-w-7xl overflow-visible text-wrap text-balance rounded-[1rem] border border-white/10 bg-background/70 px-3 py-2 text-center font-normal text-foreground text-lg tracking-tight shadow-[0_28px_90px_-52px_rgba(0,0,0,1)] ring-1 ring-white/5 backdrop-blur-xl sm:text-xl md:px-4 md:py-3 md:text-2xl"
							variants={h1Variants}
						>
							{"Production-ready APIs for every location workflow"
								.split("")
								.map((char, i, chars) => (
									<motion.span
										key={`h1-${chars.slice(0, i + 1).join("")}`}
										variants={charVariants}
									>
										{char}
									</motion.span>
								))}
						</motion.h1>
						<motion.p
							className="max-w-2xl text-pretty font-normal text-foreground text-sm sm:text-base md:text-lg"
							variants={itemVariants}
						>
							Address autocomplete and geocoding API. Ship location features
							without the complexity.
						</motion.p>
					</div>
					<motion.div
						className="w-full max-w-2xl pt-2 md:pt-4"
						variants={itemVariants}
					>
						<AddressDemoInput />
					</motion.div>
				</div>
				{/* <motion.div
						className="flex flex-wrap justify-center gap-2"
						variants={itemVariants}
					>
						<a
							className={cn(
								buttonVariants({ variant: "default" }),
								"h-auto cursor-pointer rounded-full px-5 py-2.5 md:px-6 md:py-3.5"
							)}
							href="#features"
						>
							Explore the API
						</a>
						<a
							className={cn(
								buttonVariants({ variant: "outline" }),
								"inline-flex h-auto cursor-pointer items-center gap-2 rounded-full px-5 py-2.5 text-foreground md:px-6 md:py-3.5"
							)}
							href="#pricing"
						>
							Get API access
							<ArrowRight className="text-foreground" size={16} />
						</a>
					</motion.div> */}
				{/* <motion.div
					className="relative z-10 flex flex-col items-center justify-center gap-2 overflow-hidden text-center md:mx-auto md:max-w-2xl md:gap-4"
					variants={itemVariants}
				>
					<p className="font-normal text-muted-foreground text-sm">
						Built for teams shipping location in:
					</p>
					{brandList && brandList.length > 0 && (
						<div className="py-4">
							<Marquee className="p-0 [--duration:20s]" pauseOnHover>
								{brandList.map((brand) => (
									<div key={`${brand.name}-${brand.image}`}>
										<img
											alt={brand.name}
											className="mr-6 h-8 w-36"
											height={32}
											src={brand.image}
											width={144}
										/>
									</div>
								))}
							</Marquee>
						</div>
					)}
				</motion.div> */}
				<div className="pointer-events-none absolute inset-x-0 -bottom-32 z-0 flex justify-center overflow-hidden opacity-85">
					<GlobeDemo
						className="-translate-x-8 md:-translate-x-12"
						decorative
						globeHeightClassName="h-[20rem] sm:h-[30rem] md:h-[60rem]"
					/>
					<div className="pointer-events-none absolute inset-0 bg-linear-to-b from-background/50 via-transparent to-background" />
				</div>
			</motion.div>
		</section>
	);
};

export default HeroSection;
