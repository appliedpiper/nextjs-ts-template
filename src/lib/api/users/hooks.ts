"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchUsers, fetchUserById } from "@/lib/api/users/queries";
import { userKeys } from "./keys";

export function useUsers() {
  return useQuery({
    queryKey: userKeys.all(),
    queryFn: fetchUsers,
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: userKeys.byId(id),
    queryFn: () => fetchUserById(id),
    enabled: !!id, // Only run the query if an ID is provided
  });
}