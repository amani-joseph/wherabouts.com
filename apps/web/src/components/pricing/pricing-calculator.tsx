"use client";

import { useId, useState } from "react";
import { estimateMonthlyCost } from "@/lib/pricing-estimate";

const FREE_ALLOTMENT = 10_000;
const SLIDER_MIN = 0;
const SLIDER_MAX = 2_000_000;
const SLIDER_STEP = 5000;
const DEFAULT_REQUESTS = 50_000;

const numberFormat = new Intl.NumberFormat("en-US");
const usdFormat = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
});

/** Interactive monthly-cost estimator backed by the live usage meter. */
export function PricingCalculator() {
	const [requests, setRequests] = useState(DEFAULT_REQUESTS);
	const sliderId = useId();
	const { billableRequests, monthlyCostUsd } = estimateMonthlyCost(requests);

	return (
		<div className="rounded-2xl border bg-card/60 p-6 backdrop-blur-sm sm:p-8">
			<div className="flex items-baseline justify-between gap-4">
				<label className="font-medium text-sm" htmlFor={sliderId}>
					Requests per month
				</label>
				<span className="font-semibold text-lg tabular-nums">
					{numberFormat.format(requests)}
				</span>
			</div>

			<input
				aria-describedby={`${sliderId}-result`}
				className="mt-4 w-full accent-primary"
				id={sliderId}
				max={SLIDER_MAX}
				min={SLIDER_MIN}
				onChange={(event) => setRequests(Number(event.target.value))}
				step={SLIDER_STEP}
				type="range"
				value={requests}
			/>

			<div className="mt-2 flex justify-between text-muted-foreground text-xs tabular-nums">
				<span>{numberFormat.format(SLIDER_MIN)}</span>
				<span>{numberFormat.format(SLIDER_MAX)}+</span>
			</div>

			<dl
				className="mt-6 grid grid-cols-2 gap-4 border-t pt-6"
				id={`${sliderId}-result`}
			>
				<div>
					<dt className="text-muted-foreground text-sm">Billable requests</dt>
					<dd className="mt-1 font-semibold text-2xl tabular-nums">
						{numberFormat.format(billableRequests)}
					</dd>
					<p className="mt-1 text-muted-foreground text-xs">
						First {numberFormat.format(FREE_ALLOTMENT)} free every month
					</p>
				</div>
				<div>
					<dt className="text-muted-foreground text-sm">Estimated monthly</dt>
					<dd className="mt-1 font-semibold text-2xl text-primary tabular-nums">
						{usdFormat.format(monthlyCostUsd)}
					</dd>
					<p className="mt-1 text-muted-foreground text-xs">
						Billed for actual usage
					</p>
				</div>
			</dl>
		</div>
	);
}
