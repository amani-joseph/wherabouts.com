"use client";

import { useEffect, useRef, useState } from "react";
import {
	type GlobeRotation,
	latLngToRotation,
} from "@/components/shadcn-space/blocks/hero-15/hero-globe-math";
import { cn } from "@/lib/utils";

export interface GlobeCoordinate {
	lat: number;
	lng: number;
}

interface HeroGlobeProps {
	className?: string;
	/** Static markers dropped on the globe (the demo's candidate locations). */
	markers?: readonly GlobeCoordinate[];
	reduceMotion?: boolean;
	/** Location the globe eases toward and centres on. */
	target: GlobeCoordinate | null;
}

// cobe colours — green dotted earth with electric-green location markers.
const BASE_COLOR: [number, number, number] = [0.18, 0.42, 0.36];
const MARKER_COLOR: [number, number, number] = [0.22, 0.94, 0.66];
const GLOW_COLOR: [number, number, number] = [0.05, 0.16, 0.13];

const DOUBLE_PI = Math.PI * 2;
const MAX_DPR = 2;
const IDLE_THETA = 0.25;
const EASE = 0.06;
const IDLE_SPIN = 0.003;
const MARKER_SIZE = 0.06;

// Minimal shape of the mutable state cobe hands to `onRender` each frame.
interface CobeRenderState {
	height: number;
	phi: number;
	theta: number;
	width: number;
}

interface CobeMarker {
	location: [number, number];
	size: number;
}

interface CobeOptions {
	baseColor: [number, number, number];
	dark: number;
	devicePixelRatio: number;
	diffuse: number;
	glowColor: [number, number, number];
	height: number;
	mapBrightness: number;
	mapSamples: number;
	markerColor: [number, number, number];
	markers: CobeMarker[];
	onRender: (state: CobeRenderState) => void;
	phi: number;
	theta: number;
	width: number;
}

type CreateGlobe = (
	canvas: HTMLCanvasElement,
	options: CobeOptions
) => { destroy: () => void };

function shortestSpin(current: number, focus: number): number {
	const distForward = (focus - current + DOUBLE_PI) % DOUBLE_PI;
	const distBackward = (current - focus + DOUBLE_PI) % DOUBLE_PI;
	return distForward < distBackward
		? current + distForward * EASE
		: current - distBackward * EASE;
}

interface AdvanceArgs {
	current: number;
	dragging: boolean;
	focus: GlobeRotation | null;
	still: boolean;
}

/** Next horizontal rotation: snap when still, hold while dragging, ease to focus, else idle-spin. */
function advancePhi({ current, dragging, focus, still }: AdvanceArgs): number {
	if (still) {
		return focus ? focus.phi : current;
	}
	if (dragging) {
		return current;
	}
	if (focus) {
		return shortestSpin(current, focus.phi);
	}
	return current + IDLE_SPIN;
}

/** Next vertical tilt: snap when still, otherwise ease toward the focus latitude. */
function advanceTheta(
	current: number,
	focus: GlobeRotation | null,
	still: boolean
): number {
	if (still) {
		return focus ? focus.theta : current;
	}
	const targetTheta = focus ? focus.theta : IDLE_THETA;
	return current + (targetTheta - current) * EASE;
}

