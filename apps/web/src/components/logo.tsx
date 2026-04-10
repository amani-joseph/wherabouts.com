import { cn } from "@wherabouts.com/ui/lib/utils";
import type React from "react";

const brandLogo = "/brand/logo.svg";
const brandLogoInverted = "/brand/logo-inverted.svg";
const brandLogoMark = "/brand/logo-mark.svg";

/** Matches `viewBox` of logo.svg / logo-inverted.svg for CLS. */
const BRAND_LOGO_WIDTH = 152;
const BRAND_LOGO_HEIGHT = 124;
/** Matches `viewBox` of logo-mark.svg for CLS. */
const BRAND_LOGO_MARK_WIDTH = 152;
const BRAND_LOGO_MARK_HEIGHT = 84;

type LogoProps = React.ComponentPropsWithoutRef<"span"> & {
	alt?: string;
	imgClassName?: string;
};

export function Logo({
	className,
	imgClassName,
	alt = "wherabouts",
	...spanProps
}: LogoProps) {
	const imgClass = cn("h-6 w-auto object-contain object-left", imgClassName);

	return (
		<span
			aria-label={alt}
			className={cn("inline-flex items-center", className)}
			role="img"
			{...spanProps}
		>
			{/* biome-ignore lint/performance/noImgElement: Brand SVGs live under public/brand; Vite has no next/image. */}
			<img
				alt=""
				className={cn(imgClass, "dark:hidden")}
				decoding="async"
				fetchPriority="low"
				height={BRAND_LOGO_HEIGHT}
				loading="lazy"
				src={brandLogoInverted}
				width={BRAND_LOGO_WIDTH}
			/>
			{/* biome-ignore lint/performance/noImgElement: Brand SVGs live under public/brand; Vite has no next/image. */}
			<img
				alt=""
				className={cn(imgClass, "hidden dark:block")}
				decoding="async"
				fetchPriority="low"
				height={BRAND_LOGO_HEIGHT}
				loading="lazy"
				src={brandLogo}
				width={BRAND_LOGO_WIDTH}
			/>
		</span>
	);
}

type LogoIconProps = Omit<React.ComponentPropsWithoutRef<"img">, "src">;

export function LogoIcon({ className, alt = "", ...props }: LogoIconProps) {
	return (
		// biome-ignore lint/performance/noImgElement: Brand SVGs live under public/brand; Vite has no next/image.
		<img
			alt={alt}
			className={cn(
				"h-6 w-auto shrink-0 object-contain invert dark:invert-0",
				className
			)}
			decoding="async"
			fetchPriority="low"
			height={BRAND_LOGO_MARK_HEIGHT}
			loading="lazy"
			src={brandLogoMark}
			width={BRAND_LOGO_MARK_WIDTH}
			{...props}
		/>
	);
}
