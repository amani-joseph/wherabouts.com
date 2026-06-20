import { createFileRoute, Outlet } from "@tanstack/react-router";
import Footer from "@/components/shadcn-space/blocks/footer-02/footer";
import Navbar from "@/components/shadcn-space/blocks/hero-15/navbar";
import { navigationData } from "@/components/shadcn-space/blocks/hero-15/navigation-data";

export const Route = createFileRoute("/_public")({
	component: RouteComponent,
});

// Shared chrome for public marketing pages (pricing, coverage): the same
// top navigation as the landing hero plus the site footer, so each page only
// renders its own content.
function RouteComponent() {
	return (
		<div className="flex min-h-screen flex-col bg-background">
			<Navbar navigationData={navigationData} />
			<div className="flex-1">
				<Outlet />
			</div>
			<Footer />
		</div>
	);
}
