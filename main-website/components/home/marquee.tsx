import { Fragment } from "react";

const WORDS = ["Identity", "Community", "Ownership", "Culture"];

function Sequence() {
  return (
    <>
      {WORDS.map((word) => (
        <Fragment key={word}>
          <span className="marquee-item">{word}</span>
          <span className="marquee-dot" />
        </Fragment>
      ))}
    </>
  );
}

/** Quiet editorial divider between the statement and the identity sections. */
export default function Marquee() {
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        <Sequence />
        <Sequence />
      </div>
    </div>
  );
}
