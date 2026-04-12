"use client";

import { Badge } from "@wherabouts.com/ui/components/badge";
import { Button } from "@wherabouts.com/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@wherabouts.com/ui/components/card";
import { Input } from "@wherabouts.com/ui/components/input";
import {
	ChevronDownIcon,
	ChevronRightIcon,
	CopyIcon,
	LoaderIcon,
	PlayIcon,
} from "lucide-react";
import { useState } from "react";

type ApiParam = {
	name: string;
	type: string;
	required: boolean;
	description: string;
	example?: string;
};

type ApiEndpoint = {
	method: "GET" | "POST" | "PUT" | "DELETE";
	path: string;
	summary: string;
	description: string;
	params: ApiParam[];
};

const endpoints: ApiEndpoint[] = [
	{
		method: "GET",
		path: "/api/v1/addresses/autocomplete",
		summary: "Autocomplete addresses",
		description:
			"Search for addresses matching a partial query string. Returns up to 20 results ordered by relevance.",
		params: [
			{
				name: "q",
				type: "string",
				required: true,
				description: "Search query (minimum 2 characters)",
				example: "123 Main",
			},
			{
				name: "country",
				type: "string",
				required: false,
				description: "Filter by country code (e.g. AU)",
				example: "AU",
			},
			{
				name: "state",
				type: "string",
				required: false,
				description: "Filter by state (e.g. VIC, NSW)",
				example: "VIC",
			},
			{
				name: "limit",
				type: "number",
				required: false,
				description: "Maximum results to return (1-20, default 10)",
				example: "10",
			},
		],
	},
	{
		method: "GET",
		path: "/api/v1/addresses/{id}",
		summary: "Get address by ID",
		description:
			"Retrieve a single address record by its unique numeric identifier.",
		params: [
			{
				name: "id",
				type: "number",
				required: true,
				description: "Unique address ID",
				example: "1",
			},
		],
	},
	{
		method: "GET",
		path: "/api/v1/addresses/nearby",
		summary: "Find nearby addresses",
		description:
			"Find addresses within a given radius of a geographic coordinate. Results are ordered by distance.",
		params: [
			{
				name: "lat",
				type: "number",
				required: true,
				description: "Latitude (-90 to 90)",
				example: "-37.8136",
			},
			{
				name: "lng",
				type: "number",
				required: true,
				description: "Longitude (-180 to 180)",
				example: "144.9631",
			},
			{
				name: "radius",
				type: "number",
				required: false,
				description: "Search radius in meters (max 50000, default 1000)",
				example: "500",
			},
			{
				name: "limit",
				type: "number",
				required: false,
				description: "Maximum results to return (1-50, default 10)",
				example: "10",
			},
			{
				name: "country",
				type: "string",
				required: false,
				description: "Filter by country code",
				example: "AU",
			},
		],
	},
	{
		method: "GET",
		path: "/api/v1/addresses/reverse",
		summary: "Reverse geocode",
		description:
			"Find the closest address to a given coordinate. Searches within 200 meters and returns the single nearest match.",
		params: [
			{
				name: "lat",
				type: "number",
				required: true,
				description: "Latitude (-90 to 90)",
				example: "-37.8136",
			},
			{
				name: "lng",
				type: "number",
				required: true,
				description: "Longitude (-180 to 180)",
				example: "144.9631",
			},
		],
	},
];

function methodColor(method: string): string {
	switch (method) {
		case "GET":
			return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
		case "POST":
			return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
		case "PUT":
			return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
		case "DELETE":
			return "bg-red-500/15 text-red-700 dark:text-red-400";
		default:
			return "bg-muted text-muted-foreground";
	}
}

