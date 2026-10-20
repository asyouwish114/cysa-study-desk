// CVSS v3.1 scoring challenges. Fields: id (stable, unique), title, scenario, vector (the correct full
// CVSS:3.1 base vector), why: { one short reason per metric key: AV, AC, PR, UI, S, C, I, A }.
window.CYSA = window.CYSA || {};
window.CYSA.cvssScenarios = [
  {
    id: "cvss-rce", title: "Pre-auth RCE on the VPN appliance",
    scenario: "A flaw in an internet-facing VPN appliance's web portal lets anyone send a crafted HTTP request that runs commands as root. No login is needed and the exploit works every time.",
    vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    why: { AV: "Reachable from the internet.", AC: "Works every time, with no special conditions.", PR: "No login needed.", UI: "Nobody else has to do anything.", S: "Root on the appliance is still the appliance's own authority.", C: "Root can read everything.", I: "Root can change everything.", A: "Root can shut the device down." }
  },
  {
    id: "cvss-reflected-xss", title: "Reflected XSS in the search page",
    scenario: "The site's search box echoes input into the page without encoding. An attacker emails victims a crafted link, and when a victim clicks it, script runs in their browser and can read some page data and change what they see.",
    vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N",
    why: { AV: "Delivered over the network as a link.", AC: "The payload works reliably.", PR: "The attacker needs no account.", UI: "The victim has to click the link.", S: "The flaw is in the web app, but the impact lands in the victim's browser, so scope changes.", C: "Limited data from the page or session can be read.", I: "The attacker can change what the victim sees, in a limited way.", A: "The site keeps working." }
  },
  {
    id: "cvss-lpe", title: "Driver privilege escalation",
    scenario: "A vulnerable kernel driver lets any logged-in standard user run code as SYSTEM on their Windows workstation. The exploit is public and reliable.",
    vector: "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",
    why: { AV: "Needs a local session on the machine.", AC: "Public and reliable.", PR: "A standard user account is needed.", UI: "No one else has to act.", S: "The OS authority covers both the driver and SYSTEM, so scope is unchanged.", C: "SYSTEM can read everything on the host.", I: "SYSTEM can modify anything.", A: "SYSTEM can take the host down." }
  },
  {
    id: "cvss-physical", title: "Unencrypted laptop disk",
    scenario: "A laptop model ships without disk encryption and with USB boot enabled. Someone holding the laptop can boot a live USB and copy every file. Nothing is changed or broken.",
    vector: "CVSS:3.1/AV:P/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
    why: { AV: "The attacker has to physically handle the laptop.", AC: "Booting a live USB is straightforward.", PR: "No account is needed; the OS is bypassed.", UI: "The owner doesn't have to do anything.", S: "The impact stays on the laptop.", C: "Every file can be copied.", I: "The scenario says nothing is changed.", A: "The laptop keeps working." }
  },
  {
    id: "cvss-dos", title: "Packet of death",
    scenario: "Sending a single malformed packet to a firewall's management port crashes it until someone power-cycles it. No authentication is involved, and no data is exposed or altered.",
    vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H",
    why: { AV: "Sent over the network.", AC: "One packet does it every time.", PR: "No authentication is needed.", UI: "No one else has to act.", S: "Only the firewall itself is affected. Scope covers authority, not the business impact of an outage.", C: "No data is exposed.", I: "No data is altered.", A: "A full outage until someone power-cycles it." }
  },
  {
    id: "cvss-race", title: "Timing-dependent memory leak",
    scenario: "An unauthenticated attacker can read chunks of a web server's memory, including session keys, but only by winning a narrow race condition that needs many attempts and depends on server load.",
    vector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:N/A:N",
    why: { AV: "Remote over the network.", AC: "Winning a race that depends on server load is outside the attacker's control.", PR: "Unauthenticated.", UI: "No one else has to act.", S: "The impact stays inside the web server.", C: "Session keys are critical data.", I: "Reading memory doesn't change anything.", A: "The server keeps running." }
  },
  {
    id: "cvss-vm-escape", title: "Hypervisor escape",
    scenario: "An administrator inside a guest VM can exploit a virtual device flaw to run code on the host hypervisor, gaining full control of the host and every other VM on it.",
    vector: "CVSS:3.1/AV:L/AC:L/PR:H/UI:N/S:C/C:H/I:H/A:H",
    why: { AV: "The attacker must already be running code inside the guest.", AC: "The exploit is reliable.", PR: "Administrator rights inside the guest are needed.", UI: "No one else has to act.", S: "It breaks out of the guest into the hypervisor's authority. That's the textbook scope change.", C: "Full control of the host and every VM.", I: "Full control of the host and every VM.", A: "Full control of the host and every VM." }
  },
  {
    id: "cvss-idor-sqli", title: "Customer portal SQL injection",
    scenario: "Any logged-in customer can inject SQL through the order-history filter and read every other customer's records. The injection is read-only and the portal stays up.",
    vector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N",
    why: { AV: "A web portal on the internet.", AC: "The injection is reliable.", PR: "It needs a basic customer account.", UI: "No one else has to act.", S: "The database belongs to the same application authority.", C: "All customer records are exposed.", I: "The injection is read-only.", A: "The portal stays up." }
  }
];
