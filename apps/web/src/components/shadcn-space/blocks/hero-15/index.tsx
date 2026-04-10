import type { BrandList } from "@/components/shadcn-space/blocks/hero-15/hero";
import HeroSection from "@/components/shadcn-space/blocks/hero-15/hero";
import type { NavigationSection } from "@/components/shadcn-space/blocks/hero-15/navbar";
import Navbar from "@/components/shadcn-space/blocks/hero-15/navbar";

const navigationData: NavigationSection[] = [
	{
		name: "Why Wherabouts",
		href: "#why",
		isActive: true,
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

const brandList: BrandList[] = [
	{
		image:
			"https://images.shadcnspace.com/assets/brand-logo/logo-icon-dark-1.svg",
		name: "Mobile & web apps",
	},
	{
		image:
			"https://images.shadcnspace.com/assets/brand-logo/logo-icon-dark-2.svg",
		name: "Marketplaces & booking",
	},
	{
		image:
			"https://images.shadcnspace.com/assets/brand-logo/logo-icon-dark-3.svg",
		name: "Logistics & fleets",
	},
	{
		image:
			"https://images.shadcnspace.com/assets/brand-logo/logo-icon-dark-4.svg",
		name: "B2B SaaS",
	},
];

const HeroPage = () => {
	return (
		<div className="dark bg-background">
			<Navbar navigationData={navigationData} />
			<HeroSection brandList={brandList} />
		</div>
	);
};

export default HeroPage;
