import { Button } from "@wherabouts.com/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@wherabouts.com/ui/components/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@wherabouts.com/ui/components/select";
import { Textarea } from "@wherabouts.com/ui/components/textarea";
import { useMemo, useState } from "react";
import { apiExplorerEndpoints } from "@/lib/api-explorer-endpoints";
import { orpcClient } from "@/lib/orpc";
import { buildSdkSnippet } from "@/lib/sdk-snippet";

export function SdkPlayground() {
	const [endpointId, setEndpointId] = useState(
		apiExplorerEndpoints[0]?.id ?? ""
	);
	const endpoint = useMemo(
		() => apiExplorerEndpoints.find((e) => e.id === endpointId),
		[endpointId]
	);
	const [paramValues, setParamValues] = useState<Record<string, string>>({});
	const [bodyText, setBodyText] = useState<string>("");
	const [rawApiKey, setRawApiKey] = useState("");
	const [result, setResult] = useState<string | null>(null);
	const [running, setRunning] = useState(false);

	const parseBodyOrUndefined = (): Record<string, unknown> | undefined => {
		if (!endpoint || endpoint.method === "GET" || bodyText.trim() === "") {
			return undefined;
		}
		return JSON.parse(bodyText) as Record<string, unknown>;
	};

	let snippetBody: Record<string, unknown> | undefined;
	try {
		snippetBody = parseBodyOrUndefined();
	} catch {
		snippetBody = undefined;
	}

	const snippet = endpoint
		? buildSdkSnippet(endpoint.id, paramValues, snippetBody)
		: "";

	const run = async () => {
		if (!endpoint) {
			return;
		}
		setRunning(true);
		setResult(null);
		try {
			let parsedBody: Record<string, unknown> | undefined;
			try {
				parsedBody = parseBodyOrUndefined();
			} catch {
				setResult("Request body is not valid JSON.");
				setRunning(false);
				return;
			}
			const res = await orpcClient.apiExplorer.sendRequest({
				authMode: "raw",
				endpointId: endpoint.id,
				paramValues,
				rawApiKey,
				body: parsedBody,
			});
			setResult(JSON.stringify(res.body, null, 2));
		} catch (err) {
			setResult(err instanceof Error ? err.message : "Request failed");
		} finally {
			setRunning(false);
		}
	};

	return (
		<div className="grid gap-4 lg:grid-cols-2">
			<Card>
				<CardHeader>
					<CardTitle>Method</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-3">
					<Select
						onValueChange={(value) => {
							if (value) {
								setEndpointId(value);
							}
						}}
						value={endpointId}
					>
						<SelectTrigger>
							<SelectValue placeholder="Pick an SDK method" />
						</SelectTrigger>
						<SelectContent>
							{apiExplorerEndpoints.map((e) => (
								<SelectItem key={e.id} value={e.id}>
									{e.id}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{endpoint?.params.map((p) => (
						<div className="flex flex-col gap-1" key={p.name}>
							<label className="text-sm" htmlFor={`pg-${p.name}`}>
								{p.name}
								{p.required ? " *" : ""}
							</label>
							<input
								className="rounded border px-2 py-1 text-sm"
								id={`pg-${p.name}`}
								onChange={(ev) =>
									setParamValues((prev) => ({
										...prev,
										[p.name]: ev.target.value,
									}))
								}
								placeholder={p.example ?? ""}
								value={paramValues[p.name] ?? ""}
							/>
						</div>
					))}
					{endpoint && endpoint.method !== "GET" ? (
						<Textarea
							className="font-mono text-xs"
							onChange={(ev) => setBodyText(ev.target.value)}
							placeholder={
								endpoint.exampleBody
									? JSON.stringify(endpoint.exampleBody, null, 2)
									: "{}"
							}
							rows={6}
							value={bodyText}
						/>
					) : null}
					<input
						className="rounded border px-2 py-1 text-sm"
						onChange={(ev) => setRawApiKey(ev.target.value)}
						placeholder="Raw API key (wh_...)"
						value={rawApiKey}
					/>
					<Button disabled={running || !endpoint} onClick={run}>
						{running ? "Running…" : "Run"}
					</Button>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>SDK code</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-3">
					<pre className="overflow-auto rounded bg-muted p-3 text-xs">
						<code>{snippet}</code>
					</pre>
					{result === null ? null : (
						<pre className="overflow-auto rounded bg-muted p-3 text-xs">
							<code>{result}</code>
						</pre>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
