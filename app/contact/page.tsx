import Link from "next/link";

const enquiryEmail = "enquiries@example.com";
const feedbackEmail = "feedback@example.com";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-bg px-4 py-10 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted">
              Contact
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Enquiries &amp; Feedback
            </h1>
            <p className="mt-3 max-w-2xl text-base text-muted">
              For strap questions, product ideas, bugs, or the occasional opinionated watch note.
            </p>
          </div>
          <Link
            href="/"
            className="neo-button shrink-0 rounded-2xl border border-line px-4 py-2.5 text-sm font-semibold text-ink"
          >
            Back to bench
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="glass-card rounded-3xl border border-line p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-700">
              Enquiries
            </p>
            <p className="mt-3 text-lg font-semibold text-ink">Questions, partnerships, requests</p>
            <a
              href={`mailto:${enquiryEmail}`}
              className="mt-5 inline-flex rounded-2xl border border-line bg-canvas px-4 py-3 text-base font-medium text-ink hover:bg-white"
            >
              {enquiryEmail}
            </a>
          </section>

          <section className="glass-card rounded-3xl border border-line p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-700">
              Feedback
            </p>
            <p className="mt-3 text-lg font-semibold text-ink">Bugs, ideas, fit complaints, feature wishes</p>
            <a
              href={`mailto:${feedbackEmail}`}
              className="mt-5 inline-flex rounded-2xl border border-line bg-canvas px-4 py-3 text-base font-medium text-ink hover:bg-white"
            >
              {feedbackEmail}
            </a>
          </section>
        </div>

        <p className="mt-6 text-sm text-muted">
          Placeholder addresses are live for now. Swap them once you send the real ones.
        </p>
      </div>
    </main>
  );
}
