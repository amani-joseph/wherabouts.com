import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from "./seo.ts";

export interface JsonLdScriptTag {
	children: string;
	type: "application/ld+json";
}

export function organizationJsonLd(): Record<string, unknown> {
	return {
		"@context": "https://schema.org",
		"@type": "Organization",
		name: SITE_NAME,
		url: SITE_URL,
		logo: {
			"@type": "ImageObject",
			url: absoluteUrl("/brand/png/logo-mark-512.png"),
		},
	};
}

export function softwareApplicationJsonLd(): Record<string, unknown> {
	return {
		"@context": "https://schema.org",
		"@type": "SoftwareApplication",
		name: SITE_NAME,
		url: SITE_URL,
		applicationCategory: "DeveloperApplication",
		operatingSystem: "Any",
		image: absoluteUrl(DEFAULT_OG_IMAGE),
		description:
			"Production-ready location APIs — address autocomplete, geocoding, geofencing, routing, and device tracking.",
		featureList: [
			"Address autocomplete",
			"Geocoding",
			"Reverse geocoding",
			"Geofencing",
			"Routing",
			"Device tracking",
		],
		offers: {
			"@type": "Offer",
			price: "0",
			priceCurrency: "USD",
			description: "Free monthly request allotment, then usage-based pricing.",
		},
	};
}

export function techArticleJsonLd(input: {
	title: string;
	description: string;
	path: string;
}): Record<string, unknown> {
	return {
		"@context": "https://schema.org",
		"@type": "TechArticle",
		headline: input.title,
		description: input.description,
		url: absoluteUrl(input.path),
		image: absoluteUrl(DEFAULT_OG_IMAGE),
		publisher: {
			"@type": "Organization",
			name: SITE_NAME,
			url: SITE_URL,
		},
	};
}

export function breadcrumbJsonLd(
	items: { name: string; path: string }[]
): Record<string, unknown> {
	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: items.map((item, index) => ({
			"@type": "ListItem",
			position: index + 1,
			name: item.name,
			item: absoluteUrl(item.path),
		})),
	};
}

export function jsonLdScript(data: Record<string, unknown>): JsonLdScriptTag {
	return {
		type: "application/ld+json",
		children: JSON.stringify(data),
	};
}
