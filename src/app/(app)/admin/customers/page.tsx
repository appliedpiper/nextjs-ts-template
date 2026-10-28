// Customer records from MongoDB, via the GraphQL API.
//
// The component and hook are still named `Users` because the backend GraphQL
// type is `User` — renaming those means changing the published contract
// package, which is out of scope here. The *route* is named for what these
// records actually are, so it stops being mistaken for Clerk account
// management. Role assignment lives at `/admin/access`.
import { Users } from "@/components/Users/Users";

export default function Page() {
  return (
    <div>
      <h1>Customers</h1>
      <Users />
    </div>
  );
}
