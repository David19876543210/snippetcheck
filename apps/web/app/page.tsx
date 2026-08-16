import Mockup from "../components/Mockup";
import ReportForm from "../components/ReportForm";

const FINDING_KINDS = [
  {
    title: "Removed Exports",
    comment: "// TS2305: Module '\"pkg\"' has no exported member...",
    code: 'import { Experimental_Agent } from "pkg";',
  },
  {
    title: "Renamed Exports",
    comment: "// TS2724: Did you mean 'NewName'?",
    code: 'import { OldName } from "pkg";',
  },
  {
    title: "Removed Properties",
    comment: "// TS2339: Property 'legacyMode' does not exist...",
    code: "client.legacyMode = true;",
  },
  {
    title: "Renamed Properties",
    comment: "// TS2551: Did you mean 'stopWhen'?",
    code: "const result = { maxSteps: 5 };",
  },
  {
    title: "Unknown Options",
    comment: "// TS2353: Object literal may only specify known...",
    code: "init({ unrecognisedFlag: true });",
  },
  {
    title: "Wrong Arity",
    comment: "// TS2554: Expected 1 argument, but got 2.",
    code: "client.connect(url, options);",
  },
];

export default function Home() {
  return (
    <div className="container">
      <header className="site-header">
        <p className="wordmark mono">
          <a href="/">snippetcheck</a>
        </p>
      </header>

      <header className="hero">
        <div>
          <h1>
            Your docs still show
            <br />
            the old API.
          </h1>
          <p>
            Snippetcheck compiles every TypeScript sample in your documentation against the version you actually
            publish, and tells you which ones no longer work.
          </p>

          <ReportForm idPrefix="hero" />
          <p className="form-helper">
            We run it against your public docs and email you the broken samples. No account, nothing to install.
          </p>
        </div>

        <Mockup />
      </header>

      <section className="section">
        <h2>What it checks</h2>
        <div className="grid-2">
          {FINDING_KINDS.map((kind) => (
            <div className="finding-item" key={kind.title}>
              <h3 className="mono">{kind.title}</h3>
              <pre>
                <span className="comment">{kind.comment}</span>
                {"\n"}
                {kind.code}
              </pre>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>What it will not tell you</h2>
        <ul className="limits">
          <li>
            <strong>We do not execute your code.</strong> Snippetcheck never runs the samples. It strictly
            type-checks them against your package&apos;s published <code>.d.ts</code> declarations.
          </li>
          <li>
            <strong>We skip what we cannot parse.</strong> Documentation is full of{" "}
            <code>&lt;YOUR_API_KEY&gt;</code> placeholders and <code>...</code> elisions. If it isn&apos;t valid
            syntax, we skip it and count it in the final report tally.
          </li>
          <li>
            <strong>We only report provable failures.</strong> We discard noise. We do not flag undeclared variables
            or missing peer dependencies. Every finding we report is traced directly back to your published
            declarations.
          </li>
        </ul>
      </section>

      <section className="section cta-section">
        <h2>Get your report</h2>
        <ReportForm idPrefix="cta" />
      </section>

      <footer className="site-footer">
        <span>snippetcheck</span>
        <a href="https://github.com/snippetcheck/snippetcheck">GitHub</a>
      </footer>
    </div>
  );
}
