import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service | RGJDASS Couture Studio',
  description: 'Terms of Service for RGJDASS Couture Studio',
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-slate-900/60 p-8 sm:p-12 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Terms of Service</h1>
        <p className="text-sm text-slate-400 mb-8">Last updated: November 24, 2026</p>

        <section className="space-y-6 text-sm leading-relaxed text-slate-300">
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">1. Acceptance of Terms</h2>
            <p>
              By accessing and using the RGJDASS Couture Studio application (&quot;the Platform&quot;), you agree to comply
              with and be bound by these Terms of Service. If you do not agree, please do not use the Platform.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">2. Use of the Service</h2>
            <p>
              The Platform is provided to authorized staff, designers, and boutique clients for garment visualization,
              catalogue creation, and photoshoot asset management. Users agree to upload only content they have legitimate
              rights or licenses to use.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">3. Intellectual Property</h2>
            <p>
              All proprietary algorithms, UI designs, and studio software remain the intellectual property of RGJDASS.
              Generated catalogue mockups, garments, and swatch variations created from your assets remain under your
              commercial ownership.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">4. Disclaimer &amp; Availability</h2>
            <p>
              The service is provided on an &quot;as is&quot; and &quot;as available&quot; basis without warranties of any
              kind. While we strive for maximum uptime and output fidelity, we do not guarantee uninterrupted availability.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">5. Contact Information</h2>
            <p>
              For inquiries regarding these Terms, contact our administrative desk at{' '}
              <span className="text-amber-400 font-medium">rgjdass10@gmail.com</span>.
            </p>
          </div>
        </section>

        <div className="mt-10 pt-6 border-t border-slate-800 text-center">
          <Link href="/" className="text-xs text-slate-400 hover:text-white transition-colors">
            &larr; Return to Studio
          </Link>
        </div>
      </div>
    </div>
  );
}