function EndpointCard({ endpoint }: { endpoint: ApiEndpoint }) {
	const [isOpen, setIsOpen] = useState(false);
	const [paramValues, setParamValues] = useState<Record<string, string>>({});
	const [response, setResponse] = useState<string | null>(null);
	const [statusCode, setStatusCode] = useState<number | null>(null);
	const [loading, setLoading] = useState(false);
	const [copied, setCopied] = useState(false);

	const buildUrl = () => {
		let url = endpoint.path;

		// Replace path params like {id}
		for (const param of endpoint.params) {
			const pathToken = `{${param.name}}`;
			if (url.includes(pathToken)) {
				url = url.replace(pathToken, paramValues[param.name] ?? "");
			}
		}

		// Build query string for non-path params
		const queryParams = endpoint.params.filter(
			(p) => !endpoint.path.includes(`{${p.name}}`)
		);
		const searchParts: string[] = [];
		for (const param of queryParams) {
			const value = paramValues[param.name];
			if (value) {
				searchParts.push(
					`${encodeURIComponent(param.name)}=${encodeURIComponent(value)}`
				);
			}
		}

		if (searchParts.length > 0) {
			url = `${url}?${searchParts.join("&")}`;
		}

		return url;
	};

	const handleSend = async () => {
		setLoading(true);
		setResponse(null);
		setStatusCode(null);

		try {
			const url = buildUrl();
			const res = await fetch(url);
			setStatusCode(res.status);
			const data = await res.json();
			setResponse(JSON.stringify(data, null, 2));
		} catch (err) {
			setStatusCode(0);
			setResponse(
				JSON.stringify(
					{ error: err instanceof Error ? err.message : "Request failed" },
					null,
					2
				)
			);
		} finally {
			setLoading(false);
		}
	};

	const handleCopy = async () => {
		if (!response) {
			return;
		}
		await navigator.clipboard.writeText(response);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const fillExamples = () => {
		const examples: Record<string, string> = {};
		for (const param of endpoint.params) {
			if (param.example) {
				examples[param.name] = param.example;
			}
		}
		setParamValues(examples);
	};

	return (
		<Card>
			<CardHeader className="p-0">
				<button
					className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/50"
					onClick={() => setIsOpen(!isOpen)}
					type="button"
				>
					{isOpen ? (
						<ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
					) : (
						<ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
					)}
					<Badge
						className={`font-mono font-semibold text-xs ${methodColor(endpoint.method)}`}
						variant="secondary"
					>
						{endpoint.method}
					</Badge>
					<code className="font-mono text-sm">{endpoint.path}</code>
					<span className="ml-auto text-muted-foreground text-sm">
						{endpoint.summary}
					</span>
				</button>
			</CardHeader>

			{isOpen && (
				<CardContent className="border-t px-4 pt-4 pb-4">
					<p className="mb-4 text-muted-foreground text-sm">
						{endpoint.description}
					</p>

					{/* Parameters */}
					<div className="mb-4">
						<div className="mb-2 flex items-center justify-between">
							<CardTitle className="text-sm">Parameters</CardTitle>
							<Button
								className="h-7 text-xs"
								onClick={fillExamples}
								size="sm"
								variant="ghost"
							>
								Fill examples
							</Button>
						</div>
						<div className="space-y-3">
							{endpoint.params.map((param) => {
								const isPathParam = endpoint.path.includes(`{${param.name}}`);
								return (
									<div
										className="grid grid-cols-[180px_1fr] items-start gap-3"
										key={param.name}
									>
										<div className="flex flex-col gap-0.5 pt-2">
											<div className="flex items-center gap-2">
												<code className="font-mono text-sm">{param.name}</code>
												{param.required && (
													<Badge
														className="border-red-500/30 text-[10px] text-red-600 dark:text-red-400"
														variant="outline"
													>
														required
													</Badge>
												)}
											</div>
											<span className="text-muted-foreground text-xs">
												{param.type}
												{isPathParam ? " (path)" : " (query)"}
											</span>
											<span className="text-muted-foreground text-xs">
												{param.description}
											</span>
										</div>
										<Input
											className="font-mono text-sm"
											onChange={(e) =>
												setParamValues((prev) => ({
													...prev,
													[param.name]: e.target.value,
												}))
											}
											placeholder={param.example ?? param.name}
											value={paramValues[param.name] ?? ""}
										/>
									</div>
								);
							})}
						</div>
					</div>

					{/* Request URL Preview */}
					<div className="mb-4 rounded-md bg-muted/50 p-3">
						<div className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-wider">
							Request URL
						</div>
						<code className="break-all font-mono text-sm">{buildUrl()}</code>
					</div>

					{/* Send Button */}
					<Button className="mb-4" disabled={loading} onClick={handleSend}>
						{loading ? (
							<LoaderIcon className="size-4 animate-spin" />
						) : (
							<PlayIcon className="size-4" />
						)}
						{loading ? "Sending..." : "Send Request"}
					</Button>

					{/* Response */}
					{response !== null && (
						<div className="rounded-md border">
							<div className="flex items-center justify-between border-b px-3 py-2">
								<div className="flex items-center gap-2">
									<span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
										Response
									</span>
									{statusCode !== null && (
										<Badge
											className={
												statusCode >= 200 && statusCode < 300
													? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
													: "bg-red-500/15 text-red-700 dark:text-red-400"
											}
											variant="secondary"
										>
											{statusCode === 0 ? "Error" : statusCode}
										</Badge>
									)}
								</div>
								<Button
									className="h-7 text-xs"
									onClick={handleCopy}
									size="sm"
									variant="ghost"
								>
									<CopyIcon className="size-3" />
									{copied ? "Copied" : "Copy"}
								</Button>
							</div>
							<pre className="max-h-96 overflow-auto p-3 font-mono text-xs leading-relaxed">
								{response}
							</pre>
						</div>
					)}
				</CardContent>
			)}
		</Card>
	);
}

export function ApiExplorer() {
	const baseUrl = typeof window === "undefined" ? "" : window.location.origin;

	return (
		<div className="flex flex-col gap-4">
			{/* Base URL info */}
			<Card>
				<CardContent className="flex items-center gap-4 p-4">
					<div>
						<div className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-wider">
							Base URL
						</div>
						<code className="font-mono text-sm">{baseUrl}/api/v1</code>
					</div>
					<Badge className="ml-auto" variant="outline">
						v1
					</Badge>
				</CardContent>
			</Card>

			{/* Endpoints */}
			<div className="flex flex-col gap-2">
				{endpoints.map((endpoint) => (
					<EndpointCard
						endpoint={endpoint}
						key={`${endpoint.method}-${endpoint.path}`}
					/>
				))}
			</div>
		</div>
	);
}
