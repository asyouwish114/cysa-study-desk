// CompTIA CySA+ CS0-003 exam domains. Weights are the official percentages and must sum to 100.
window.CYSA = window.CYSA || {};
window.CYSA.domains = {
  so: {
    code: "1.0", name: "Security Operations", weight: 33,
    topics: ["System & network architecture", "Indicators of malicious activity", "Threat intel & hunting", "SIEM / SOAR / EDR", "Log & email analysis", "Zero trust, IAM"]
  },
  vm: {
    code: "2.0", name: "Vulnerability Management", weight: 30,
    topics: ["Scanning methods", "CVSS & prioritization", "Web app attacks", "Controls & mitigation", "Cloud & OT/ICS", "Attack surface mgmt"]
  },
  ir: {
    code: "3.0", name: "Incident Response and Management", weight: 20,
    topics: ["NIST IR lifecycle", "Kill Chain, Diamond, ATT&CK", "Forensics & order of volatility", "Containment & eradication", "Chain of custody"]
  },
  rc: {
    code: "4.0", name: "Reporting and Communication", weight: 17,
    topics: ["Vuln reporting & metrics", "Remediation inhibitors", "Stakeholder communication", "Incident reports & lessons learned", "KPIs: MTTD / MTTR"]
  }
};
