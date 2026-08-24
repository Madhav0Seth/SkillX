import { useEffect } from "react";

const PHASE_COPY = {
  wallet: {
    title: "Approve in your wallet",
    detail: "SkillX is waiting for your wallet signature. Keep this window open."
  },
  submitted: {
    title: "Transaction submitted",
    detail: "Your transaction is on its way to the network."
  },
  confirming: {
    title: "Confirming on-chain",
    detail: "SkillX is waiting for the network to confirm your transaction."
  }
};

export default function TransactionLoader({ transaction }) {
  useEffect(() => {
    if (!transaction) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [transaction]);

  if (!transaction) return null;

  const copy = PHASE_COPY[transaction.phase] || PHASE_COPY.wallet;
  const phaseIndex = ["wallet", "submitted", "confirming"].indexOf(transaction.phase);

  return (
    <div className="transaction-loader-overlay" role="presentation">
      <section
        className="transaction-loader-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-loader-title"
        aria-describedby="transaction-loader-detail"
      >
        <div className="transaction-loader-x" aria-hidden="true">
          <span className="transaction-loader-stroke transaction-loader-stroke-a" />
          <span className="transaction-loader-stroke transaction-loader-stroke-b" />
          <span className="transaction-loader-spark transaction-loader-spark-one" />
          <span className="transaction-loader-spark transaction-loader-spark-two" />
          <span className="transaction-loader-spark transaction-loader-spark-three" />
        </div>
        <span className="transaction-loader-kicker">SKILLX TRANSACTION</span>
        <h2 id="transaction-loader-title">{copy.title}</h2>
        <p id="transaction-loader-detail">{copy.detail}</p>
        <p className="transaction-loader-action" aria-live="polite">{transaction.action}</p>
        <ol className="transaction-loader-steps" aria-label="Transaction progress">
          {["Wallet approval", "Submitted", "On-chain confirmation"].map((label, index) => (
            <li key={label} className={index <= phaseIndex ? "is-active" : ""}>
              <span aria-hidden="true">{index < phaseIndex ? "✓" : index + 1}</span>
              {label}
            </li>
          ))}
        </ol>
        <p className="transaction-loader-note">Please do not close or refresh this page.</p>
      </section>
    </div>
  );
}
