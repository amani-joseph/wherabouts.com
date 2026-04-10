import { createFileRoute } from "@tanstack/react-router";
import Feature from "@/components/shadcn-space/blocks/feature-15/feature";
import Footer from "@/components/shadcn-space/blocks/footer-02/footer";
import HeroPage from "@/components/shadcn-space/blocks/hero-15";
import Integration from "@/components/shadcn-space/blocks/integration-01/integration";
import Testimonial from "@/components/shadcn-space/blocks/testimonial-07/testimonial";

export const Route = createFileRoute("/")({
	component: HomeComponent,
});

function HomeComponent() {
	return (
		<div>
			<HeroPage />
			<Integration />
			<Feature />
			<Testimonial />
			<Footer />
		</div>
	);
}
