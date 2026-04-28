export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="text-5xl font-black">Terms of Service</h1>
      <div className="mt-6 space-y-6 leading-8 text-pearl/72">
        <p>
          AutoAgentX gives creators tools to upload source clips or provide supported video URLs, then receive processed short-form outputs. By using the service, you confirm that you have the right to upload, process, and download the media you submit.
        </p>
        <p>
          You are responsible for the legality of your source material, prompts, descriptions, account activity, and any published output. You may not use the service for unlawful content, rights infringement, malware delivery, harassment, or abusive automation.
        </p>
        <p>
          Paid features, credits, and subscription access are controlled server-side and may be suspended for failed payments, refunds, chargebacks, abuse, or policy violations. We may limit or suspend accounts to protect the platform or other users.
        </p>
        <p>
          Generated outputs are provided on a best-effort basis. Processing may fail, be delayed, or be limited by upstream providers. Where a failed job qualifies for a credit return, the platform will attempt to refund the reserved credit once.
        </p>
        <p>
          We may update these terms as the product evolves. Continued use after updated terms are published means you accept the new version.
        </p>
      </div>
    </main>
  );
}
