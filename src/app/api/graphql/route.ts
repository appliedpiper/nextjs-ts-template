import { getServerEnv } from "@/lib/env/server";

export async function POST(request: Request) {
  // For demonstration, return the GraphQL server URL from the environment variables
  const { GRAPHQL_SERVER } = getServerEnv();

  const body = await request.json();
  console.log("Received GraphQL request:", body);

  const reponse = await fetch(GRAPHQL_SERVER, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await reponse.json();

  return new Response(JSON.stringify(data), {
    status: reponse.status,
    headers: { "Content-Type": "application/json" },
  });
}