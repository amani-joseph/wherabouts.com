// Run with: node apps/server/test-social-signin.mjs
const response = await fetch(
	"https://wherabouts-server.mr-amanijoseph.workers.dev/api/auth/sign-in/social",
	{
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Origin: "https://wherabouts-web.mr-amanijoseph.workers.dev",
		},
		body: JSON.stringify({ provider: "github", callbackURL: "/dashboard" }),
	}
);

console.log("Status:", response.status);
console.log(
	"Headers:",
	JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)
);
const text = await response.text();
console.log("Body:", text);
