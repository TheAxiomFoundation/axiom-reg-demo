import Link from 'next/link';

import SizeChecker from '@/components/SizeChecker';

export default function Page() {
  return (
    <div className="wrap">
      <header className="site">
        <span className="brand">
          <a href="https://axiom-foundation.org" aria-label="Axiom Foundation">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/gallery/reg-demo/logos/axiom-foundation.svg" alt="Axiom Foundation" />
          </a>
          <Link href="/" className="brand-title">
            <span className="brand-name">Small company checker</span>
          </Link>
        </span>
        <a href="https://axiom.org/demos" className="all-demos">
          All demos
        </a>
      </header>

      <section className="hero">
        <h1>Small company checker</h1>
        <p className="lede">
          Section 382 of the Companies Act 2006, running as code — every threshold cited to the statute, every answer
          computed in your browser from the Axiom encoding.
        </p>
      </section>

      <SizeChecker />

      <footer className="site">
        <span>
          Encoding: <a href="https://app.axiom-foundation.org/uk/statute/ukpga/2006/46/382">ukpga/2006/46/382</a> ·
          rulespec-uk
        </span>
        <span className="priv">Runs entirely in your browser — nothing you enter leaves the page.</span>
      </footer>
    </div>
  );
}
