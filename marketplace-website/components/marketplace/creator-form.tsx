"use client";

import { useState } from "react";
import { Info } from "lucide-react";

/**
 * Creator application surface. It intentionally does not submit anywhere: the
 * application pipeline is not open yet, and nothing here should imply that an
 * application has been received, reviewed, or approved.
 */
export function CreatorForm() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <form
      className="panel panel-pad"
      style={{ display: "grid", gap: 18 }}
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
      }}
    >
      <div className="field">
        <label htmlFor="project-name">Project / collection name</label>
        <input id="project-name" className="input" placeholder="e.g. Atelier" required />
      </div>

      <div className="field">
        <label htmlFor="project-standard">Asset standard</label>
        <select id="project-standard" className="select" defaultValue="metaplex-core">
          <option value="metaplex-core">Metaplex Core</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="project-address">Collection address (optional)</label>
        <input
          id="project-address"
          className="input"
          placeholder="Solana collection address"
          autoComplete="off"
        />
      </div>

      <div className="field">
        <label htmlFor="project-note">What are you building?</label>
        <textarea
          id="project-note"
          className="input"
          style={{ height: 120, padding: 14, resize: "vertical" }}
          placeholder="Tell us about your project."
        />
      </div>

      <div className="notice">
        <Info size={16} style={{ flex: "none", marginTop: 1 }} />
        <span>
          Creator applications are not open yet. This form does not submit or
          process anything, and no application is created, reviewed, or
          approved.
        </span>
      </div>

      {submitted && (
        <div className="notice warn" role="status">
          <Info size={16} style={{ flex: "none", marginTop: 1 }} />
          <span>
            Nothing was sent. Applications are not being accepted at this time —
            follow platform announcements for the opening.
          </span>
        </div>
      )}

      <button className="btn btn-primary btn-lg" type="submit">
        Request onboarding (not yet open)
      </button>
    </form>
  );
}
