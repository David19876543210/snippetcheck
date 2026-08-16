export default function Mockup() {
  return (
    <div className="mockup" aria-hidden="true">
      <span className="keyword">import</span> {"{ "}
      <span className="squiggle squiggle--1">StreamData</span>
      {", streamText }"} <span className="keyword">from</span> &quot;ai&quot;;
      <br />
      <br />
      <span className="keyword">export</span> <span className="keyword">async</span>{" "}
      <span className="keyword">function</span> POST(req: Request) {"{"}
      <br />
      &nbsp;&nbsp;<span className="keyword">const</span> data = <span className="keyword">new</span> StreamData();
      <br />
      <br />
      &nbsp;&nbsp;<span className="keyword">const</span> result = <span className="keyword">await</span> streamText({"{"}
      <br />
      &nbsp;&nbsp;&nbsp;&nbsp;model: &quot;gpt-4o&quot;,
      <br />
      &nbsp;&nbsp;&nbsp;&nbsp;prompt: &quot;Plan a trip to Lisbon.&quot;,
      <br />
      &nbsp;&nbsp;{"});"}
      <br />
      <br />
      &nbsp;&nbsp;<span className="keyword">return</span> result.
      <span className="squiggle squiggle--2">toDataStreamResponse</span>({"{ data }"});
      <br />
      {"}"}
      <div className="tooltip tooltip--1">
        <span>TS2305:</span> Module &quot;ai&quot; has no exported member &apos;StreamData&apos;.
      </div>
      <div className="tooltip tooltip--2">
        <span>TS2551:</span> Property &apos;toDataStreamResponse&apos; does not exist on type
        &apos;StreamTextResult&lt;ToolSet, Context, Output&lt;string, string, never&gt;&gt;&apos;. Did you mean
        &apos;toTextStreamResponse&apos;?
      </div>
    </div>
  );
}
