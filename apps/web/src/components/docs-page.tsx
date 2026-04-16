"use client";

import { Link } from "@tanstack/react-router";
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
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarRail,
	SidebarTrigger,
} from "@wherabouts.com/ui/components/sidebar";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@wherabouts.com/ui/components/tabs";
import { cn } from "@wherabouts.com/ui/lib/utils";
import {
	AlertTriangleIcon,
	ArrowRightIcon,
	BookOpenIcon,
	BracesIcon,
	Code2Icon,
	KeyRoundIcon,
	LocateFixedIcon,
	MapPinIcon,
	SearchIcon,
	TerminalIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LogoIcon } from "@/components/logo";

interface DocsSectionLink {
	href: string;
	title: string;
}

interface DocsSectionGroup {
	items: DocsSectionLink[];
	label: string;
}

interface EndpointParam {
	description: string;
	name: string;
	required: boolean;
	type: string;
}

interface EndpointDoc {
	description: string;
	exampleResponse: string;
	href: string;
	method: "GET";
	notes: string[];
	params: EndpointParam[];
	path: string;
	summary: string;
	title: string;
}

const docsNavGroups: DocsSectionGroup[] = [
	{
		label: "Getting Started",
		items: [
			{ title: "Overview", href: "#overview" },
			{ title: "Quickstart", href: "#quickstart" },
			{ title: "OpenAPI Spec", href: "#openapi-spec" },
			{ title: "JS/TS SDK", href: "#js-ts-sdk" },
			{ title: "Authentication", href: "#authentication" },
		],
	},
	{
		label: "Core Endpoints",
		items: [
			{ title: "Autocomplete", href: "#autocomplete" },
			{ title: "Reverse Geocoding", href: "#reverse" },
			{ title: "Nearby Search", href: "#nearby" },
			{ title: "Address by ID", href: "#address-by-id" },
		],
	},
	{
		label: "Implementation Notes",
		items: [
			{ title: "Errors and Constraints", href: "#errors-and-constraints" },
			{ title: "Health Checks", href: "#health-checks" },
			{ title: "Integration Checklist", href: "#integration-checklist" },
			{ title: "Next Steps", href: "#next-steps" },
		],
	},
];

const quickstartCode = {
	curl: `curl "https://api.wherabouts.com/api/v1/addresses/autocomplete?q=123+Main+St&country=AU" \\
  -H "Authorization: Bearer wh_live_your_api_key"`,
	javascript: `const response = await fetch(
  "https://api.wherabouts.com/api/v1/addresses/autocomplete?q=123+Main+St&country=AU",
  {
    headers: {
      Authorization: "Bearer wh_live_your_api_key",
    },
  }
);

if (!response.ok) {
  throw new Error("Request failed");
}

const payload = await response.json();`,
	sdk: `import { createWheraboutsClient } from "@wherabouts.com/sdk";

const client = createWheraboutsClient({
  apiKey: process.env.WHERABOUTS_API_KEY!,
});

const payload = await client.autocomplete({
  q: "123 Main St",
  country: "AU",
  limit: 5,
});`,
	python: `import requests

response = requests.get(
    "https://api.wherabouts.com/api/v1/addresses/autocomplete",
    params={"q": "123 Main St", "country": "AU"},
    headers={"Authorization": "Bearer wh_live_your_api_key"},
    timeout=10,
)
response.raise_for_status()
payload = response.json()`,
} as const;

