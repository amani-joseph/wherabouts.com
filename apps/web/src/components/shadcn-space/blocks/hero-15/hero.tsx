"use client";
import { ArrowRight } from "lucide-react";
import { motion, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Marquee } from "@/components/shadcn-space/animations/marquee";
import ParticleSphereAnimation from "@/components/shadcn-space/blocks/hero-15/particalsphear";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const DEMO_ADDRESSES = [
	"1600 Amphitheatre Pkwy, Mountain View, CA",
	"350 Fifth Ave, New York, NY 10118",
	"10 Downing St, London SW1A 2AA",
	"1-1 Marunouchi, Chiyoda City, Tokyo",
] as const;

const TYPE_MS = 48;
const DELETE_MS = 36;
const PAUSE_FULL_MS = 2200;
const PAUSE_EMPTY_MS = 600;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

async function typeDemoAddress(
	full: string,
	setValue: (v: string) => void,
	isCancelled: () => boolean
): Promise<void> {
	for (let c = 0; c <= full.length && !isCancelled(); c += 1) {
		setValue(full.slice(0, c));
		await sleep(TYPE_MS);
	}
}

async function eraseDemoAddress(
	full: string,
	setValue: (v: string) => void,
	isCancelled: () => boolean
): Promise<void> {
	for (let c = full.length; c >= 0 && !isCancelled(); c -= 1) {
		setValue(full.slice(0, c));
		await sleep(DELETE_MS);
	}
}

function AddressDemoInput() {
	const [value, setValue] = useState("");

	useEffect(() => {
		let cancelled = false;
		const isCancelled = () => cancelled;
		let addressIndex = 0;

		const task = async () => {
			while (!isCancelled()) {
				const full = DEMO_ADDRESSES[addressIndex % DEMO_ADDRESSES.length];
				addressIndex += 1;
				await typeDemoAddress(full, setValue, isCancelled);
				if (isCancelled()) {
					break;
				}
				await sleep(PAUSE_FULL_MS);
				await eraseDemoAddress(full, setValue, isCancelled);
				if (isCancelled()) {
					break;
				}
				await sleep(PAUSE_EMPTY_MS);
			}
		};

		task().catch(() => {
			// demo loop stopped on unmount; ignore
		});
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<div className="mx-auto w-full max-w-md">
			<Input
				aria-label="Example address autocomplete"
				className="h-11 rounded-full border-border/80 bg-background/80 px-4 text-left text-sm shadow-sm backdrop-blur-sm md:h-12 md:text-base"
				readOnly
				tabIndex={-1}
				value={value}
			/>
		</div>
	);
}

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
					<motion.div className="w-full max-w-xl" variants={itemVariants}>
						<AddressDemoInput />
					</motion.div>
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
