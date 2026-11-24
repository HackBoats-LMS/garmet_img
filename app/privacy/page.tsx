import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | RGJDASS Couture Studio',
  description: 'Privacy Policy and Google API Data Disclosure for RGJDASS Couture Studio',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-slate-900/60 p-8 sm:p-12 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-slate-400 mb-8">Last updated: November 24, 2026</p>

        <section className="space-y-6 text-sm leading-relaxed text-slate-300">
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">1. Overview</h2>
            <p>
              RGJDASS Couture Studio (&quot;we&quot;, &quot;our&quot;, or &quot;the Service&quot;) provides an internal AI-powered
              studio platform designed to create garment and catalogue photoshoots. We respect your privacy and are committed
              to safeguarding your personal data.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">2. Data We Collect</h2>
            <p>
              When authorized by you, we collect and process:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Basic profile and contact information (such as your name and email address) for user authentication.</li>
              <li>Images and assets explicitly selected by you via Google Drive or Google Photos Picker for photoshoot generation.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">3. Google API Services User Data Policy</h2>
            <p className="p-4 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-200">
              RGJDASS Couture Studio&apos;s use and transfer of information received from Google APIs to any other app will
              strictly adhere to the{' '}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 underline hover:text-amber-300"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">4. How We Use Selected Images</h2>
            <p>
              Files and images chosen via Google Picker are processed solely to create mockup garment visualisations
              and product catalogue listings requested by you. We do not use your private images to train public machine
              learning models, nor do we sell or distribute your data to third parties.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">5. Data Retention &amp; Security</h2>
            <p>
              Uploaded assets are stored securely with encrypted access controls. Users may request deletion of their
              stored product and photoshoot assets at any time through our administrative interface.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">6. Contact Us</h2>
            <p>
              If you have any questions regarding this Privacy Policy or your data, please contact our administrative
              team at <span className="text-amber-400 font-medium">rgjdass10@gmail.com</span>.
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
