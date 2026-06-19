import { createFileRoute } from "@tanstack/react-router";
import ApiInAction from "@/components/landing/api-in-action";
import Capabilities from "@/components/landing/capabilities";
import Feature from "@/components/shadcn-space/blocks/feature-15/feature";
import Footer from "@/components/shadcn-space/blocks/footer-02/footer";
import HeroPage from "@/components/shadcn-space/blocks/hero-15";
import Integration from "@/components/shadcn-space/blocks/integration-01/integration";
import Testimonial from "@/components/shadcn-space/blocks/testimonial-07/testimonial";
import { buildSeo } from "@/lib/seo";
import { jsonLdScript, softwareApplicationJsonLd } from "@/lib/structured-data";

export const Route = createFileRoute("/")({
	head: () => {
		const seo = buildSeo({
			title: "Geocoding, Geofencing & Routing APIs for Developers | Wherabouts",
			description:
				"Production-ready location APIs — address autocomplete, geocoding, geofencing, routing, and device tracking. Ship location features fast with US & Australia coverage.",
			path: "/",
			ogType: "website",
			keywords:
				"geocoding API, geofencing API, routing API, address autocomplete, reverse geocoding, location API",
		});
		return {
			meta: seo.meta,
			links: seo.links,
			scripts: [jsonLdScript(softwareApplicationJsonLd())],
		};
	},
	component: HomeComponent,
});

function HomeComponent() {
	return (
		<div>
			<HeroPage />
			<Integration />
			<Capabilities />
			<ApiInAction />
			<Feature />
			<Testimonial />
			<Footer />
		</div>
	);
}
