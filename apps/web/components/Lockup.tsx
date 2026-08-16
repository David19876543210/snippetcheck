// Inline (not <img src="...">) so the wordmark inherits the page's own loaded
// JetBrains Mono font via CSS custom property — an externally-loaded SVG document
// has no access to the host page's @font-face registrations, so this is the only
// way to get pixel-identical rendering without outlining the text to paths.
export default function Lockup({ height = 28 }: { height?: number }) {
  const width = (height / 64) * 300;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 300 64"
      width={width}
      height={height}
      fill="none"
      role="img"
      aria-label="snippetcheck"
    >
      <title>snippetcheck</title>

      <g stroke="currentColor" strokeWidth="7" strokeLinecap="round">
        <path d="M11 16 H45" />
        <path d="M11 31 H37" />
      </g>
      <path
        d="M11 46 q4.25 -6 8.5 0 t8.5 0 t8.5 0 t8.5 0"
        stroke="#C8321E"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />

      <text
        x="72"
        y="41"
        style={{ fontFamily: "var(--font-jetbrains-mono), monospace" }}
        fontSize="27"
        fontWeight="600"
        letterSpacing="-0.6"
        fill="currentColor"
      >
        snippetcheck
      </text>
    </svg>
  );
}
