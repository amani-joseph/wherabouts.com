import HeroSection from "@/components/shadcn-space/blocks/hero-15/hero";
import Navbar from "@/components/shadcn-space/blocks/hero-15/navbar";
import { navigationData } from "@/components/shadcn-space/blocks/hero-15/navigation-data";

const HeroPage = () => {
	return (
		<div className="dark bg-background">
			<Navbar navigationData={navigationData} />
			<HeroSection />
		</div>
	);
};

export default HeroPage;
