import DefaultLayout from '@/components/layout/DefaultLayout';

/**
 * The default layout for the application.
 *
 * `(app)` is a route group, so it adds **no URL segment** — `(app)/admin/users`
 * still serves `/admin/users`. Its only job is to scope the chrome: everything
 * inside gets the sidebar and header, and `/sign-in` sits outside it so the
 * sign-in page stays full-bleed with no navigation to a signed-out visitor.
 *
 * Add new pages here by default. Put a route outside this group only when it
 * genuinely should render without the app chrome.
 */
export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return <DefaultLayout>{children}</DefaultLayout>;
}
