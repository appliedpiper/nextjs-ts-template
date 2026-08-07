// TypeScript 6 reports TS2882 for side-effect imports without declarations, and
// Next.js 16.1.6 does not ship one for global CSS imports. Without this,
// `import "./globals.css"` fails the build's type check.
declare module '*.css';
