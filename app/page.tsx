import SizeChecker from '@/components/SizeChecker';

export default function Page() {
  return (
    <div className="wrap">
      <header className="site">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/reg-demo/logos/axiom-foundation.svg" alt="Axiom Foundation" />
        <span className="site-tag">UK regulation · computed</span>
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
