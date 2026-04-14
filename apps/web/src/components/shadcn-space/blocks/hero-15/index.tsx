import HeroSection from "@/components/shadcn-space/blocks/hero-15/hero";
import type { NavigationSection } from "@/components/shadcn-space/blocks/hero-15/navbar";
import Navbar from "@/components/shadcn-space/blocks/hero-15/navbar";

const navigationData: NavigationSection[] = [
	{
		name: "Dashboard",
		href: "/dashboard",
	},
	{
		name: "Why Wherabouts",
		href: "#why",
		isActive: true,
	},
	{
		name: "Docs",
		href: "/docs",
	},
	{
		name: "Features",
		href: "#features",
	},
	{
		name: "Example outcomes",
		href: "#developers",
	},
	{
		name: "Updates",
		href: "#newsletter",
	},
];

const HeroPage = () => {
	return (
		<div className="dark bg-background">
			<Navbar navigationData={navigationData} />
			<HeroSection />
		</div>
	);
};

export default HeroPage;
