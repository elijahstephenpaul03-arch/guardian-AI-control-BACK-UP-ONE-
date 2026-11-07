import React, { useState } from "react";
import { Shield, Sparkles, Send, CheckCircle2, ExternalLink } from "lucide-react";

export default function Footer() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail("");
    }
  };

  return (
    <footer className="relative border-t bg-slate-900 text-slate-400 py-16 dark:bg-slate-950 transition-colors duration-300">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          
          {/* Brand block */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-500 text-white">
                <Shield className="h-5 w-5" />
              </div>
              <span className="font-display text-lg font-bold tracking-tight text-white">
                Guardian<span className="text-cyan-400">AI</span>
              </span>
            </div>
            <p className="text-sm text-slate-400">
              The next-generation AI-powered child safety platform protecting digital lives and uncovering hidden potential.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="inline-flex items-center rounded bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-300 border border-slate-700">
                <CheckCircle2 className="mr-1 h-3 w-3 text-cyan-400" /> SOC2 Certified
              </span>
              <span className="inline-flex items-center rounded bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-300 border border-slate-700">
                <CheckCircle2 className="mr-1 h-3 w-3 text-cyan-400" /> GDPR Compliant
              </span>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-sm font-semibold tracking-wider text-slate-200 uppercase mb-4">Core Platform</h4>
            <ul className="space-y-2.5 text-sm">
              <li><a href="#features" className="hover:text-cyan-400 transition-colors">Safety Filters & Geofencing</a></li>
              <li><a href="#ai-features" className="hover:text-cyan-400 transition-colors">AI Dangerous Content Detection</a></li>
              <li><a href="#ai-report" className="hover:text-cyan-400 transition-colors">AI Weekly Parenting Reports</a></li>
              <li><a href="#talent" className="hover:text-cyan-400 transition-colors">Interest & Talent Discovery</a></li>

            </ul>
          </div>

          {/* Legal / Resources */}
          <div>
            <h4 className="text-sm font-semibold tracking-wider text-slate-200 uppercase mb-4">Trust & Compliance</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a 
                  href="https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-cyan-400 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  title="Open COPPA FTC Compliance Guidelines"
                >
                  <span>COPPA Children Privacy</span>
                  <ExternalLink className="h-3 w-3 text-cyan-500/80" />
                </a>
              </li>
              <li>
                <a 
                  href="https://www.connectsafely.org/parents-guide-to-cybersecurity/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-cyan-400 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  title="Open ConnectSafely Parent Support Center"
                >
                  <span>Parent Support Center</span>
                  <ExternalLink className="h-3 w-3 text-cyan-500/80" />
                </a>
              </li>
              <li>
                <a 
                  href="https://www.nist.gov/itl/applied-cybersecurity/nice/resources/online-safety-kids"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-cyan-400 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  title="Open NIST Child Online Safety Guidelines"
                >
                  <span>Legal & Safety Framework</span>
                  <ExternalLink className="h-3 w-3 text-cyan-500/80" />
                </a>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold tracking-wider text-slate-200 uppercase">Parent Digest Newsletter</h4>
            <p className="text-xs text-slate-400">
              Get weekly parenting tips on managing screen time, understanding digital interest pathways, and child safety insights.
            </p>
            {subscribed ? (
              <div className="rounded-xl bg-slate-800 p-3 text-xs text-cyan-400 flex items-center space-x-2 border border-slate-700">
                <Sparkles className="h-4 w-4 shrink-0" />
                <span>Subscribed successfully! Welcome to the loop.</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex space-x-2">
                <input
                  type="email"
                  required
                  placeholder="parent@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 px-3 py-2 text-xs text-white border border-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-slate-500"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-cyan-500 hover:bg-cyan-400 p-2 text-white transition-all cursor-pointer"
                  aria-label="Subscribe"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            )}
          </div>

        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Guardian AI Technologies, Inc. All rights reserved. Empowering families with trust, privacy, and secure AI.</p>
          <div className="flex space-x-6">
            <span className="hover:text-slate-300 cursor-pointer">Security Center</span>
            <span className="hover:text-slate-300 cursor-pointer">Status: Operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
