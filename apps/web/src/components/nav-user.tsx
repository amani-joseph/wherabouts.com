"use client";

import { useClerk, useUser } from "@clerk/tanstack-react-start";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@wherabouts.com/ui/components/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@wherabouts.com/ui/components/dropdown-menu";
import {
	CreditCardIcon,
	LogOutIcon,
	SettingsIcon,
	UserIcon,
} from "lucide-react";

export function NavUser() {
	const { user } = useUser();
	const { signOut } = useClerk();

	const name = user?.fullName ?? "User";
	const email = user?.primaryEmailAddress?.emailAddress ?? "";
	const avatarUrl = user?.imageUrl ?? "";
	const initials = name.charAt(0).toUpperCase();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Avatar className="size-8" />}>
				<AvatarImage src={avatarUrl} />
				<AvatarFallback>{initials}</AvatarFallback>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-60">
				<DropdownMenuItem className="flex items-center justify-start gap-2">
					<DropdownMenuLabel className="flex items-center gap-3">
						<Avatar className="size-10">
							<AvatarImage src={avatarUrl} />
							<AvatarFallback>{initials}</AvatarFallback>
						</Avatar>
						<div>
							<span className="font-medium text-foreground">{name}</span> <br />
							<div className="max-w-full overflow-hidden overflow-ellipsis whitespace-nowrap text-muted-foreground text-xs">
								{email}
							</div>
						</div>
					</DropdownMenuLabel>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem>
						<UserIcon />
						Account
					</DropdownMenuItem>
					<DropdownMenuItem>
						<SettingsIcon />
						Settings
					</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem>
						<CreditCardIcon />
						Plan & Billing
					</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem
						className="w-full cursor-pointer"
						onClick={() => signOut({ redirectUrl: "/" })}
						variant="destructive"
					>
						<LogOutIcon />
						Log out
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
