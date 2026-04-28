export default function RefundPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="text-5xl font-black">Refund and cancellation policy</h1>
      <div className="mt-6 space-y-6 leading-8 text-pearl/72">
        <p>
          Paid AutoAgentX plans renew monthly until cancelled. You can manage or cancel your subscription from the billing section of your account.
        </p>
        <p>
          If a billing mistake happens, or a subscription is charged after a cancellation issue, contact support as soon as possible at support@autoagentx.com. We review refund requests manually and keep an audit log for billing adjustments.
        </p>
        <p>
          Credits consumed by successfully accepted jobs are normally non-refundable. If a job fails before producing a usable result, the system is designed to return the reserved credit once.
        </p>
        <p>
          Refunds for abuse, chargeback risk, or clear policy violations may be denied. We may also suspend accounts while investigating repeated payment abuse or suspicious refund patterns.
        </p>
      </div>
    </main>
  );
}
