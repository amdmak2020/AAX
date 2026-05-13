export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="text-5xl font-black">Privacy Policy</h1>
      <div className="mt-6 space-y-10 leading-8 text-pearl/72">
        <section className="space-y-4">
          <p>
            AutoAgentX stores the minimum account, billing, and job data needed to run the product, including account identity, plan state, job records, upload metadata, and limited operational logs. Payment processing is handled by Gumroad.
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
        </section>

        <section className="space-y-4">
          <h2 className="text-3xl font-black text-pearl">Google User Data Usage</h2>
          <p>
            AutoAgentX may request access to certain Google user data only after the user gives permission through Google OAuth.
          </p>

          <div className="space-y-3">
            <h3 className="text-xl font-black text-pearl">1. Data Accessed</h3>
            <p>Depending on the features the user chooses to use, AutoAgentX may access the following Google user data:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Basic Google account information, such as name and email address, for account identification and login.</li>
              <li>YouTube channel or account data, if the user connects YouTube features.</li>
              <li>YouTube video upload and management permissions, if the user uses AutoAgentX to upload or publish videos to YouTube.</li>
              <li>Any other Google API data explicitly shown on the Google OAuth consent screen.</li>
            </ul>
            <p>AutoAgentX does not access Google user data without the user&apos;s permission.</p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xl font-black text-pearl">2. Data Usage</h3>
            <p>AutoAgentX uses Google user data only to provide the features requested by the user, including:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Connecting the user&apos;s Google or YouTube account to AutoAgentX.</li>
              <li>Uploading videos to the user&apos;s YouTube channel when the user requests it.</li>
              <li>Managing video metadata such as title, description, tags, privacy status, scheduled publish time, and related upload settings.</li>
              <li>Displaying account or upload status information inside the AutoAgentX dashboard.</li>
            </ul>
            <p>
              AutoAgentX does not use Google user data for advertising, profiling, selling user information, or training generalized AI models.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xl font-black text-pearl">3. Data Sharing</h3>
            <p>AutoAgentX does not sell, rent, or share Google user data with third parties for marketing or advertising.</p>
            <p>Google user data may only be shared in the following limited situations:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>With service providers necessary to operate the app, such as hosting, database, storage, or infrastructure providers.</li>
              <li>When required by law, regulation, legal process, or government request.</li>
              <li>When necessary to protect the rights, safety, or security of AutoAgentX, users, or the public.</li>
            </ul>
            <p>Any service providers are only allowed to process data as needed to provide the service.</p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xl font-black text-pearl">4. Data Storage and Protection</h3>
            <p>AutoAgentX stores Google user data only when necessary to provide the app&apos;s functionality.</p>
            <p>
              We use reasonable technical and organizational safeguards to protect user data, including secure servers, access controls, HTTPS encryption, and restricted internal access.
            </p>
            <p>OAuth tokens and sensitive credentials are stored securely, encrypted at rest, and are not publicly exposed.</p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xl font-black text-pearl">5. Data Retention and Deletion</h3>
            <p>
              AutoAgentX retains Google user data only for as long as necessary to provide the requested service or comply with legal obligations.
            </p>
            <p>
              Users may request deletion of their Google user data by contacting us at{" "}
              <a className="text-mint hover:text-mint-2" href="mailto:ahmedhussein0114278@gmail.com">
                ahmedhussein0114278@gmail.com
              </a>
              .
            </p>
            <p>
              Users may also revoke AutoAgentX&apos;s access to their Google account at any time from their Google Account permissions page:{" "}
              <a
                className="text-mint hover:text-mint-2"
                href="https://myaccount.google.com/permissions"
                rel="noreferrer"
                target="_blank"
              >
                https://myaccount.google.com/permissions
              </a>
              .
            </p>
            <p>
              After a deletion request, AutoAgentX will delete the user&apos;s Google user data from active systems within a reasonable period unless retention is legally required.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xl font-black text-pearl">6. Limited Use Disclosure</h3>
            <p>
              AutoAgentX&apos;s use and transfer of information received from Google APIs will adhere to the{" "}
              <a
                className="text-mint hover:text-mint-2"
                href="https://developers.google.com/terms/api-services-user-data-policy"
                rel="noreferrer"
                target="_blank"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