const endpointDocs: EndpointDoc[] = [
	{
		title: "Autocomplete",
		href: "#autocomplete",
		method: "GET",
		path: "/api/v1/addresses/autocomplete",
		summary: "Search for matching addresses as a user types.",
		description:
			"Autocomplete returns up to 20 ranked address candidates for a partial query. It is the best default starting point for signup forms, checkout flows, address capture, and internal tools that need fast suggestions without embedding a map SDK.",
		params: [
			{
				name: "q",
				type: "string",
				required: true,
				description: "Free-form address input. Must be at least 2 characters.",
			},
			{
				name: "country",
				type: "string",
				required: false,
				description: "Optional country filter such as `AU`.",
			},
			{
				name: "state",
				type: "string",
				required: false,
				description: "Optional state filter such as `VIC` or `NSW`.",
			},
			{
				name: "limit",
				type: "number",
				required: false,
				description:
					"Maximum results to return. Defaults to 10 and is capped at 20.",
			},
		],
		notes: [
			"Requests with a query shorter than 2 characters return `400`.",
			"Use `country` and `state` filters to keep search results tight for known regions.",
			"Successful `2xx` requests are counted toward usage for the calling API key.",
		],
		exampleResponse: `{
  "results": [
    {
      "id": 104233,
      "formattedAddress": "123 Main St, Melbourne VIC 3000, AU",
      "streetAddress": "123 Main St",
      "locality": "Melbourne",
      "state": "VIC",
      "postcode": "3000",
      "country": "AU",
      "latitude": -37.8136,
      "longitude": 144.9631
    }
  ],
  "count": 1
}`,
	},
	{
		title: "Reverse Geocoding",
		href: "#reverse",
		method: "GET",
		path: "/api/v1/addresses/reverse",
		summary: "Resolve a coordinate pair to the nearest address.",
		description:
			"Reverse geocoding searches for the closest address within 200 meters of the provided coordinate pair and returns a single best match. This is a strong fit for mobile location capture, driver tooling, and QA flows that need to validate map-selected points.",
		params: [
			{
				name: "lat",
				type: "number",
				required: true,
				description: "Latitude value between -90 and 90.",
			},
			{
				name: "lng",
				type: "number",
				required: true,
				description: "Longitude value between -180 and 180.",
			},
		],
		notes: [
			"Invalid or out-of-range coordinates return `400`.",
			"If no address exists within 200 meters, the API returns `404`.",
			"The response includes `distance` so you can reason about match quality.",
		],
		exampleResponse: `{
  "address": {
    "id": 104233,
    "formattedAddress": "123 Main St, Melbourne VIC 3000, AU",
    "streetAddress": "123 Main St",
    "locality": "Melbourne",
    "state": "VIC",
    "postcode": "3000",
    "country": "AU",
    "longitude": 144.9631,
    "latitude": -37.8136,
    "confidence": 92
  },
  "distance": 18,
  "query": {
    "lat": -37.8136,
    "lng": 144.9631
  }
}`,
	},
	{
		title: "Nearby Search",
		href: "#nearby",
		method: "GET",
		path: "/api/v1/addresses/nearby",
		summary: "Find addresses inside a radius around a coordinate.",
		description:
			"Nearby search returns multiple address records ordered by distance from the query point. It is useful when you need to inspect candidate addresses near an asset, confirm catchment coverage, or build operational tooling for support and logistics teams.",
		params: [
			{
				name: "lat",
				type: "number",
				required: true,
				description: "Latitude value between -90 and 90.",
			},
			{
				name: "lng",
				type: "number",
				required: true,
				description: "Longitude value between -180 and 180.",
			},
			{
				name: "radius",
				type: "number",
				required: false,
				description:
					"Radius in meters. Defaults to 1000 and is capped at 50000.",
			},
			{
				name: "limit",
				type: "number",
				required: false,
				description:
					"Maximum results to return. Defaults to 10 and is capped at 50.",
			},
			{
				name: "country",
				type: "string",
				required: false,
				description: "Optional country filter such as `AU`.",
			},
		],
		notes: [
			"Results are ordered by computed geographic distance from the query point.",
			"Country filters are normalized to uppercase before execution.",
			"Use smaller radii for operational tooling to avoid noisy address lists.",
		],
		exampleResponse: `{
  "results": [
    {
      "id": 104233,
      "country": "AU",
      "state": "VIC",
      "locality": "Melbourne",
      "postcode": "3000",
      "streetName": "Main",
      "streetType": "St",
      "numberFirst": "123",
      "longitude": 144.9631,
      "latitude": -37.8136,
      "distance": 42
    }
  ],
  "count": 1,
  "query": {
    "lat": -37.8136,
    "lng": 144.9631,
    "radius": 500
  }
}`,
	},
	{
		title: "Address by ID",
		href: "#address-by-id",
		method: "GET",
		path: "/api/v1/addresses/{id}",
		summary: "Fetch the canonical address record for a known identifier.",
		description:
			"After you have selected an address from autocomplete or another indexed flow, use the address ID endpoint to retrieve the underlying record again without re-running search. This keeps downstream workflows deterministic and removes ambiguity around free-form input.",
		params: [
			{
				name: "id",
				type: "number",
				required: true,
				description: "Numeric address identifier returned by search responses.",
			},
		],
		notes: [
			"Non-numeric IDs return `400`.",
			"Unknown IDs return `404`.",
			"The full address payload includes canonical fields such as `gnafPid` and `confidence` when available.",
		],
		exampleResponse: `{
  "id": 104233,
  "country": "AU",
  "state": "VIC",
  "locality": "Melbourne",
  "postcode": "3000",
  "streetName": "Main",
  "streetType": "St",
  "streetSuffix": null,
  "buildingName": null,
  "flatType": null,
  "flatNumber": null,
  "levelType": null,
  "levelNumber": null,
  "numberFirst": "123",
  "numberLast": null,
  "longitude": 144.9631,
  "latitude": -37.8136,
  "confidence": 92,
  "gnafPid": "GAVIC123456789"
}`,
	},
];

const docsToc = docsNavGroups.flatMap((group) => group.items);

const docsSectionIds = docsToc.map((item) => item.href.replace("#", ""));

