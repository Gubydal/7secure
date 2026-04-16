export interface EditorialCard {
  eyebrow: string;
  title: string;
  summary: string;
  href: string;
  tone: "cyan" | "pink" | "amber" | "violet" | "mint" | "slate";
}

export const sectionLinks = [
  { label: "Articles", href: "/articles" },
  { label: "Practices", href: "/practices" },
  { label: "Tools", href: "/tools" },
  { label: "Subscribe", href: "/subscribe" }
] as const;

export const trustSignals = [
  "Google",
  "Microsoft",
  "Cisco",
  "Cloudflare",
  "IBM",
  "OpenAI"
];

export const practiceCards: EditorialCard[] = [
  {
    eyebrow: "Playbook",
    title: "Build a 15-minute incident triage routine",
    summary: "A repeatable workflow for classifying alerts, assigning owners, and deciding what gets escalated.",
    href: "/practices",
    tone: "cyan"
  },
  {
    eyebrow: "Checklist",
    title: "Harden your public-facing app before launch",
    summary: "A pre-release checklist for auth, headers, logging, and asset exposure that catches the obvious misses.",
    href: "/practices",
    tone: "violet"
  },
  {
    eyebrow: "Workflow",
    title: "Turn daily alerts into one weekly security review",
    summary: "Move from noisy notifications to a concise review ritual that your team can actually keep up with.",
    href: "/practices",
    tone: "amber"
  },
  {
    eyebrow: "Template",
    title: "Use a clean disclosure response template",
    summary: "A respectful, fast-response template for security researchers and users reporting abuse or vulnerabilities.",
    href: "/practices",
    tone: "mint"
  }
];

export const toolCards: EditorialCard[] = [
  {
    eyebrow: "Trending",
    title: "Shodan for exposure tracking",
    summary: "Monitor exposed services, risky ports, and unexpected internet-facing assets in your environment.",
    href: "/tools",
    tone: "slate"
  },
  {
    eyebrow: "Automation",
    title: "Use Feedly to centralize your threat intel",
    summary: "Collect sources, tag stories, and move the most relevant articles into a clean daily workflow.",
    href: "/tools",
    tone: "cyan"
  },
  {
    eyebrow: "Analysis",
    title: "VirusTotal for quick domain checks",
    summary: "Fast reputation checks for domains, hashes, and URLs when something looks suspicious.",
    href: "/tools",
    tone: "pink"
  },
  {
    eyebrow: "Reference",
    title: "NIST CSRC for control mapping",
    summary: "Use the official source when you need a control, framework, or compliance reference that sticks.",
    href: "/tools",
    tone: "amber"
  }
];

export const articleSectionFilters = [
  "All",
  "Threat Intel",
  "Vulnerabilities",
  "Industry News",
  "AI Security",
  "Government"
];
