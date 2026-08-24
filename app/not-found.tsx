import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-bg-tertiary px-4">
      <div className="text-center">
        <p className="text-7xl font-bold text-accent/30 m-0 select-none">404</p>
        <h1 className="text-xl font-semibold mt-2">Page not found</h1>
        <p className="text-text-muted text-sm mt-1.5">
          The page you&rsquo;re looking for doesn&rsquo;t exist or you don&rsquo;t have access to it.
        </p>
        <Link
          href="/"
          className="btn-primary inline-block mt-5 px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