const docsRouteRender = (to: string) => <Link to={to} />;

function CodeBlock({ code, label }: { code: string; label: string }) {
	return (
		<div className="overflow-hidden rounded-xl border bg-card">
			<div className="flex items-center justify-between border-b px-4 py-2">
				<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]">
					{label}
				</p>
			</div>
			<pre className="overflow-x-auto p-4 font-mono text-sm leading-6">
				<code>{code}</code>
			</pre>
		</div>
	);
}

function SectionHeading({
	id,
	eyebrow,
	title,
	description,
}: {
	description: string;
	eyebrow: string;
	id: string;
	title: string;
}) {
	return (
		<div className="scroll-mt-24 space-y-3" id={id}>
			<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.2em]">
				{eyebrow}
			</p>
			<div className="space-y-2">
				<h2 className="font-semibold text-2xl tracking-tight">{title}</h2>
				<p className="max-w-3xl text-base text-muted-foreground leading-7">
					{description}
				</p>
			</div>
		</div>
	);
}

function EndpointSection({ endpoint }: { endpoint: EndpointDoc }) {
	return (
		<section className="scroll-mt-24 space-y-6" id={endpoint.href.slice(1)}>
			<div className="space-y-3">
				<div className="flex flex-wrap items-center gap-3">
					<Badge className="font-mono text-emerald-600" variant="outline">
						{endpoint.method}
					</Badge>
					<code className="rounded-md bg-muted px-2 py-1 font-mono text-sm">
						{endpoint.path}
					</code>
				</div>
				<div className="space-y-2">
					<h3 className="font-semibold text-xl tracking-tight">
						{endpoint.title}
					</h3>
					<p className="text-base text-muted-foreground leading-7">
						{endpoint.description}
					</p>
				</div>
			</div>

			<div className="grid gap-4 md:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Why you would use it</CardTitle>
						<CardDescription>{endpoint.summary}</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						{endpoint.notes.map((note) => (
							<div className="flex gap-3" key={note}>
								<div className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
								<p className="text-muted-foreground text-sm leading-6">
									{note}
								</p>
							</div>
						))}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-base">Parameters</CardTitle>
						<CardDescription>
							Validate and normalize these values before you send the request.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						{endpoint.params.map((param) => (
							<div className="rounded-lg border p-3" key={param.name}>
								<div className="flex flex-wrap items-center gap-2">
									<code className="font-semibold text-sm">{param.name}</code>
									<Badge variant={param.required ? "default" : "secondary"}>
										{param.required ? "Required" : "Optional"}
									</Badge>
									<Badge className="font-mono" variant="outline">
										{param.type}
									</Badge>
								</div>
								<p className="mt-2 text-muted-foreground text-sm leading-6">
									{param.description}
								</p>
							</div>
						))}
					</CardContent>
				</Card>
			</div>

			<CodeBlock code={endpoint.exampleResponse} label="Example Response" />
		</section>
	);
}