export function HeroGlobe({
	target,
	markers = [],
	className,
	reduceMotion = false,
}: HeroGlobeProps) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const wrapperRef = useRef<HTMLDivElement | null>(null);
	const [failed, setFailed] = useState(false);

	// Mutable state read inside cobe's render loop (avoids stale closures).
	const focusRef = useRef<GlobeRotation | null>(null);
	const phiRef = useRef(0);
	const thetaRef = useRef(IDLE_THETA);
	const sizeRef = useRef(0);
	const draggingRef = useRef(false);
	const dragRef = useRef<{ x: number; phi: number; moved: number } | null>(
		null
	);
	const reduceMotionRef = useRef(reduceMotion);
	// Markers are read once when the globe is created; held in a ref so the
	// create-once effect needs no dependencies.
	const markersRef = useRef(markers);
	// Which marker a tap cycles to next.
	const clickIndexRef = useRef(0);

	// Keep the focus rotation in sync with the active target coordinate.
	useEffect(() => {
		focusRef.current = target ? latLngToRotation(target.lat, target.lng) : null;
	}, [target]);

	useEffect(() => {
		reduceMotionRef.current = reduceMotion;
	}, [reduceMotion]);

	useEffect(() => {
		const canvas = canvasRef.current;
		const wrapper = wrapperRef.current;
		if (!(canvas && wrapper)) {
			return;
		}

		let globe: { destroy: () => void } | null = null;
		let cancelled = false;
		const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

		const measure = () => {
			const px = Math.round(wrapper.clientWidth * dpr);
			sizeRef.current = px > 0 ? px : sizeRef.current;
		};
		measure();
		const resizeObserver = new ResizeObserver(measure);
		resizeObserver.observe(wrapper);

		const onPointerDown = (event: PointerEvent) => {
			draggingRef.current = true;
			dragRef.current = { x: event.clientX, phi: phiRef.current, moved: 0 };
			canvas.style.cursor = "grabbing";
			try {
				canvas.setPointerCapture(event.pointerId);
			} catch {
				// pointer capture is best-effort
			}
		};
		const onPointerMove = (event: PointerEvent) => {
			const drag = dragRef.current;
			if (!(draggingRef.current && drag)) {
				return;
			}
			const dx = event.clientX - drag.x;
			drag.moved = Math.max(drag.moved, Math.abs(dx));
			phiRef.current = drag.phi + dx * 0.005;
		};
		const onPointerUp = () => {
			const moved = dragRef.current?.moved ?? 0;
			draggingRef.current = false;
			dragRef.current = null;
			canvas.style.cursor = "grab";
			// A tap (negligible movement) flies to the next marker location.
			const list = markersRef.current;
			if (moved < 6 && list.length > 0) {
				clickIndexRef.current = (clickIndexRef.current + 1) % list.length;
				const next = list[clickIndexRef.current];
				if (next) {
					focusRef.current = latLngToRotation(next.lat, next.lng);
				}
			}
		};

		const start = async () => {
			try {
				const mod = (await import("cobe")) as unknown as {
					default: CreateGlobe;
				};
				if (cancelled) {
					return;
				}
				const createGlobe = mod.default;
				const size = sizeRef.current || Math.round(wrapper.clientWidth * dpr);
				sizeRef.current = size;
				phiRef.current = focusRef.current?.phi ?? 0;
				thetaRef.current = focusRef.current?.theta ?? IDLE_THETA;

				globe = createGlobe(canvas, {
					devicePixelRatio: dpr,
					width: size,
					height: size,
					phi: phiRef.current,
					theta: thetaRef.current,
					dark: 1,
					diffuse: 1.1,
					mapSamples: 17_000,
					mapBrightness: 5.6,
					baseColor: BASE_COLOR,
					markerColor: MARKER_COLOR,
					glowColor: GLOW_COLOR,
					markers: markersRef.current.map((m) => ({
						location: [m.lat, m.lng],
						size: MARKER_SIZE,
					})),
					onRender: (state) => {
						const focus = focusRef.current;
						const still = reduceMotionRef.current;
						phiRef.current = advancePhi({
							current: phiRef.current,
							dragging: draggingRef.current,
							focus,
							still,
						});
						thetaRef.current = advanceTheta(thetaRef.current, focus, still);
						state.phi = phiRef.current;
						state.theta = thetaRef.current;
						state.width = sizeRef.current;
						state.height = sizeRef.current;
					},
				});

				canvas.addEventListener("pointerdown", onPointerDown);
				canvas.addEventListener("pointermove", onPointerMove);
				canvas.addEventListener("pointerup", onPointerUp);
				canvas.addEventListener("pointerleave", onPointerUp);
			} catch {
				if (!cancelled) {
					setFailed(true);
				}
			}
		};

		start();

		return () => {
			cancelled = true;
			resizeObserver.disconnect();
			canvas.removeEventListener("pointerdown", onPointerDown);
			canvas.removeEventListener("pointermove", onPointerMove);
			canvas.removeEventListener("pointerup", onPointerUp);
			canvas.removeEventListener("pointerleave", onPointerUp);
			globe?.destroy();
		};
		// Created once on mount. `markers` are static for the demo and live target
		// changes are read through refs, so no dependencies are needed here.
	}, []);

	return (
		<div
			aria-hidden="true"
			className={cn("relative aspect-square w-full", className)}
			ref={wrapperRef}
		>
			<div
				className={cn(
					"absolute inset-[8%] rounded-full bg-[radial-gradient(circle_at_center,rgba(52,211,153,0.18),rgba(5,12,16,0)_68%)] blur-2xl transition-opacity",
					failed ? "opacity-100" : "opacity-70"
				)}
			/>
			{failed ? null : (
				<canvas
					className="relative h-full w-full cursor-grab touch-none [contain:layout_paint_size]"
					ref={canvasRef}
				/>
			)}
		</div>
	);
}

export default HeroGlobe;
