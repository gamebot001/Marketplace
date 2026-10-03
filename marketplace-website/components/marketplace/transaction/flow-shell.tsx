"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X, ExternalLink, Check, AlertTriangle, Loader2 } from "lucide-react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import type { Connection } from "@solana/web3.js";
import { explorerTxUrl } from "@/lib/solana/cluster";
import {
  TransactionFailedError,
  TransactionRejectedError,
  type WalletSender,
} from "@/lib/solana/solana-confirmation";
import { useWalletDialog } from "@/components/wallet/wallet-provider";

export type FlowState = "review" | "submitting" | "success" | "error";

export interface FlowRow {
  k: ReactNode;
  v: ReactNode;
  total?: boolean;
}

export interface TransactionFlowProps {
  title: string;
  summary: ReactNode;
  rows: FlowRow[];
  confirmLabel: string;
  /** When false, the action cannot be submitted on-chain (honest gate). */
  programReady: boolean;
  /** Extra client-side gate (e.g. invalid price). */
  confirmDisabled?: boolean;
  /** Optional interactive content rendered above the review rows. */
  reviewContent?: ReactNode;
  unavailableMessage: string;
  onConfirm: (sender: WalletSender, connection: Connection) => Promise<string>;
  onClose: () => void;
  /** Called after a successful confirmation, before closing. */
  onConfirmed?: () => void;
}

/**
 * The shared transaction state machine:
 *   review → (wallet) → submitting → success | error
 *
 * Success is only ever shown after a real, confirmed signature is returned by
 * the transaction service. A rejected prompt and an on-chain failure render as
 * distinct, truthful error states.
 */
export function TransactionFlow({
  title,
  summary,
  rows,
  confirmLabel,
  programReady,
  confirmDisabled = false,
  reviewContent,
  unavailableMessage,
  onConfirm,
  onClose,
  onConfirmed,
}: TransactionFlowProps) {
  const { connection } = useConnection();
  const { connected, sendTransaction, publicKey } = useWallet();
  const { open: openWallet } = useWalletDialog();

  const [state, setState] = useState<FlowState>("review");
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && state !== "submitting") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, state]);

  const submit = async () => {
    if (!connected || !publicKey) {
      openWallet();
      return;
    }
    setError(null);
    setState("submitting");
    try {
      const sender: WalletSender = {
        publicKey,
        sendTransaction: (tx, conn, options) =>
          sendTransaction(tx, conn, options),
      };
      const sig = await onConfirm(sender, connection);
      setSignature(sig);
      setState("success");
      onConfirmed?.();
    } catch (e) {
      if (e instanceof TransactionRejectedError) {
        setError(e.message);
      } else if (e instanceof TransactionFailedError) {
        if (e.signature) setSignature(e.signature);
        setError(e.message);
      } else {
        setError(
          e instanceof Error ? e.message : "The transaction could not be completed."
        );
      }
      setState("error");
    }
  };

  const stepState = (step: FlowState): "active" | "done" | "error" | "idle" => {
    const order: FlowState[] = ["review", "submitting", "success"];
    if (state === "error") {
      return step === "review" ? "done" : step === "submitting" ? "error" : "idle";
    }
    const currentIndex = order.indexOf(state);
    const stepIndex = order.indexOf(step);
    if (stepIndex < currentIndex) return "done";
    if (stepIndex === currentIndex) return "active";
    return "idle";
  };

  return (
    <div
      className="overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && state !== "submitting") onClose();
      }}
    >
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="tx-title">
        <div className="dialog-head">
          <h2 id="tx-title">{title}</h2>
          <button
            className="icon-btn"
            onClick={onClose}
            aria-label="Close"
            disabled={state === "submitting"}
          >
            <X size={16} />
          </button>
        </div>

        <div className="dialog-body">
          {summary}

          {state === "success" ? (
            <div style={{ display: "grid", gap: 16, marginTop: 18 }}>
              <div className="notice success">
                <Check size={16} style={{ flex: "none", marginTop: 1 }} />
                <span>Transaction confirmed on Solana Devnet.</span>
              </div>
              {signature && (
                <>
                  <div className="tx-hash">{signature}</div>
                  <a
                    className="btn btn-outline"
                    href={explorerTxUrl(signature)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on Explorer <ExternalLink size={14} />
                  </a>
                </>
              )}
            </div>
          ) : state === "error" ? (
            <div style={{ display: "grid", gap: 16, marginTop: 18 }}>
              <div className="notice error" role="alert">
                <AlertTriangle size={16} style={{ flex: "none", marginTop: 1 }} />
                <span>{error}</span>
              </div>
              {signature && (
                <a
                  className="btn btn-outline btn-sm"
                  href={explorerTxUrl(signature)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Inspect transaction <ExternalLink size={13} />
                </a>
              )}
            </div>
          ) : (
            <>
              <div className="tx-steps" aria-hidden={state !== "review"}>
                <div className="tx-step" data-state={stepState("review")}>
                  <span className="bullet">1</span> Review
                </div>
                <div className="tx-step" data-state={stepState("submitting")}>
                  <span className="bullet">
                    {state === "submitting" ? (
                      <Loader2 size={11} className="spin" />
                    ) : (
                      "2"
                    )}
                  </span>
                  Approve in wallet &amp; submit
                </div>
                <div className="tx-step" data-state={stepState("success")}>
                  <span className="bullet">3</span> Confirmed on-chain
                </div>
              </div>

              {reviewContent && <div style={{ marginBottom: 18 }}>{reviewContent}</div>}

              <dl style={{ margin: 0 }}>
                {rows.map((row, i) => (
                  <div className={`review-row${row.total ? " total" : ""}`} key={i}>
                    <dt className="k">{row.k}</dt>
                    <dd className="v">{row.v}</dd>
                  </div>
                ))}
              </dl>

              {!programReady && (
                <div className="notice warn" style={{ marginTop: 18 }}>
                  <AlertTriangle size={16} style={{ flex: "none", marginTop: 1 }} />
                  <span>{unavailableMessage}</span>
                </div>
              )}

              {state === "submitting" && (
                <div className="notice" style={{ marginTop: 18 }} role="status">
                  <Loader2 size={15} className="spin" style={{ flex: "none", marginTop: 2 }} />
                  <span>
                    Waiting for confirmation. Keep this window open — you can
                    safely ignore the rest of the page.
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="dialog-foot">
          {state === "success" ? (
            <button className="btn btn-primary btn-block" onClick={onClose}>
              Done
            </button>
          ) : state === "error" ? (
            <>
              <button className="btn btn-outline" onClick={onClose}>
                Close
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={submit}
                disabled={!programReady || confirmDisabled}
              >
                Try again
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn-outline"
                onClick={onClose}
                disabled={state === "submitting"}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={submit}
                disabled={!programReady || confirmDisabled || state === "submitting"}
                title={!programReady ? unavailableMessage : undefined}
              >
                {state === "submitting" ? (
                  <>
                    <Loader2 size={15} className="spin" /> Submitting…
                  </>
                ) : connected ? (
                  confirmLabel
                ) : (
                  "Connect wallet"
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
