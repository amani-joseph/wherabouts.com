"use client";
import { ArrowRight } from "lucide-react";
import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { Marquee } from "@/components/shadcn-space/animations/marquee";
import ParticleSphereAnimation from "@/components/shadcn-space/blocks/hero-15/particalsphear";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface BrandList {
	image: string;
	name: string;
}

const HeroSection = ({ brandList }: { brandList: BrandList[] }) => {
	const sectionRef = useRef<HTMLElement>(null);
	const isInView = useInView(sectionRef, { once: true, amount: 0.1 });

	const containerVariants = {
		hidden: { opacity: 0 },
		visible: {
			opacity: 1,
			transition: {
				staggerChildren: 0.15,
				delayChildren: 0.1,
			},
		},
	};

	const itemVariants = {
		hidden: { opacity: 0, y: 20 },
		visible: {
			opacity: 1,
			y: 0,
			transition: {
				duration: 0.8,
				ease: [0.21, 0.47, 0.32, 0.98],
			},
		},
	};

	const h1Variants = {
		hidden: { opacity: 1 },
		visible: {
			opacity: 1,
			transition: {
				staggerChildren: 0.02,
			},
		},
	};

	const charVariants = {
		hidden: { opacity: 0, y: 10 },
		visible: {
			opacity: 1,
			y: 0,
			transition: {
				duration: 0.4,
			},
		},
	};

	return (
		<section id="top" ref={sectionRef}>
			<motion.div
				animate={isInView ? "visible" : "hidden"}
				className="relative mx-auto flex max-w-7xl flex-col items-center justify-center gap-8 overflow-hidden px-4 py-7 text-center md:min-h-196 md:gap-24 md:py-24 lg:px-8 xl:px-16"
				initial="hidden"
				variants={containerVariants}
			>
				<div className="relative z-10 flex flex-col items-center justify-center gap-6 text-center">
					<motion.div
						className="flex w-fit items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1"
						variants={itemVariants}
					>
						<div className="h-1 w-1 rounded-full bg-teal-400" />
						<p className="font-normal text-foreground text-sm">
							Locations API — public beta
						</p>
						<ArrowRight className="text-foreground" size={16} />
					</motion.div>
					<div className="flex flex-col items-center gap-4 text-center">
						<motion.h1
							className="text-center font-normal text-4xl text-foreground sm:text-6xl md:text-7xl lg:text-8xl"
							variants={h1Variants}
						>
							{"Build ".split("").map((char, i, chars) => (
								<motion.span
									key={`h1-a-${chars.slice(0, i + 1).join("")}`}
									variants={charVariants}
								>
									{char}
								</motion.span>
							))}
							<span className="italic">
								{"smarter location UX".split("").map((char, i, chars) => (
									<motion.span
										key={`h1-b-${chars.slice(0, i + 1).join("")}`}
										variants={charVariants}
									>
										{char}
									</motion.span>
								))}
							</span>
							{" in your product".split("").map((char, i, chars) => (
								<motion.span
									key={`h1-c-${chars.slice(0, i + 1).join("")}`}
									variants={charVariants}
								>
									{char}
								</motion.span>
							))}
						</motion.h1>
						<motion.p
							className="max-w-lg font-normal text-base text-muted-foreground"
							variants={itemVariants}
						>
							Wherabouts is a locations API for developers—search, autocomplete,
							and geocoding you can ship without wiring your product to
							consumer-maps platforms built for ads and embedded widgets.
							Predictable pricing, clear errors, and docs that respect your
							time.
						</motion.p>
					</div>
					<motion.div
						className="flex flex-wrap justify-center gap-2"
						variants={itemVariants}
					>
						<a
							className={cn(
								buttonVariants({ variant: "default" }),
								"h-auto cursor-pointer rounded-full px-5 py-2.5 md:px-6 md:py-3.5"
							)}
							href="#features"
						>
							Explore the API
						</a>
						<a
							className={cn(
								buttonVariants({ variant: "outline" }),
								"inline-flex h-auto cursor-pointer items-center gap-2 rounded-full px-5 py-2.5 text-foreground md:px-6 md:py-3.5"
							)}
							href="#pricing"
						>
							Get API access
							<ArrowRight className="text-foreground" size={16} />
						</a>
					</motion.div>
				</div>
				<motion.div
					className="relative z-10 flex flex-col items-center justify-center gap-2 overflow-hidden text-center md:mx-auto md:max-w-2xl md:gap-4"
					variants={itemVariants}
				>
					<p className="font-normal text-muted-foreground text-sm">
						Built for teams shipping location in:
					</p>
					{brandList && brandList.length > 0 && (
						<div className="py-4">
							<Marquee className="p-0 [--duration:20s]" pauseOnHover>
								{brandList.map((brand) => (
									<div key={`${brand.name}-${brand.image}`}>
										<img
											alt={brand.name}
											className="mr-6 h-8 w-36"
											height={32}
											src={brand.image}
											width={144}
										/>
									</div>
								))}
							</Marquee>
						</div>
					)}
				</motion.div>
				<div className="absolute z-0 flex justify-center">
					<ParticleSphereAnimation />
					<div className="pointer-events-none absolute inset-0 bg-linear-to-b from-background/50 via-transparent to-background" />
				</div>
			</motion.div>
		</section>
	);
};

export default HeroSection;
