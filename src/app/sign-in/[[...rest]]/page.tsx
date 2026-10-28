import SignInPanel from "@/components/auth/SignInPanel";

// Server component; the MUI/Clerk styling lives in the client component so
// `useTheme()` can read the live theme.
//
// **Must stay a catch-all (`[[...rest]]`).** Clerk's <SignIn /> uses path-based
// routing by default and serves its own sub-routes — factor-one, sso-callback,
// forgot-password — beneath /sign-in. As a plain `sign-in/page.tsx` it renders
// the error "The <SignIn/> component is not configured correctly". The optional
// catch-all still serves `/sign-in` itself, so `SIGN_IN_PATH` is unchanged.
//
// The alternative is `routing="hash"` on <SignIn />, but path routing is what
// keeps those sub-routes real URLs, which is why Clerk's widget is used here
// rather than rebuilt — see SignInPanel.
//
// `PUBLIC_PATHS` in `src/lib/auth/access.ts` already matches the whole
// `/sign-in` subtree, so the proxy does not block the sub-routes.
export default function Page() {
  return <SignInPanel />;
}
