import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@wherabouts.com/ui/components/badge";
import { Input } from "@wherabouts.com/ui/components/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@wherabouts.com/ui/components/table";
import { useMemo, useState } from "react";
import {
	CAPABILITY_LABELS,
	COVERAGE_COUNTRIES,
	filterCountries,
	iso2ToFlag,
} from "@/data/coverage";
import { buildSeo } from "@/lib/seo";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/structured-data";

const COVERAGE_TITLE = "Coverage — Countries with Address Data | Wherabouts";
const COVERAGE_DESCRIPTION =
	"See which countries the Wherabouts location API supports for geocoding, reverse geocoding, and address autocomplete before you integrate.";

export const Route = createFileRoute("/coverage")({
	head: () => {
		const seo = buildSeo({
			title: COVERAGE_TITLE,
			description: COVERAGE_DESCRIPTION,
			path: "/coverage",
			ogType: "website",
		});
		return {
			meta: seo.meta,
			links: seo.links,
			scripts: [
				jsonLdScript(
					breadcrumbJsonLd([
						{ name: "Home", path: "/" },
						{ name: "Coverage", path: "/coverage" },
					])
				),
			],
		};
	},
	component: RouteComponent,
});

function RouteComponent() {
	const [query, setQuery] = useState("");
	const countries = useMemo(
		() => filterCountries(query, COVERAGE_COUNTRIES),
		[query]
	);

	return (
		<main className="mx-auto max-w-4xl px-4 py-16 md:px-6">
			<header className="mb-8">
				<h1 className="font-semibold text-3xl tracking-tight">Coverage</h1>
				<p className="mt-2 text-muted-foreground text-sm">
					Countries with address data available through the Wherabouts API.
				</p>
				<p className="mt-1 text-muted-foreground text-xs">
					{countries.length === COVERAGE_COUNTRIES.length
						? `${COVERAGE_COUNTRIES.length} countries`
						: `${countries.length} of ${COVERAGE_COUNTRIES.length} countries`}
				</p>
			</header>

			<Input
				aria-label="Search countries"
				className="mb-6 max-w-sm"
				onChange={(event) => setQuery(event.target.value)}
				placeholder="Search by country or code…"
				type="search"
				value={query}
			/>

			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Country</TableHead>
						<TableHead>Code</TableHead>
						<TableHead>Capabilities</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{countries.length === 0 ? (
						<TableRow>
							<TableCell
								className="text-center text-muted-foreground"
								colSpan={3}
							>
								No countries match "{query}".
							</TableCell>
						</TableRow>
					) : (
						countries.map((country) => (
							<TableRow key={country.iso2}>
								<TableCell className="font-medium">
									<span aria-hidden="true" className="mr-2">
										{iso2ToFlag(country.iso2)}
									</span>
									{country.name}
								</TableCell>
								<TableCell className="text-muted-foreground">
									{country.iso2}
								</TableCell>
								<TableCell>
									<div className="flex flex-wrap gap-1">
										{country.capabilities.map((capability) => (
											<Badge key={capability} variant="secondary">
												{CAPABILITY_LABELS[capability]}
											</Badge>
										))}
									</div>
								</TableCell>
							</TableRow>
						))
					)}
				</TableBody>
			</Table>

			<p className="mt-8 text-muted-foreground text-sm">
				Don't see your country?{" "}
				<a
					className="underline underline-offset-4 hover:text-foreground"
					href="mailto:hello@wherabouts.com"
				>
					Request coverage <span aria-hidden="true">→</span>
				</a>
			</p>
		</main>
	);
}
