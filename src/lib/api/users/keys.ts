export const userKeys = {
    root: ["users"] as const,
    all: () => [...userKeys.root] as const,
    byId: (id: string) => [...userKeys.root, id] as const,
}