import type { RawFeedItem } from "../types";

const INCIDENT_SIGNALS = {
  // High-confidence breach/compromise language
  breach: 3,
  "data breach": 4,
  compromised: 3,
  "unauthorized access": 3,
  "unauthorised access": 3,
  intrusion: 3,
  hacked: 3,
  ransomware: 4,
  "ransomware attack": 4,
  exfiltrated: 3,
  "data theft": 3,
  "stolen data": 3,
  "customer data": 2,
  "personal information": 2,
  "exposed data": 3,
  leaked: 2,
  "supply chain attack": 4,
  "supply chain compromise": 4,
  "third-party compromise": 3,
  "active exploitation": 3,
  "in the wild": 2,
  "zero-day exploited": 4,
  "under attack": 3,
  "ongoing attack": 3,
  "state-sponsored": 2,
  "threat actor": 2,
  "apt group": 2,
  "malware campaign": 3,
  "phishing campaign": 2,
  "credential stuffing": 2,
  "password spraying": 2,
  "lateral movement": 2,
  "privilege escalation": 2,
  "initial access": 2,
  "command and control": 2,
  "c2 infrastructure": 2,
  "backdoor detected": 3,
  "rootkit": 2,
  "data ransom": 3,
  "double extortion": 3,
  "encryption attack": 3,
  "business email compromise": 3,
  bec: 2,
  "impacted users": 2,
  "affected customers": 2,
  "security incident": 3,
  "cyberattack": 3,
  "cyber attack": 3,
  "successful breach": 4,
  "confirmed compromise": 4,
  "discloses breach": 3,
  "discloses data breach": 4,
  "acknowledges breach": 3,
  "notifies customers": 2,
  "forced password reset": 2,
  "investigating incident": 2,
  "incident response": 2
};

const NON_INCIDENT_SIGNALS = {
  // Patterns that strongly suggest this is NOT an incident report
  advisory: -1,
  "security update": -1,
  "patch released": -1,
  "version ": -1,
  "announces": -1,
  "launches": -1,
  "partnership": -1,
  "acquires": -1,
  "raises ": -1,
  funding: -1,
  "quarterly earnings": -2,
  "market analysis": -1,
  "industry report": -1,
  "survey reveals": -1,
  "research shows": -1,
  "study finds": -1,
  framework: -1,
  guideline: -1,
  "best practice": -1,
  "compliance checklist": -1,
  certification: -1,
  "product update": -1,
  "feature release": -1,
  "api update": -1,
  "new tool": -1,
  "open source": -1,
  "conference": -1,
  webinar: -1,
  podcast: -1,
  interview: -1,
  opinion: -1,
  editorial: -1,
  "market forecast": -1,
  "growth projection": -1
};

const INCIDENT_CATEGORIES = new Set([
  "threat-intel",
  "vulnerabilities",
  "industry-news"
]);

/**
 * Score an article's text for incident likelihood.
 * Returns a numeric score. Positive = likely incident, negative = likely not.
 */
export const scoreIncidentLikelihood = (item: RawFeedItem): number => {
  const text = `${item.title} ${item.summary} ${item.sourceSnippet || ""}`.toLowerCase();
  let score = 0;

  for (const [signal, weight] of Object.entries(INCIDENT_SIGNALS)) {
    const regex = new RegExp(`\\b${signal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    const matches = text.match(regex);
    if (matches) {
      score += weight * matches.length;
    }
  }

  for (const [signal, weight] of Object.entries(NON_INCIDENT_SIGNALS)) {
    const regex = new RegExp(`\\b${signal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    const matches = text.match(regex);
    if (matches) {
      score += weight * matches.length;
    }
  }

  // Boost score for breach-related categories
  if (INCIDENT_CATEGORIES.has(item.category)) {
    score += 1;
  }

  return score;
};

/**
 * Determine if an article describes a security incident.
 * Uses keyword scoring with configurable threshold.
 */
export const isSecurityIncident = (item: RawFeedItem, threshold = 3): boolean => {
  return scoreIncidentLikelihood(item) >= threshold;
};

/**
 * Detailed classification result for logging/auditing.
 */
export interface IncidentClassification {
  isIncident: boolean;
  confidence: "high" | "medium" | "low";
  score: number;
  signals: string[];
}

export const classifyIncidentDetailed = (item: RawFeedItem): IncidentClassification => {
  const text = `${item.title} ${item.summary} ${item.sourceSnippet || ""}`.toLowerCase();
  const score = scoreIncidentLikelihood(item);
  const signals: string[] = [];

  for (const [signal, weight] of Object.entries(INCIDENT_SIGNALS)) {
    const regex = new RegExp(`\\b${signal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    if (regex.test(text) && weight >= 2) {
      signals.push(signal);
    }
  }

  let confidence: "high" | "medium" | "low" = "low";
  if (score >= 6) confidence = "high";
  else if (score >= 3) confidence = "medium";

  return {
    isIncident: score >= 3,
    confidence,
    score,
    signals: signals.slice(0, 6)
  };
};
