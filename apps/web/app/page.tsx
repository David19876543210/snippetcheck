import Mockup from "../components/Mockup";
import ReportForm from "../components/ReportForm";
import Lockup from "../components/Lockup";

// Every comment and code line below is real output from `snippetcheck check` run
// against `ai@latest` — see packages/cli/test/fixtures/ai-sdk-verified.md and
// landing-page-verified.md for the full verification record. The "Unknown Options"
// card is the one exception, flagged with `synthetic: true` — see the disclosure
// line rendered under the section heading below.
const FINDING_KINDS = [
  {
    title: "Removed Exports",
    comment: "// TS2305: Module \"ai\" has no exported member 'AssistantResponse'.",
    code: 'import { AssistantResponse } from "ai";',
  },
  {
    title: "Renamed Exports",
    comment: "// TS2724: Did you mean 'LanguageModelMiddleware'?",
    code: 'import type { LanguageModelV1Middleware } from "ai";',
  },
  {
    title: "Removed Properties",
    comment: "// TS2339: Property 'reasoningDetails' does not exist...",
    code: "console.log(result.reasoningDetails);",
  },
  {
    title: "Renamed Properties",
    comment: "// TS2551: Did you mean 'pipeTextStreamToResponse'?",
    code: "result.pipeDataStreamToResponse(res);",
  },
  {
    title: "Unknown Options",
    comment: "// TS2353: Object literal may only specify known properties...",
    code: 'embed({ model: "text-embedding-3-small", value: "hello", unrecognizedFlag: true });',
    synthetic: true,
  },
  {
    title: "Wrong Arity",
    comment: "// TS2554: Expected 1 arguments, but got 0.",
    code: "createUIMessageStream<MyUIMessage>(/* ... */);",
  },
];

export default function Home() {
  return (
    <div className="container">
      <header className="site-header">
        <a href="/" className="wordmark" aria-label="snippetcheck">
          <Lockup height={28} />
        </a>
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
        <p className="section-note">
          Real compiler output. Some inputs are constructed to demonstrate a check the AI SDK docs don&apos;t
          currently trip.
        </p>
        <div className="grid-2">
          {FINDING_KINDS.map((kind) => (
            <div className="finding-item" key={kind.title}>
              <h3 className="mono">
                {kind.title}
                {kind.synthetic && <span className="finding-item__tag">constructed input</span>}
              </h3>
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
        <a href="https://github.com/David19876543210/snippetcheck">GitHub</a>
      </footer>
    </div>
  );
}
