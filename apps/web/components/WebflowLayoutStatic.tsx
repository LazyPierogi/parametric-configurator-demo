"use client";

interface WebflowLayoutStaticProps {
  children: React.ReactNode;
}

export default function WebflowLayoutStatic({ children }: WebflowLayoutStaticProps) {
  return (
    <>
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="font-semibold">Parametric Configurator Demo</div>
          <a
            className="text-sm text-neutral-700 underline underline-offset-4 hover:text-neutral-900"
            href="https://example.com"
            target="_blank"
            rel="noreferrer"
          >
            Example storefront
          </a>
        </div>
      </header>

      <main style={{ minHeight: "60vh" }}>{children}</main>

      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-neutral-600">
          Replace this header/footer with your own storefront chrome (Webflow/Shopify/Magento) when embedding.
        </div>
      </footer>
    </>
  );
}

