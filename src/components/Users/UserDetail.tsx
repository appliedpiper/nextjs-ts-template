"use client";

import { useUser } from "@/lib/api/users/hooks";

export default function UserDetail({ id }: { id: string }) {
  const { data, isLoading, error } = useUser(id);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading user</div>;

  if (!data?.user) return <div>User not found</div>;

  return (
    <div>
      <h2>
        {data.user.firstName} {data.user.lastName}
      </h2>
      <p>{data.user.email}</p>
    </div>
  );
}