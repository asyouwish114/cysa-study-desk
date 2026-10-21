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
  },
  {
    id: "cvss-bluetooth", title: "Bluetooth stack takeover",
    scenario: "A flaw in a phone's Bluetooth stack lets an attacker within radio range run code with full system rights. No pairing is needed, the victim doesn't have to tap anything, and the exploit is reliable.",
    vector: "CVSS:3.1/AV:A/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    why: { AV: "The attacker must be within Bluetooth range, which is adjacent, not routable over the internet.", AC: "The exploit works reliably.", PR: "No pairing or account is needed.", UI: "The victim doesn't have to do anything.", S: "Full rights on the phone are still the phone's own authority.", C: "System rights expose all data on the phone.", I: "The attacker can change anything on the phone.", A: "The attacker can crash or disable the phone." }
  },
  {
    id: "cvss-malicious-pdf", title: "Booby-trapped PDF",
    scenario: "A memory corruption bug in a desktop PDF reader lets a crafted file run code as the user who opens it. Attackers email the file to staff, and it works every time it's opened.",
    vector: "CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H",
    why: { AV: "The flaw is in a local application that parses a file on disk. Emailing the file is only how it arrives, so the vector is Local.", AC: "It works every time the file is opened.", PR: "The attacker needs no account on the machine.", UI: "The victim has to open the file.", S: "The code runs with the user's rights inside the same system.", C: "Code running as the user can read the user's data.", I: "It can change the user's files and settings.", A: "It can crash the reader or disrupt the user's work." }
  },
  {
    id: "cvss-stored-xss", title: "Script in a forum signature",
    scenario: "Any registered forum member can save a signature containing script. The script runs in the browser of everyone who views their posts and can read some page data and change what the viewer sees.",
    vector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:R/S:C/C:L/I:L/A:N",
    why: { AV: "The forum is reachable over the internet.", AC: "The stored payload fires reliably.", PR: "Saving a signature needs a basic member account.", UI: "A victim has to view a page with the post.", S: "The flaw is in the forum, but the script runs in each viewer's browser, so scope changes.", C: "The script can read limited data from the page or session.", I: "It can change what the viewer sees, in a limited way.", A: "The forum keeps working." }
  },
  {
    id: "cvss-admin-cmd", title: "Command injection in the router admin page",
    scenario: "The diagnostics page of a router's web admin console passes input to the shell, so a logged-in administrator can run any command as root. The console is reachable from the internet.",
    vector: "CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:U/C:H/I:H/A:H",
    why: { AV: "The admin console is reachable over the network.", AC: "The injection is reliable.", PR: "Only an administrator account can reach the page, which is High privilege.", UI: "No one else has to act.", S: "Root on the router is still the router's own authority.", C: "Root can read all configuration and traffic data.", I: "Root can change the router's configuration and firmware.", A: "Root can shut the router down." }
  },
  {
    id: "cvss-sandbox-escape", title: "Browser sandbox escape",
    scenario: "Visiting a malicious website can trigger a race condition in a browser's renderer that escapes its sandbox and runs code on the operating system as the user. The race only succeeds some of the time and needs careful timing.",
    vector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:C/C:H/I:H/A:H",
    why: { AV: "The attack is delivered from a website over the network.", AC: "Winning the race needs precise timing the attacker can't fully control.", PR: "The attacker needs no account.", UI: "The victim has to visit the malicious site.", S: "The flaw is in the sandboxed renderer, but the impact lands on the operating system, so scope changes.", C: "Code running as the user can read the user's data.", I: "It can change the user's files and settings.", A: "It can disrupt or crash the user's system." }
  },
  {
    id: "cvss-debug-log", title: "World-readable debug log",
    scenario: "On a shared Linux server, any logged-in user can read an application's debug log. It reveals internal hostnames and software versions, but no passwords or customer data, and nothing in it can be changed.",
    vector: "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:L/I:N/A:N",
    why: { AV: "The attacker has to be logged in to the server itself.", AC: "Reading the file always works.", PR: "It needs an ordinary user account on the server.", UI: "No one else has to act.", S: "The impact stays on the same server.", C: "Some information leaks, but nothing sensitive like passwords or customer data.", I: "Nothing can be modified.", A: "The application keeps running." }
  },
  {
    id: "cvss-csrf-email", title: "One-click account email change",
    scenario: "The account settings page has no CSRF protection. If a logged-in user visits an attacker's page, it silently changes their account email to the attacker's, who can then reset the password and take over the account.",
    vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:H/A:N",
    why: { AV: "The attack is launched from a web page over the network.", AC: "The forged request works reliably.", PR: "The attacker needs no account of their own; the victim's session does the work.", UI: "The logged-in victim has to visit the attacker's page.", S: "The changed setting belongs to the same web application.", C: "The forged request itself reads nothing.", I: "The attacker fully controls a security-critical setting, the account email.", A: "The site keeps working." }
  },
  {
    id: "cvss-plc-crash", title: "Plant-floor PLC crash",
    scenario: "Sending one malformed packet to a PLC from a machine on the plant's control network makes it stop until someone power-cycles it. No login is needed, the control network isn't routable from the internet, and nothing can be read or changed.",
    vector: "CVSS:3.1/AV:A/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H",
    why: { AV: "The attacker must be on the same isolated control network, which is adjacent.", AC: "One packet works every time.", PR: "No login is needed.", UI: "No one has to do anything.", S: "Only the PLC itself is affected.", C: "No data is exposed.", I: "Nothing is modified.", A: "The PLC stops completely until it's power-cycled." }
  }
];
