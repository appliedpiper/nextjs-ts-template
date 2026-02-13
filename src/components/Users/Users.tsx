"use client";

import { useUsers } from "@/lib/api/users/hooks";

export function Users() {
  const { data, isLoading, error } = useUsers();
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading users</div>;
  if(!data?.users.length) return <div>No users found</div>;

  return (
    <ul>
      {data.users.map(user => (
        <li key={user._id}>
          <strong>{user.firstName} {user.lastName}</strong>: {user.email}
        </li>
      ))}
    </ul>
  );
}