export function DocsPage() {
	const [activeSection, setActiveSection] = useState("overview");

	const currentSectionTitle = useMemo(() => {
		return (
			docsToc.find((item) => item.href === `#${activeSection}`)?.title ??
			"Overview"
		);
	}, [activeSection]);

	const scrollToSection = (href: string) => {
		const sectionId = href.replace("#", "");
		setActiveSection(sectionId);

		const section = document.getElementById(sectionId);
		if (!section) {
			return;
		}

		section.scrollIntoView({ behavior: "smooth", block: "start" });
		window.history.replaceState(null, "", `#${sectionId}`);
	};

	useEffect(() => {
		const updateFromHash = () => {
			const hash = window.location.hash.replace("#", "");
			if (hash) {
				setActiveSection(hash);
			}
		};

		updateFromHash();

		const observedElements = docsSectionIds
			.map((id) => document.getElementById(id))
			.filter((element): element is HTMLElement => element !== null);

		const observer = new IntersectionObserver(
			(entries) => {
				const visibleEntries = entries
					.filter((entry) => entry.isIntersecting)
					.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
				const nextSectionId = visibleEntries[0]?.target.id;
				if (nextSectionId) {
					setActiveSection(nextSectionId);
				}
			},
			{
				rootMargin: "-18% 0px -62% 0px",
				threshold: [0, 1],
			}
		);

		for (const element of observedElements) {
			observer.observe(element);
		}

		window.addEventListener("hashchange", updateFromHash);

		return () => {
			window.removeEventListener("hashchange", updateFromHash);
			observer.disconnect();
		};
	}, []);

	return (
		<SidebarProvider className={cn("[--docs-wrapper-max-width:96rem]")}>
			<Sidebar
				className="border-r *:data-[slot=sidebar-inner]:bg-background"
				collapsible="offcanvas"
				variant="sidebar"
			>
				<SidebarHeader className="h-14 justify-center border-b px-2">
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton render={docsRouteRender("/")}>
								<LogoIcon />
								<span className="font-medium text-foreground">Wherabouts</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarHeader>
				<SidebarContent>
					{docsNavGroups.map((group) => (
						<SidebarGroup key={group.label}>
							<SidebarGroupLabel>{group.label}</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									{group.items.map((item) => (
										<SidebarMenuItem key={item.href}>
											<SidebarMenuButton
												isActive={activeSection === item.href.slice(1)}
												onClick={() => scrollToSection(item.href)}
											>
												<span>{item.title}</span>
											</SidebarMenuButton>
										</SidebarMenuItem>
									))}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					))}

					<SidebarGroup>
						<SidebarGroupLabel>Tools</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton render={docsRouteRender("/api-docs")}>
										<TerminalIcon />
										<span>API Explorer</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
								<SidebarMenuItem>
									<SidebarMenuButton render={docsRouteRender("/sign-up")}>
										<KeyRoundIcon />
										<span>Create API Key</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>
				<SidebarRail />
			</Sidebar>

			<SidebarInset>
				<header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur">
					<div className="flex items-center gap-3">
						<SidebarTrigger className="md:hidden" />
						<div>
							<p className="font-medium text-sm">Docs</p>
							<p className="text-muted-foreground text-xs">
								{currentSectionTitle}
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<Link to="/sign-in">
							<Button size="sm" variant="ghost">
								Sign in
							</Button>
						</Link>
						<Link to="/api-docs">
							<Button size="sm" variant="outline">
								<TerminalIcon className="size-4" />
								API Explorer
							</Button>
						</Link>
					</div>
				</header>

				<div className="mx-auto flex w-full max-w-(--docs-wrapper-max-width) flex-1 flex-col p-4 md:p-6">
					<div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_15rem]">
						<main className="space-y-12">
							<section className="scroll-mt-24 space-y-6" id="overview">
								<div className="space-y-4">
									<div className="flex flex-wrap gap-2">
										<Badge variant="secondary">Public documentation</Badge>
										<Badge variant="secondary">4 core address endpoints</Badge>
										<Badge variant="secondary">API key authentication</Badge>
									</div>
									<div className="space-y-3">
										<h1 className="max-w-3xl font-semibold text-4xl tracking-tight">
											Documentation built for shipping a production geocoding
											integration quickly.
										</h1>
										<p className="max-w-3xl text-base text-muted-foreground leading-7">
											Wherabouts gives you a clean HTTP interface for address
											autocomplete, reverse geocoding, nearby lookup, and
											canonical address retrieval. This page is the opinionated
											path through the API: what to call first, how
											authentication works, what validation happens on the
											server, and how to structure a reliable implementation.
										</p>
									</div>
									<div className="flex flex-wrap gap-3">
										<a href="#quickstart">
											<Button>
												<BookOpenIcon className="size-4" />
												Start with quickstart
											</Button>
										</a>
										<Link to="/api-docs">
											<Button variant="outline">
												<TerminalIcon className="size-4" />
												Open API Explorer
											</Button>
										</Link>
										<a href="/api/openapi.json" rel="noopener" target="_blank">
											<Button variant="outline">
												<BracesIcon className="size-4" />
												OpenAPI JSON
											</Button>
										</a>
									</div>
								</div>

								<div className="grid gap-4 md:grid-cols-3">
									<Card>
										<CardHeader className="space-y-2">
											<SearchIcon className="size-5 text-muted-foreground" />
											<CardTitle className="text-base">
												Search-first flow
											</CardTitle>
										</CardHeader>
										<CardContent>
											<p className="text-muted-foreground text-sm leading-6">
												Use autocomplete to capture intent early, then persist
												the selected address ID for deterministic follow-up
												calls.
											</p>
										</CardContent>
									</Card>

									<Card>
										<CardHeader className="space-y-2">
											<LocateFixedIcon className="size-5 text-muted-foreground" />
											<CardTitle className="text-base">
												Coordinate-aware endpoints
											</CardTitle>
										</CardHeader>
										<CardContent>
											<p className="text-muted-foreground text-sm leading-6">
												Reverse and nearby endpoints validate coordinate ranges
												and return distance-aware results for operational
												workflows.
											</p>
										</CardContent>
									</Card>

									<Card>
										<CardHeader className="space-y-2">
											<KeyRoundIcon className="size-5 text-muted-foreground" />
											<CardTitle className="text-base">
												Simple auth model
											</CardTitle>
										</CardHeader>
										<CardContent>
											<p className="text-muted-foreground text-sm leading-6">
												Authenticate with `Authorization: Bearer` or
												`X-API-Key`. Successful `2xx` responses are
												automatically recorded against the key that made the
												request.
											</p>
										</CardContent>
									</Card>
								</div>
							</section>

							<section className="space-y-6" id="quickstart">
								<SectionHeading
									description="If you are integrating Wherabouts for the first time, start with autocomplete. It exercises the authentication path, the public API hostname, and the response envelope you will see across the address search surface."
									eyebrow="First request"
									id="quickstart"
									title="Quickstart"
								/>

								<Tabs className="space-y-4" defaultValue="curl">
									<TabsList>
										<TabsTrigger value="curl">cURL</TabsTrigger>
										<TabsTrigger value="javascript">JavaScript</TabsTrigger>
										<TabsTrigger value="python">Python</TabsTrigger>
									</TabsList>
									{(
										Object.entries(quickstartCode) as [
											keyof typeof quickstartCode,
											string,
										][]
									).map(([lang, code]) => (
										<TabsContent key={lang} value={lang}>
											<CodeBlock code={code} label={lang} />
										</TabsContent>
									))}
								</Tabs>

								<Card>
									<CardHeader>
										<CardTitle className="text-base">What to expect</CardTitle>
										<CardDescription>
											Autocomplete returns a `results` array plus a `count`
											field.
										</CardDescription>
									</CardHeader>
									<CardContent className="grid gap-3 md:grid-cols-3">
										<div className="rounded-lg border p-4">
											<p className="font-medium text-sm">Auth</p>
											<p className="mt-2 text-muted-foreground text-sm leading-6">
												Pass the key in{" "}
												<code>Authorization: Bearer {"<key>"}</code> or{" "}
												<code>X-API-Key</code>.
											</p>
										</div>
										<div className="rounded-lg border p-4">
											<p className="font-medium text-sm">Validation</p>
											<p className="mt-2 text-muted-foreground text-sm leading-6">
												Queries shorter than 2 characters fail fast with `400`.
											</p>
										</div>
										<div className="rounded-lg border p-4">
											<p className="font-medium text-sm">Usage tracking</p>
											<p className="mt-2 text-muted-foreground text-sm leading-6">
												Only successful `2xx` responses increment daily usage.
												Production requests and interactive explorer tests are
												recorded separately.
											</p>
										</div>
									</CardContent>
								</Card>
							</section>

							<section className="space-y-6" id="openapi-spec">
								<SectionHeading
									description="The public REST contract is also published as an OpenAPI document so SDK work, contract review, and external tooling can target the same source of truth as the docs page."
									eyebrow="Contract"
									id="openapi-spec"
									title="Use the published OpenAPI spec"
								/>

								<div className="grid gap-4 md:grid-cols-2">
									<Card>
										<CardHeader>
											<CardTitle className="text-base">Spec URL</CardTitle>
											<CardDescription>
												Fetch the machine-readable contract directly from the
												app.
											</CardDescription>
										</CardHeader>
										<CardContent className="space-y-3">
											<code className="block rounded bg-muted px-3 py-2 font-mono text-sm">
												https://api.wherabouts.com/api/openapi.json
											</code>
											<p className="text-muted-foreground text-sm leading-6">
												Use this document for SDK generation, contract reviews,
												Postman imports, or CI checks against the current v1
												surface.
											</p>
											<a
												href="/api/openapi.json"
												rel="noopener"
												target="_blank"
											>
												<Button size="sm" variant="outline">
													<BracesIcon className="size-4" />
													View OpenAPI JSON
												</Button>
											</a>
										</CardContent>
									</Card>

									<Card>
										<CardHeader>
											<CardTitle className="text-base">
												What it covers
											</CardTitle>
											<CardDescription>
												The spec mirrors the currently supported public address
												endpoints.
											</CardDescription>
										</CardHeader>
										<CardContent className="space-y-3 text-muted-foreground text-sm leading-6">
											<p>
												Every documented endpoint includes authentication
												requirements, parameters, error schemas, and a response
												summary.
											</p>
											<p>
												If you are building a client library, prefer the OpenAPI
												document plus the interactive explorer together so you
												can validate both static contracts and live behavior.
											</p>
										</CardContent>
									</Card>
								</div>
							</section>

							<section className="space-y-6" id="js-ts-sdk">
								<SectionHeading
									description="Phase 2 starts by giving JavaScript and TypeScript consumers a typed client instead of forcing every integration to hand-roll `fetch` wrappers. The current preview SDK is a lightweight REST client over the same public v1 endpoints documented here."
									eyebrow="SDK preview"
									id="js-ts-sdk"
									title="Use the first-party JS/TS client"
								/>

								<div className="grid gap-4 md:grid-cols-2">
									<Card>
										<CardHeader>
											<CardTitle className="text-base">
												Workspace package
											</CardTitle>
											<CardDescription>
												The SDK currently lives in this repo as a typed
												workspace package.
											</CardDescription>
										</CardHeader>
										<CardContent className="space-y-3">
											<code className="block rounded bg-muted px-3 py-2 font-mono text-sm">
												@wherabouts.com/sdk
											</code>
											<p className="text-muted-foreground text-sm leading-6">
												It exposes a single `createWheraboutsClient()`
												entrypoint, stable response types for the public address
												API, and a normalized `WheraboutsApiError` for non-`2xx`
												failures.
											</p>
										</CardContent>
									</Card>

									<Card>
										<CardHeader>
											<CardTitle className="text-base">Why it exists</CardTitle>
											<CardDescription>
												The public platform contract is REST, so the SDK targets
												the documented v1 endpoints directly.
											</CardDescription>
										</CardHeader>
										<CardContent className="space-y-3 text-muted-foreground text-sm leading-6">
											<p>
												This keeps public client adoption separate from the
												internal dashboard&apos;s ORPC transport and makes the
												SDK a clean fit for Node runtimes, browser apps,
												workers, and framework wrappers.
											</p>
											<p>
												The first preview covers autocomplete, reverse
												geocoding, nearby search, and canonical address lookup
												by ID.
											</p>
										</CardContent>
									</Card>
								</div>

								<CodeBlock code={quickstartCode.sdk} label="TypeScript SDK" />
							</section>

							<section className="space-y-6" id="authentication">
								<SectionHeading
									description="The public address API is protected with API keys rather than session auth. That keeps server-to-server usage simple while still allowing the dashboard to manage keys and inspect usage safely."
									eyebrow="Authentication"
									id="authentication"
									title="Send the API key on every request"
								/>

								<div className="grid gap-4 md:grid-cols-2">
									<Card>
										<CardHeader>
											<CardTitle className="text-base">
												Accepted headers
											</CardTitle>
										</CardHeader>
										<CardContent className="space-y-3">
											<div className="rounded-lg border p-4">
												<p className="font-medium text-sm">Preferred</p>
												<code className="mt-2 block rounded bg-muted px-3 py-2 font-mono text-sm">
													Authorization: Bearer wh_live_your_api_key
												</code>
											</div>
											<div className="rounded-lg border p-4">
												<p className="font-medium text-sm">Also supported</p>
												<code className="mt-2 block rounded bg-muted px-3 py-2 font-mono text-sm">
													X-API-Key: wh_live_your_api_key
												</code>
											</div>
										</CardContent>
									</Card>

									<Card>
										<CardHeader>
											<CardTitle className="text-base">
												Failure behavior
											</CardTitle>
										</CardHeader>
										<CardContent className="space-y-3 text-muted-foreground text-sm leading-6">
											<p>
												Missing keys return `401` with guidance to send a bearer
												token or `X-API-Key`.
											</p>
											<p>
												Invalid or revoked keys also return `401`. The address
												handler is never called when authentication fails.
											</p>
											<p>
												Successful requests update `lastUsedAt` and feed daily
												usage accounting automatically. Explorer-originated test
												requests are marked separately from production traffic.
											</p>
										</CardContent>
									</Card>
								</div>

								<Card>
									<CardHeader>
										<CardTitle className="text-base">
											How interactive testing works
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-3 text-muted-foreground text-sm leading-6">
										<p>
											When you are signed in, the dashboard explorer defaults to
											a managed-key proxy flow. You choose one of your active
											keys and the explorer sends the request server-side
											without requiring you to paste the raw secret.
										</p>
										<p>
											If you need to validate a specific bearer token manually,
											the explorer also supports a raw-key mode. Raw keys are
											kept only for the current browser session and are never
											persisted by the explorer.
										</p>
										<p>
											Every explorer request is labeled as `Test traffic`, so it
											shows up separately from production usage in the
											dashboard.
										</p>
									</CardContent>
								</Card>
							</section>

							<div className="space-y-10">
								<SectionHeading
									description="These are the four address endpoints currently exposed in the app. The docs below mirror the actual path names and request validation behavior implemented on the server today."
									eyebrow="API surface"
									id="autocomplete"
									title="Core endpoints"
								/>

								{endpointDocs.map((endpoint) => (
									<EndpointSection endpoint={endpoint} key={endpoint.path} />
								))}
							</div>

							<section className="space-y-6" id="errors-and-constraints">
								<SectionHeading
									description="The API keeps failures explicit and predictable. The main categories are authentication failures, request validation failures, and not-found responses for queries that do not resolve to an address."
									eyebrow="Operational behavior"
									id="errors-and-constraints"
									title="Errors and constraints"
								/>

								<div className="grid gap-4 md:grid-cols-3">
									<Card>
										<CardHeader>
											<CardTitle className="flex items-center gap-2 text-base">
												<KeyRoundIcon className="size-4" />
												401 Unauthorized
											</CardTitle>
										</CardHeader>
										<CardContent>
											<p className="text-muted-foreground text-sm leading-6">
												Returned when the API key is missing, invalid, revoked,
												or expired. Error responses use a stable envelope:
												`error.code` plus `error.message`.
											</p>
										</CardContent>
									</Card>

									<Card>
										<CardHeader>
											<CardTitle className="flex items-center gap-2 text-base">
												<AlertTriangleIcon className="size-4" />
												400 Validation
											</CardTitle>
										</CardHeader>
										<CardContent>
											<p className="text-muted-foreground text-sm leading-6">
												Used for short search queries, malformed IDs, missing
												coordinates, or coordinates outside valid geographic
												bounds.
											</p>
										</CardContent>
									</Card>

									<Card>
										<CardHeader>
											<CardTitle className="flex items-center gap-2 text-base">
												<MapPinIcon className="size-4" />
												404 Not Found
											</CardTitle>
										</CardHeader>
										<CardContent>
											<p className="text-muted-foreground text-sm leading-6">
												Used when a numeric address ID does not exist or reverse
												geocoding cannot find an address within 200 meters.
											</p>
										</CardContent>
									</Card>
								</div>

								<Card>
									<CardHeader>
										<CardTitle className="text-base">
											Current request constraints
										</CardTitle>
									</CardHeader>
									<CardContent className="grid gap-3 md:grid-cols-2">
										<div className="rounded-lg border p-4">
											<p className="font-medium text-sm">Autocomplete</p>
											<p className="mt-2 text-muted-foreground text-sm leading-6">
												`q` must be at least 2 characters. `limit` defaults to
												10 and is capped at 20.
											</p>
										</div>
										<div className="rounded-lg border p-4">
											<p className="font-medium text-sm">Nearby</p>
											<p className="mt-2 text-muted-foreground text-sm leading-6">
												`radius` defaults to 1000m and is capped at 50000m.
												`limit` defaults to 10 and is capped at 50.
											</p>
										</div>
										<div className="rounded-lg border p-4">
											<p className="font-medium text-sm">Reverse</p>
											<p className="mt-2 text-muted-foreground text-sm leading-6">
												Searches the nearest address within 200m and returns
												exactly one match.
											</p>
										</div>
										<div className="rounded-lg border p-4">
											<p className="font-medium text-sm">Coordinates</p>
											<p className="mt-2 text-muted-foreground text-sm leading-6">
												Latitude must remain inside `-90..90` and longitude
												inside `-180..180`.
											</p>
										</div>
									</CardContent>
								</Card>

								<CodeBlock
									code={`{
  "error": {
    "code": "bad_request",
    "message": "Query parameter 'q' must be at least 2 characters."
  }
}`}
									label="Error Envelope"
								/>
							</section>

							<section className="space-y-6" id="health-checks">
								<SectionHeading
									description="Baseline platform observability starts with a public health surface and response timing data. These routes are intended for synthetic checks, deployment verification, and integration smoke tests."
									eyebrow="Observability"
									id="health-checks"
									title="Health checks and timing"
								/>

								<div className="grid gap-4 md:grid-cols-2">
									<Card>
										<CardHeader>
											<CardTitle className="text-base">
												Health endpoint
											</CardTitle>
											<CardDescription>
												Use this route for uptime probes and deployment checks.
											</CardDescription>
										</CardHeader>
										<CardContent className="space-y-3">
											<code className="block rounded bg-muted px-3 py-2 font-mono text-sm">
												https://api.wherabouts.com/api/health
											</code>
											<p className="text-muted-foreground text-sm leading-6">
												The health response includes the published platform SLO
												targets for latency and uptime, plus a timestamped
												service status result.
											</p>
										</CardContent>
									</Card>

									<Card>
										<CardHeader>
											<CardTitle className="text-base">Server-Timing</CardTitle>
											<CardDescription>
												Core API responses expose request duration directly in
												the response headers.
											</CardDescription>
										</CardHeader>
										<CardContent className="space-y-3 text-muted-foreground text-sm leading-6">
											<p>
												Check the `Server-Timing` header to inspect endpoint
												latency while testing in the explorer, from your own
												client, or through synthetic monitoring.
											</p>
											<p>
												This is the baseline measurement layer for the v1 API
												surface while richer dashboard analytics continue to
												mature.
											</p>
										</CardContent>
									</Card>
								</div>
							</section>

							<section className="space-y-6" id="integration-checklist">
								<SectionHeading
									description="If you want the cleanest production implementation, treat the docs as an execution checklist rather than a reference page you skim once."
									eyebrow="Delivery checklist"
									id="integration-checklist"
									title="Integration checklist"
								/>

								<div className="grid gap-4 md:grid-cols-2">
									<Card>
										<CardHeader>
											<CardTitle className="text-base">
												Recommended flow
											</CardTitle>
										</CardHeader>
										<CardContent className="space-y-3">
											<div className="flex gap-3">
												<SearchIcon className="mt-1 size-4 shrink-0 text-muted-foreground" />
												<p className="text-muted-foreground text-sm leading-6">
													Start with autocomplete for user-entered text so the
													user selects a canonical address rather than
													submitting free-form input.
												</p>
											</div>
											<div className="flex gap-3">
												<BracesIcon className="mt-1 size-4 shrink-0 text-muted-foreground" />
												<p className="text-muted-foreground text-sm leading-6">
													Store the returned address `id` and use the by-ID
													endpoint whenever you need to rehydrate that record
													later.
												</p>
											</div>
											<div className="flex gap-3">
												<LocateFixedIcon className="mt-1 size-4 shrink-0 text-muted-foreground" />
												<p className="text-muted-foreground text-sm leading-6">
													Use reverse or nearby only when you already trust the
													source coordinates or want map-adjacent workflows.
												</p>
											</div>
										</CardContent>
									</Card>

									<Card>
										<CardHeader>
											<CardTitle className="text-base">
												Implementation details
											</CardTitle>
										</CardHeader>
										<CardContent className="space-y-3">
											<div className="flex gap-3">
												<Code2Icon className="mt-1 size-4 shrink-0 text-muted-foreground" />
												<p className="text-muted-foreground text-sm leading-6">
													Handle `400` and `401` explicitly in your client layer
													so forms can recover gracefully without masking
													validation issues.
												</p>
											</div>
											<div className="flex gap-3">
												<KeyRoundIcon className="mt-1 size-4 shrink-0 text-muted-foreground" />
												<p className="text-muted-foreground text-sm leading-6">
													Keep API keys on trusted infrastructure or server
													routes when possible instead of exposing them directly
													in a public client.
												</p>
											</div>
											<div className="flex gap-3">
												<BookOpenIcon className="mt-1 size-4 shrink-0 text-muted-foreground" />
												<p className="text-muted-foreground text-sm leading-6">
													Use the API explorer after sign-in when you want to
													validate request shapes and inspect responses
													interactively.
												</p>
											</div>
										</CardContent>
									</Card>
								</div>
							</section>

							<section className="space-y-6" id="next-steps">
								<SectionHeading
									description="Once your first request works, the fastest next move is to generate a dedicated API key for the environment you are shipping and test the exact endpoint mix you expect to use in production."
									eyebrow="Next steps"
									id="next-steps"
									title="Move from docs to implementation"
								/>

								<div className="grid gap-4 md:grid-cols-3">
									<Card className="h-full">
										<CardHeader>
											<CardTitle className="text-base">Create a key</CardTitle>
											<CardDescription>
												Generate the key you will use for development or
												staging.
											</CardDescription>
										</CardHeader>
										<CardContent>
											<Link to="/sign-up">
												<Button className="w-full">
													Create account
													<ArrowRightIcon className="size-4" />
												</Button>
											</Link>
										</CardContent>
									</Card>

									<Card className="h-full">
										<CardHeader>
											<CardTitle className="text-base">
												Inspect requests
											</CardTitle>
											<CardDescription>
												Use the protected explorer to verify parameters and
												outputs.
											</CardDescription>
										</CardHeader>
										<CardContent>
											<Link to="/api-docs">
												<Button className="w-full" variant="outline">
													Open API Explorer
												</Button>
											</Link>
										</CardContent>
									</Card>

									<Card className="h-full">
										<CardHeader>
											<CardTitle className="text-base">Track usage</CardTitle>
											<CardDescription>
												Watch successful request volume once your integration is
												live.
											</CardDescription>
										</CardHeader>
										<CardContent>
											<Link to="/dashboard">
												<Button className="w-full" variant="outline">
													View dashboard
												</Button>
											</Link>
										</CardContent>
									</Card>
								</div>
							</section>
						</main>

						<aside className="hidden xl:block">
							<div className="sticky top-24 space-y-4 rounded-xl border bg-card p-4">
								<p className="font-medium text-sm">On this page</p>
								<nav className="space-y-1">
									{docsToc.map((item) => (
										<a
											className={cn(
												"block rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted",
												activeSection === item.href.slice(1)
													? "bg-muted font-medium text-foreground"
													: "text-muted-foreground"
											)}
											href={item.href}
											key={item.href}
										>
											{item.title}
										</a>
									))}
								</nav>
								<div className="rounded-lg border border-dashed p-3">
									<p className="font-medium text-sm">
										Need interactive testing?
									</p>
									<p className="mt-2 text-muted-foreground text-sm leading-6">
										The API explorer lives behind sign-in so you can test with
										real project keys safely.
									</p>
									<Link to="/api-docs">
										<Button className="mt-3 w-full" size="sm" variant="outline">
											<TerminalIcon className="size-4" />
											Open explorer
										</Button>
									</Link>
								</div>
							</div>
						</aside>
					</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
