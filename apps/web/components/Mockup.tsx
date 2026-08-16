export default function Mockup() {
  return (
    <div className="mockup" aria-hidden="true">
      <span className="keyword">import</span> {"{ generateText }"} <span className="keyword">from</span> &quot;ai&quot;;
      <br />
      <br />
      <span className="keyword">const</span> result = generateText({'{'}
      <br />
      &nbsp;&nbsp;model: &quot;gpt-4&quot;,
      <br />
      &nbsp;&nbsp;
      <span className="squiggle squiggle--1">maxSteps</span>: 5,
      <br />
      {'});'}
      <br />
      <br />
      console.log(result.<span className="squiggle squiggle--2">toolResults</span>);
      <div className="tooltip tooltip--1">
        <span>TS2339:</span> Property &apos;maxSteps&apos; does not exist on type &apos;GenerateTextOptions&apos;. Did
        you mean &apos;stopWhen&apos;?
      </div>
      <div className="tooltip tooltip--2">
        <span>TS2339:</span> Property &apos;toolResults&apos; does not exist on type &apos;GenerateTextResult&apos;.
      </div>
    </div>
  );
}
