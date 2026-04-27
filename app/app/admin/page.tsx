import { requireAdmin } from "@/lib/authz";
import { getAdminOverview } from "@/lib/app-data";
import { BoostStatusBadge } from "@/components/app/boost-status-badge";
import { CsrfHiddenInput } from "@/components/security/csrf-hidden-input";
import { Card } from "@/components/ui/card";

const noticeLabels: Record<string, string> = {
  updated: "Security controls updated.",
  update_failed: "That change could not be saved. Check the server logs for the exact failure.",
  admin_access_required: "A recently verified admin session is required for that action.",
  csrf_failed: "The security token expired. Refresh and try again.",
  unexpected_fields: "Unexpected form data was rejected.",
  invalid_admin_request: "That admin request was invalid.",
  rate_limited: "Too many admin actions in a short window. Give it a minute."
};

type AdminPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function asNotice(value: string | string[] | undefined) {
  const key = Array.isArray(value) ? value[0] : value;
  return key ? noticeLabels[key] ?? null : null;
}

export default async function AppAdminPage({ searchParams }: AdminPageProps) {
  await requireAdmin();
  const overview = await getAdminOverview();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const notice = asNotice(resolvedSearchParams?.notice);

  return (
    <div className="mx-auto max-w-7xl">
      <p className="text-sm font-black uppercase text-coral">Internal</p>
      <h1 className="mt-3 text-4xl font-black md:text-5xl">Admin</h1>
      <p className="mt-4 max-w-2xl leading-7 text-pearl/64">
        Inspect users, subscriptions, and boost jobs. This page is role-gated.
      </p>

      {notice ? (
        <div className="mt-6 rounded-lg border border-mint/25 bg-mint/10 px-4 py-3 text-sm text-pearl/88">{notice}</div>
      ) : null}

      <section className="mt-8 grid gap-5 md:grid-cols-3">
        <Card>
          <p className="text-3xl font-black">{overview.users.length}</p>
          <p className="text-sm text-pearl/58">Recent users</p>
        </Card>
        <Card>
          <p className="text-3xl font-black">{overview.jobs.length}</p>
          <p className="text-sm text-pearl/58">Recent jobs</p>
        </Card>
        <Card>
          <p className="text-3xl font-black">{overview.subscriptions.length}</p>
          <p className="text-sm text-pearl/58">Subscriptions</p>
        </Card>
      </section>

      <section className="mt-10 grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="text-2xl font-black">Users</h2>
          <div className="mt-5 space-y-4 text-sm">
            {overview.users.map(
              (user: {
                id: string;
                email: string;
                full_name: string;
                role: string;
                is_suspended?: boolean;
                submissions_locked?: boolean;
                billing_locked?: boolean;
                abuse_flags?: number;
                suspended_reason?: string | null;
              }) => (
                <div className="rounded-lg border border-pearl/10 p-4" key={user.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{user.full_name || user.email}</p>
                      <p className="mt-1 text-pearl/56">{user.email}</p>
                    </div>
                    <p className="rounded bg-white/[0.04] px-2 py-1 text-xs uppercase tracking-[0.18em] text-mint">{user.role}</p>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {user.is_suspended ? (
                      <span className="rounded bg-coral/15 px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-coral">
                        Suspended
                      </span>
                    ) : null}
                    {user.submissions_locked ? (
                      <span className="rounded bg-amber-400/15 px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">
                        Submissions locked
                      </span>
                    ) : null}
                    {user.billing_locked ? (
                      <span className="rounded bg-violet-400/15 px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-violet-300">
                        Billing locked
                      </span>
                    ) : null}
                    {(user.abuse_flags ?? 0) > 0 ? (
                      <span className="rounded bg-white/[0.06] px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-pearl/76">
                        Abuse flags: {user.abuse_flags}
                      </span>
                    ) : null}
                  </div>

                  {user.suspended_reason ? <p className="mt-3 text-pearl/60">Reason: {user.suspended_reason}</p> : null}

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <form action="/api/admin/users/security" className="grid gap-2">
                      <CsrfHiddenInput />
                      <input name="userId" type="hidden" value={user.id} />
                      <input name="action" type="hidden" value={user.is_suspended ? "resume_user" : "suspend_user"} />
                      {!user.is_suspended ? (
                        <input
                          className="rounded-lg border border-pearl/10 bg-black/30 px-3 py-2 text-sm text-pearl outline-none transition focus:border-mint/40"
                          maxLength={160}
                          name="reason"
                          placeholder="Reason for suspension"
                        />
                      ) : null}
                      <button className="rounded-lg border border-pearl/10 bg-white/[0.04] px-3 py-2 text-left font-semibold transition hover:border-mint/40 hover:bg-white/[0.06]" type="submit">
                        {user.is_suspended ? "Resume account" : "Suspend account"}
                      </button>
                    </form>

                    <form action="/api/admin/users/security" className="grid gap-2">
                      <CsrfHiddenInput />
                      <input name="userId" type="hidden" value={user.id} />
                      <input
                        name="action"
                        type="hidden"
                        value={user.submissions_locked ? "unlock_submissions" : "lock_submissions"}
                      />
                      <button className="rounded-lg border border-pearl/10 bg-white/[0.04] px-3 py-2 text-left font-semibold transition hover:border-mint/40 hover:bg-white/[0.06]" type="submit">
                        {user.submissions_locked ? "Unlock submissions" : "Lock submissions"}
                      </button>
                    </form>

                    <form action="/api/admin/users/security" className="grid gap-2">
                      <CsrfHiddenInput />
                      <input name="userId" type="hidden" value={user.id} />
                      <input name="action" type="hidden" value={user.billing_locked ? "unlock_billing" : "lock_billing"} />
                      <button className="rounded-lg border border-pearl/10 bg-white/[0.04] px-3 py-2 text-left font-semibold transition hover:border-mint/40 hover:bg-white/[0.06]" type="submit">
                        {user.billing_locked ? "Unlock billing" : "Lock billing"}
                      </button>
                    </form>

                    <form action="/api/admin/users/security" className="grid gap-2">
                      <CsrfHiddenInput />
                      <input name="userId" type="hidden" value={user.id} />
                      <input name="action" type="hidden" value={(user.abuse_flags ?? 0) > 0 ? "clear_abuse" : "flag_abuse"} />
                      <button className="rounded-lg border border-pearl/10 bg-white/[0.04] px-3 py-2 text-left font-semibold transition hover:border-mint/40 hover:bg-white/[0.06]" type="submit">
                        {(user.abuse_flags ?? 0) > 0 ? "Clear abuse flags" : "Flag for abuse review"}
                      </button>
                    </form>
                  </div>
                </div>
              )
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-2xl font-black">Recent jobs</h2>
          <div className="mt-5 space-y-4 text-sm">
            {overview.jobs.slice(0, 12).map((job) => (
              <div className="rounded-lg border border-pearl/10 p-4" key={job.id}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black">{job.projectName}</p>
                  <BoostStatusBadge status={job.status} />
                </div>
                <p className="mt-1 text-pearl/56">{job.sourceFileName ?? job.sourceVideoUrl}</p>
                <p className="mt-2 text-xs uppercase text-pearl/40">{job.processorProvider}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="mt-10">
        <Card>
          <h2 className="text-2xl font-black">Subscription state</h2>
          <div className="mt-5 space-y-4 text-sm">
            {overview.subscriptions.slice(0, 20).map(
              (
                subscription: {
                  id?: string;
                  user_id?: string;
                  plan?: string;
                  plan_key?: string;
                  status?: string;
                  credits_total?: number;
                  credits_used?: number;
                  stripe_subscription_id?: string | null;
                  current_period_end?: string | null;
                },
                index: number
              ) => (
                <div className="rounded-lg border border-pearl/10 p-4" key={subscription.id ?? subscription.user_id ?? `subscription-${index}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-black capitalize">{subscription.plan_key ?? subscription.plan ?? "free"}</p>
                    <p className="rounded bg-white/[0.04] px-2 py-1 text-xs uppercase tracking-[0.18em] text-mint">
                      {(subscription.status ?? "free").replaceAll("_", " ")}
                    </p>
                  </div>
                  <p className="mt-2 text-pearl/56">User: {subscription.user_id ?? "unknown"}</p>
                  <p className="mt-1 text-pearl/56">
                    Credits: {subscription.credits_used ?? 0} / {subscription.credits_total ?? 0}
                  </p>
                  <p className="mt-1 text-pearl/56">Subscription ID: {subscription.stripe_subscription_id ?? "none"}</p>
                  <p className="mt-1 text-pearl/56">
                    Period end: {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleString() : "not set"}
                  </p>
                </div>
              )
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
