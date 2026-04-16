"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { Marquee } from "@/components/shadcn-space/animations/marquee";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const reviews = [
	{
		id: "ex-1",
		name: "Example: marketplace team",
		username: "Shipping flows",
		body: "“We wired address autocomplete and checkout validation in an afternoon—no embedded map SDK, just HTTP from our API route.”",
		profile: "https://images.shadcnspace.com/assets/profiles/rough.webp",
		socialMedia: "https://images.shadcnspace.com/assets/svgs/icon-google.svg",
	},
	{
		id: "ex-2",
		name: "Example: B2B onboarding",
		username: "Geocoding signups",
		body: "“Clear errors and versioning meant we weren’t guessing why a place lookup failed in staging vs production.”",
		profile: "https://images.shadcnspace.com/assets/profiles/albert.webp",
		socialMedia: "https://images.shadcnspace.com/assets/svgs/icon-reddit.svg",
	},
	{
		id: "ex-3",
		name: "Example: logistics dashboard",
		username: "Predictable usage",
		body: "“We could forecast query volume for finance instead of bracing for a surprise bill after a traffic spike.”",
		profile: "https://images.shadcnspace.com/assets/profiles/linda.webp",
		socialMedia:
			"https://images.shadcnspace.com/assets/svgs/icon-trustpilot.svg",
	},
	{
		id: "ex-4",
		name: "Example: mobile app",
		username: "Search UX",
		body: "Place search felt native in the app—fast suggestions without pulling in a full maps client just to validate a venue.",
		profile: "https://images.shadcnspace.com/assets/profiles/jessica.webp",
		socialMedia:
			"https://images.shadcnspace.com/assets/svgs/icon-trustpilot.svg",
	},
	{
		id: "ex-5",
		name: "Example: ops tooling",
		username: "Internal tools",
		body: "“Docs matched what the API returned; we spent time on product logic, not reverse-engineering responses.”",
		profile: "https://images.shadcnspace.com/assets/profiles/jenny.webp",
		socialMedia: "https://images.shadcnspace.com/assets/svgs/icon-google.svg",
	},
	{
		id: "ex-6",
		name: "Example: early builder",
		username: "Time to first request",
		body: "“From API key to a successful geocode was minutes, not days of SDK and console setup.”",
		profile: "https://images.shadcnspace.com/assets/profiles/albert.webp",
		socialMedia: "https://images.shadcnspace.com/assets/svgs/icon-reddit.svg",
	},
	{
		id: "ex-7",
		name: "Example: multi-region",
		username: "Coverage checks",
		body: "“We validated regions against the docs before launch instead of discovering gaps in production.”",
		profile: "https://images.shadcnspace.com/assets/profiles/rough.webp",
		socialMedia: "https://images.shadcnspace.com/assets/svgs/icon-google.svg",
	},
];

const firstRow = reviews.slice(0, reviews.length / 2);
const secondRow = reviews.slice(reviews.length / 2);
const thirdRow = reviews.slice(0, reviews.length / 2);

const ReviewCard = ({
	profile,
	name,
	username,
	body,
	socialMedia,
}: {
	profile: string;
	name: string;
	username: string;
	body: string;
	socialMedia: string;
}) => {
	return (
		<Card className="border p-6 shadow-none ring-0">
			<CardContent className="flex flex-col gap-4 p-0">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<img
							alt={name}
							className="rounded-full"
							height={48}
							src={profile}
							width={48}
						/>
						<div>
							<p className="font-medium text-base">{name}</p>
							<p className="text-muted-foreground text-sm">{username}</p>
						</div>
					</div>
					<img alt="" height={24} src={socialMedia} width={24} />
				</div>
				<Separator />
				<p className="text-foreground text-lg">{body}</p>
			</CardContent>
		</Card>
	);
};

export default function Testimonial() {
	const sectionRef = useRef<HTMLElement>(null);
	const isInView = useInView(sectionRef, { once: true, amount: 0.1 });

	/* ---------------- variants ---------------- */

	const containerVariants = {
		hidden: { opacity: 0 },
		visible: {
			opacity: 1,
			transition: {
				staggerChildren: 0.15,
			},
		},
	};

	const itemVariants = {
		hidden: { opacity: 0, y: 40 },
		visible: {
			opacity: 1,
			y: 0,
			transition: {
				duration: 0.8,
				ease: [0.21, 0.47, 0.32, 0.98] as [number, number, number, number],
			},
		},
	};

	/* ---------------- render ---------------- */

	return (
		<section className="py-10" id="developers" ref={sectionRef}>
			<div className="mx-auto w-full max-w-7xl px-4 lg:px-8 xl:px-16">
				<motion.div
					animate={isInView ? "visible" : "hidden"}
					className="flex flex-col gap-8 sm:gap-12"
					initial="hidden"
					variants={containerVariants}
				>
					{/* Header */}
					<div className="flex flex-col items-center justify-center gap-4">
						<motion.div variants={itemVariants}>
							<Badge
								className="h-7 px-3 py-1 font-normal text-sm"
								variant="outline"
							>
								Example outcomes
							</Badge>
						</motion.div>
						<div className="flex flex-col items-center gap-3">
							<motion.h2
								className="text-center font-medium text-3xl sm:text-4xl lg:text-5xl"
								variants={itemVariants}
							>
								What shipping location can feel like
							</motion.h2>
							<motion.p
								className="max-w-xs text-center text-lg text-muted-foreground sm:max-w-2xl sm:text-xl"
								variants={itemVariants}
							>
								Illustrative scenarios for product teams—not paid endorsements.
								Your integration and regions may differ; confirm details in the
								docs.
							</motion.p>
						</div>
					</div>
					<motion.div
						className="relative flex h-full max-h-96 w-full flex-row items-center justify-center gap-6 overflow-hidden"
						variants={itemVariants}
					>
						<div className="flex flex-row items-center gap-5">
							<Marquee
								className="p-0 [--duration:20s] [--gap:1.25rem]"
								pauseOnHover
								vertical
							>
								{firstRow.map(({ id, ...review }) => (
									<ReviewCard key={id} {...review} />
								))}
							</Marquee>
							<Marquee
								className="hidden p-0 [--duration:20s] [--gap:1.25rem] sm:flex"
								pauseOnHover
								reverse
								vertical
							>
								{secondRow.map(({ id, ...review }) => (
									<ReviewCard key={id} {...review} />
								))}
							</Marquee>
							<Marquee
								className="hidden p-0 [--duration:20s] [--gap:1.25rem] lg:flex"
								pauseOnHover
								vertical
							>
								{thirdRow.map(({ id, ...review }) => (
									<ReviewCard key={id} {...review} />
								))}
							</Marquee>
						</div>
						<div className="pointer-events-none absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-background" />
						<div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-background" />
					</motion.div>
				</motion.div>
			</div>
		</section>
	);
}
