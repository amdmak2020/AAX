export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="text-5xl font-black">Privacy Policy</h1>
      <div className="mt-6 space-y-6 leading-8 text-pearl/72">
        <p>
          We store the minimum account, billing, and job data needed to run AutoAgentX: account identity, plan state, job records, upload metadata, and limited operational logs. Payment processing is handled by Gumroad.
        </p>
        <p>
          Uploaded source files and output file references are associated with your user account and are not meant to be publicly enumerable. We use cookies and related session storage only for authentication, security, and essential product behavior.
        </p>
        <p>
          We retain security logs, webhook logs, and billing event history to protect the platform, investigate abuse, and support recovery from failures. We do not intentionally store secrets in customer-facing logs.
        </p>
        <p>
          You can request a data export from your account settings. If you want your account deleted, you can send a deletion request from settings and we will lock the account while we process that request.
        </p>
        <p>
          Because media processing can rely on external infrastructure, some operational metadata may transit trusted third-party services used for billing, storage, or processing. We work to minimize retention when files are no longer needed.
        </p>
      </div>
    </main>
  );
}
