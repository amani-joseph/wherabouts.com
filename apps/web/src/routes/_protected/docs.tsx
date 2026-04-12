import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge } from "@wherabouts.com/ui/components/badge";
import { Button } from "@wherabouts.com/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@wherabouts.com/ui/components/card";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@wherabouts.com/ui/components/tabs";
import {
	ArrowRightIcon,
	BookOpenIcon,
	BracesIcon,
	CodeIcon,
	CopyIcon,
	MapPinIcon,
	RocketIcon,
	TerminalIcon,
} from "lucide-react";

export const Route = createFileRoute("/_protected/docs")({
	component: RouteComponent,
});

const quickstartCode = {
	curl: `curl -X GET "https://api.wherabouts.com/v1/autocomplete?q=123+Main+St" \\
  -H "Authorization: Bearer wh_live_your_key"`,
	javascript: `const response = await fetch(
  "https://api.wherabouts.com/v1/autocomplete?q=123+Main+St",
  {
    headers: {
      Authorization: "Bearer wh_live_your_key",
    },
  }
);
const data = await response.json();`,
	python: `import requests

response = requests.get(
    "https://api.wherabouts.com/v1/autocomplete",
    params={"q": "123 Main St"},
    headers={"Authorization": "Bearer wh_live_your_key"},
)
data = response.json()`,
};

const endpoints = [
	{
		method: "GET",
		path: "/v1/autocomplete",
		description: "Search for addresses with real-time suggestions",
	},
	{
		method: "GET",
		path: "/v1/reverse",
		description: "Convert coordinates to a human-readable address",
	},
	{
		method: "GET",
		path: "/v1/nearby",
		description: "Find addresses near a given location",
	},
	{
		method: "GET",
		path: "/v1/addresses/{id}",
		description: "Retrieve full details for a specific address",
	},
];

const guides = [
	{
		title: "Quickstart Guide",
		description: "Get your first geocoding request running in under 5 minutes",
		icon: <RocketIcon className="size-5" />,
		time: "5 min",
	},
	{
		title: "Address Autocomplete",
		description: "Build a real-time address search input for your app",
		icon: <MapPinIcon className="size-5" />,
		time: "10 min",
	},
	{
		title: "Reverse Geocoding",
		description: "Convert GPS coordinates to street addresses",
		icon: <CodeIcon className="size-5" />,
		time: "8 min",
	},
	{
		title: "Error Handling",
		description: "Best practices for handling API errors gracefully",
		icon: <BracesIcon className="size-5" />,
		time: "7 min",
	},
];

function RouteComponent() {
	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="font-semibold text-2xl tracking-tight">
						Documentation
					</h1>
					<p className="text-muted-foreground text-sm">
						Everything you need to integrate the Wherabouts API
					</p>
				</div>
				<Link to="/api-docs">
					<Button variant="outline">
						<TerminalIcon className="size-4" />
						API Explorer
					</Button>
				</Link>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<RocketIcon className="size-5" />
						Quick Start
					</CardTitle>
					<CardDescription>Make your first API call in seconds</CardDescription>
				</CardHeader>
				<CardContent>
					<Tabs defaultValue="curl">
						<TabsList>
							<TabsTrigger value="curl">cURL</TabsTrigger>
							<TabsTrigger value="javascript">JavaScript</TabsTrigger>
							<TabsTrigger value="python">Python</TabsTrigger>
						</TabsList>
						{(Object.entries(quickstartCode) as [string, string][]).map(
							([lang, code]) => (
								<TabsContent className="mt-3" key={lang} value={lang}>
									<div className="relative">
										<pre className="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-sm">
											<code>{code}</code>
										</pre>
										<Button
											className="absolute top-2 right-2 size-8"
											size="icon"
											variant="ghost"
										>
											<CopyIcon className="size-4" />
										</Button>
									</div>
								</TabsContent>
							)
						)}
					</Tabs>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<BracesIcon className="size-5" />
						API Endpoints
					</CardTitle>
					<CardDescription>
						Core endpoints available in the Wherabouts API
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					{endpoints.map((ep) => (
						<Link
							className="flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50"
							key={ep.path}
							to="/api-docs"
						>
							<div className="flex items-center gap-3">
								<Badge
									className="font-mono font-semibold text-green-600 text-xs"
									variant="outline"
								>
									{ep.method}
								</Badge>
								<code className="font-mono text-sm">{ep.path}</code>
							</div>
							<span className="hidden text-muted-foreground text-sm md:block">
								{ep.description}
							</span>
						</Link>
					))}
				</CardContent>
			</Card>

			<div>
				<h2 className="mb-4 font-semibold text-lg">
					<BookOpenIcon className="mr-2 inline size-5" />
					Guides
				</h2>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					{guides.map((guide) => (
						<Card
							className="cursor-pointer transition-colors hover:bg-muted/50"
							key={guide.title}
						>
							<CardHeader>
								<div className="flex items-start justify-between">
									<div className="flex items-center gap-3">
										<div className="flex size-10 items-center justify-center rounded-lg bg-muted">
											{guide.icon}
										</div>
										<div>
											<CardTitle className="text-base">{guide.title}</CardTitle>
											<Badge className="mt-1 text-xs" variant="outline">
												{guide.time} read
											</Badge>
										</div>
									</div>
									<ArrowRightIcon className="size-4 text-muted-foreground" />
								</div>
							</CardHeader>
							<CardContent>
								<p className="text-muted-foreground text-sm">
									{guide.description}
								</p>
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		</div>
	);
}
