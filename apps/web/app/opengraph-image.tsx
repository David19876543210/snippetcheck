import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "snippetcheck — Your docs still show the old API.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#16181D";
const PAGE = "#E4E2DD";
const PAPER = "#FFFFFF";
const ERROR = "#C8321E";
const RULE = "#B8B4AC";

// Same path data as public/snippetcheck-mark.svg, with currentColor resolved to
// INK — a data-URI <img> in an OG image has no ancestor `color` to inherit from.
const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" fill="none">
  <g stroke="${INK}" stroke-width="7" stroke-linecap="round">
    <path d="M11 16 H45"/>
    <path d="M11 31 H37"/>
  </g>
  <path d="M11 46 q4.25 -6 8.5 0 t8.5 0 t8.5 0 t8.5 0" stroke="${ERROR}" stroke-width="7" stroke-linecap="round" fill="none"/>
</svg>`;
const MARK_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(MARK_SVG).toString("base64")}`;

// Real, literal output from `snippetcheck check https://ai-sdk.dev/llms-full.txt
// --package ai`, a subset of what's published in packages/cli/README.md and
// verified in packages/cli/test/fixtures/ai-sdk-verified.md. Nothing here is
// hand-written diagnostic text.
const FINDINGS = [
  { section: "Example", line: "L12896", kind: "removed-export", symbol: "AssistantResponse", suggestion: null },
  {
    section: "Usage Information",
    line: "L10636",
    kind: "renamed-property",
    symbol: ".toDataStreamResponse",
    suggestion: ".toTextStreamResponse",
  },
  {
    section: "Guardrails",
    line: "L9282",
    kind: "renamed-export",
    symbol: "LanguageModelV1Middleware",
    suggestion: "LanguageModelMiddleware",
  },
];

export default async function Image() {
  const [regular, bold] = await Promise.all([
    readFile(join(process.cwd(), "app/fonts/JetBrainsMono-Regular.ttf")),
    readFile(join(process.cwd(), "app/fonts/JetBrainsMono-Bold.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: PAGE,
          padding: "56px 64px",
          fontFamily: "JetBrains Mono",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 36 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MARK_DATA_URI} width={40} height={40} alt="" />
          <span style={{ marginLeft: 16, fontSize: 30, fontWeight: 600, color: INK, letterSpacing: -0.6 }}>
            snippetcheck
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            backgroundColor: PAPER,
            border: `1px solid ${RULE}`,
            borderRadius: 8,
            padding: "32px 40px",
            fontSize: 21,
            lineHeight: 1.5,
          }}
        >
          {FINDINGS.map((f) => (
            <div key={f.line} style={{ display: "flex", flexDirection: "column", marginBottom: 14 }}>
              <span style={{ color: INK, fontWeight: 600 }}>{f.section}</span>
              <div style={{ display: "flex" }}>
                <span style={{ color: INK, opacity: 0.55, width: 100 }}>{f.line}</span>
                <span style={{ color: ERROR, width: 220 }}>{f.kind}</span>
                <span style={{ color: INK }}>{f.symbol}</span>
              </div>
              {f.suggestion && (
                <div style={{ display: "flex" }}>
                  <span style={{ width: 320 }} />
                  <span style={{ color: INK, opacity: 0.7 }}>TypeScript suggests: {f.suggestion}</span>
                </div>
              )}
            </div>
          ))}

          <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
            <span style={{ color: ERROR, fontWeight: 600 }}>19 broken samples in 1 document.</span>
            <span style={{ color: INK, opacity: 0.7 }}>Checked 272 TypeScript samples against ai@7.0.66.</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "JetBrains Mono", data: regular, weight: 400, style: "normal" },
        { name: "JetBrains Mono", data: bold, weight: 600, style: "normal" },
      ],
    },
  );
}
