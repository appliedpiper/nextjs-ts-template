import SignInPanel from "@/components/auth/SignInPanel";

// Server component; the MUI/Clerk styling lives in the client component so
// `useTheme()` can read the live theme.
export default function Page() {
  return <SignInPanel />;
}
