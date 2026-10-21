// Log analysis labs (performance-based practice). Fields:
//   id, d (domain key), title, source (log type), brief (scenario), cols (column headers),
//   rows: [{ f: [one value per column], bad: true if part of the attack, note: shown after grading }],
//   tasks: [{ q, o: 4 options, a: 0-based correct index, x: explanation }], debrief (root cause / takeaway),
//   ask (optional step 1 instruction for labs that aren't about an attack).
// Benign rows may carry a note too; it is shown if the student wrongly flags them.
window.CYSA = window.CYSA || {};
window.CYSA.labs = [
  {
    id: "lab-rdp-bruteforce", d: "so", title: "Overnight RDP logins", source: "Windows Security log · JUMP01",
    brief: "JUMP01 is a jump server whose RDP port was left open to the internet. The night shift flagged an unusual burst of events. Review the Security log.",
    cols: ["Time (UTC)", "Event ID", "Logon type", "Account", "Source IP", "Detail"],
    rows: [
      { f: ["02:11:04", "4624", "3", "svc_backup", "10.0.4.20", "Success"], note: "The nightly backup service account logging on from the internal backup server. Expected." },
      { f: ["02:14:31", "4625", "3", "administrator", "185.220.101.47", "Failed: 0xC000006A bad password"], bad: true, note: "Start of rapid failed logons for one account from one external IP. Failed RDP attempts appear as logon type 3 when Network Level Authentication is on." },
      { f: ["02:14:33", "4625", "3", "administrator", "185.220.101.47", "Failed: 0xC000006A bad password"], bad: true, note: "Password guessing continues, two seconds apart." },
      { f: ["02:14:36", "4625", "3", "administrator", "185.220.101.47", "Failed: 0xC000006A bad password"], bad: true, note: "Password guessing continues." },
      { f: ["02:14:38", "4625", "3", "administrator", "185.220.101.47", "Failed: 0xC000006A bad password"], bad: true, note: "Password guessing continues." },
      { f: ["02:14:44", "4625", "3", "admin", "185.220.101.47", "Failed: 0xC0000064 no such user"], bad: true, note: "0xC0000064 means the user name doesn't exist. The attacker is also trying common account names." },
      { f: ["02:15:02", "4624", "10", "administrator", "185.220.101.47", "Success: RemoteInteractive (RDP)"], bad: true, note: "The guessing worked: a successful RDP session (type 10) from the same external IP." },
      { f: ["02:15:02", "4672", "—", "administrator", "—", "Special privileges assigned to new logon"], bad: true, note: "Admin-level privileges granted to the attacker's session." },
      { f: ["02:16:12", "4720", "—", "administrator", "—", "User account created: helpdesk2"], bad: true, note: "Persistence: a backdoor account is created (ATT&CK T1136 Create Account)." },
      { f: ["02:16:15", "4732", "—", "administrator", "—", "helpdesk2 added to local group Administrators"], bad: true, note: "The backdoor account gets admin rights." },
      { f: ["07:02:11", "4625", "3", "mpatel", "10.0.2.31", "Failed: 0xC000006A bad password"], note: "A single failure from an internal workstation followed by a success. That's a typo, not an attack." },
      { f: ["07:02:19", "4624", "3", "mpatel", "10.0.2.31", "Success"], note: "Normal start-of-day logon." }
    ],
    tasks: [
      { q: "What attack does this log show?", o: ["A brute-force attack against the administrator account that succeeded", "Password spraying across many accounts", "Pass-the-hash with a stolen NTLM hash", "A user who forgot their password"], a: 0,
        x: "Many rapid guesses against one account from one IP is brute force. Spraying is the reverse pattern: one or two guesses against many accounts. Pass-the-hash wouldn't produce a run of bad-password failures first." },
      { q: "What should the analyst do first?", o: ["Contain: end the RDP session, disable helpdesk2, reset the administrator password and block 185.220.101.47", "Add 185.220.101.47 to a watchlist and keep monitoring", "Email the administrator account owner to ask whether they logged in", "Reimage JUMP01 immediately"], a: 0,
        x: "An attacker has admin access and persistence right now, so containment comes first. Watching lets them keep working. Email may be read by the attacker. Reimaging straight away destroys evidence you still need." }
    ],
    debrief: "Root cause: RDP exposed to the internet with no MFA and no account lockout. Fix: put RDP behind a VPN or RD Gateway with MFA, enable lockout, and alert on a burst of 4625 events followed by a 4624 from the same source."
  },
  {
    id: "lab-password-spray", d: "so", title: "Quiet failures at 3 a.m.", source: "Microsoft Entra ID sign-in log",
    brief: "Your identity provider's sign-in log shows a cluster of failures outside business hours. No account was locked out. Review the sign-ins.",
    cols: ["Time (UTC)", "User", "Source IP", "Location", "Result", "App"],
    rows: [
      { f: ["03:40:02", "bwalker@corp.example", "102.89.34.11", "Lagos, NG", "Failure 50126: invalid credentials", "Office 365"], bad: true, note: "One attempt against this account from a foreign IP that has never been seen before." },
      { f: ["03:40:05", "cnguyen@corp.example", "102.89.34.11", "Lagos, NG", "Failure 50126: invalid credentials", "Office 365"], bad: true, note: "Same IP, a different user, three seconds later." },
      { f: ["03:40:09", "dfoster@corp.example", "102.89.34.11", "Lagos, NG", "Failure 50126: invalid credentials", "Office 365"], bad: true, note: "Same IP, the next user. The attacker is working through a user list." },
      { f: ["03:40:11", "egarcia@corp.example", "102.89.34.11", "Lagos, NG", "Failure 50126: invalid credentials", "Office 365"], bad: true, note: "Same pattern: one guess per account." },
      { f: ["03:40:14", "mlopez@corp.example", "102.89.34.11", "Lagos, NG", "Success", "Office 365"], bad: true, note: "The sprayed password (likely something like Autumn2026!) worked for mlopez. This account is compromised." },
      { f: ["03:40:17", "gchen@corp.example", "102.89.34.11", "Lagos, NG", "Failure 50126: invalid credentials", "Office 365"], bad: true, note: "Spraying continues after the hit." },
      { f: ["03:52:30", "mlopez@corp.example", "102.89.34.11", "Lagos, NG", "Success", "Exchange Online"], bad: true, note: "The attacker uses the stolen account to open the mailbox, typically to read mail or set forwarding rules." },
      { f: ["08:01:12", "akim@corp.example", "198.51.100.10", "Chicago, US", "Success", "Outlook"], note: "Office IP during business hours. Normal." },
      { f: ["08:03:40", "jdoe@corp.example", "198.51.100.10", "Chicago, US", "Failure 50126: invalid credentials", "Teams"], note: "One failure from the office IP followed by a success. A typo." },
      { f: ["08:03:52", "jdoe@corp.example", "198.51.100.10", "Chicago, US", "Success", "Teams"], note: "Normal." }
    ],
    tasks: [
      { q: "What attack does this log show?", o: ["Password spraying, with one account compromised", "A brute-force attack against mlopez", "MFA fatigue (push bombing)", "Session cookie theft (pass-the-cookie)"], a: 0,
        x: "One guess per account across many accounts from a single IP is password spraying. It deliberately stays under lockout thresholds. A brute-force attack against mlopez would show many failures for that one user first." },
      { q: "What is the best response?", o: ["Reset mlopez's password, revoke their sessions, check the mailbox for forwarding rules, and block 102.89.34.11", "Lock every account that had a failed sign-in", "Lower the lockout threshold to one attempt", "Ignore it, because only one sign-in succeeded"], a: 0,
        x: "Remediate the compromised account (password, sessions, mailbox rules), then block the source. Mass lockouts and a one-attempt threshold cause a self-inflicted denial of service. One successful compromise is a full incident." }
    ],
    debrief: "Spraying beats lockout policies by design. The controls that stop it are MFA, banned-password lists, and conditional access that blocks legacy authentication and unfamiliar locations. Alert on one IP failing against many accounts."
  },
  {
    id: "lab-beaconing", d: "so", title: "Clockwork traffic", source: "Web proxy log · WS-114",
    brief: "Threat hunting flagged workstation WS-114 for rare outbound destinations. Review an excerpt of its proxy traffic.",
    cols: ["Time", "Host", "Destination", "Port", "Bytes out", "Bytes in"],
    rows: [
      { f: ["13:00:00", "WS-114", "45.77.12.9", "443", "412", "1,180"], bad: true, note: "A raw IP with no hostname, on a small, fixed-size request." },
      { f: ["13:00:21", "WS-114", "outlook.office365.com", "443", "8,912", "64,220"], note: "Normal mail traffic. The sizes vary, as you'd expect from real use." },
      { f: ["13:01:00", "WS-114", "45.77.12.9", "443", "412", "1,180"], bad: true, note: "Exactly 60 seconds later, with identical sizes. That's a beacon." },
      { f: ["13:01:37", "WS-087", "www.google.com", "443", "2,310", "48,004"], note: "A different host doing normal browsing." },
      { f: ["13:02:01", "WS-114", "45.77.12.9", "443", "412", "1,180"], bad: true, note: "60 seconds again, with only 1 second of jitter." },
      { f: ["13:03:00", "WS-114", "45.77.12.9", "443", "412", "1,180"], bad: true, note: "The regular check-in continues." },
      { f: ["13:03:44", "WS-114", "ctldl.windowsupdate.com", "80", "640", "22,880"], note: "Windows Update fetching certificate trust lists. Legitimate." },
      { f: ["13:04:00", "WS-114", "45.77.12.9", "443", "412", "1,180"], bad: true, note: "The regular check-in continues." },
      { f: ["13:05:01", "WS-114", "45.77.12.9", "443", "412", "9,204"], bad: true, note: "The response is suddenly larger: the C2 server is sending a tasking." },
      { f: ["13:05:30", "WS-114", "45.77.12.9", "443", "2,114,560", "640"], bad: true, note: "About 2 MB outbound to the C2 IP right after the tasking: likely exfiltration." },
      { f: ["13:06:12", "WS-114", "teams.microsoft.com", "443", "15,402", "91,337"], note: "Normal Teams traffic." }
    ],
    tasks: [
      { q: "What does this traffic most likely show?", o: ["Command-and-control beaconing followed by data exfiltration", "Routine software update checks", "An outbound port scan", "WS-114 taking part in a DDoS attack"], a: 0,
        x: "Fixed intervals, identical small payloads and a bare IP point to a C2 beacon. The large outbound transfer to the same IP right after a bigger response suggests the attacker tasked the implant to exfiltrate data." },
      { q: "What should the analyst do first?", o: ["Isolate WS-114 with EDR network containment, capture memory, and block 45.77.12.9", "Block all outbound port 443 at the firewall", "Reboot WS-114 to stop the process", "Run an antivirus scan and close the ticket if it's clean"], a: 0,
        x: "EDR isolation stops the C2 while keeping the host up for forensics. A memory capture preserves the implant, which may exist only in RAM. Blocking all 443 breaks the business, a reboot destroys volatile evidence, and a clean AV scan proves nothing against custom implants." }
    ],
    debrief: "Beacons are easiest to spot statistically: regular intervals, low jitter, consistent sizes, rare destinations. Also check which process made the connections (EDR telemetry or Sysmon Event ID 3) to find the implant."
  },
  {
    id: "lab-sqli", d: "vm", title: "A shopper with sqlmap", source: "Apache access log · shop.example.com",
    brief: "The web team reports error spikes on the product page. Review the access log for the affected window.",
    cols: ["Client IP", "Time", "Request", "Status", "Bytes", "User agent"],
    rows: [
      { f: ["198.51.100.23", "10:14:02", "GET /products.php?id=12", "200", "5,120", "Mozilla/5.0 (Windows NT 10.0)"], note: "A normal product view. Note the usual response size, about 5 KB." },
      { f: ["203.0.113.66", "10:15:30", "GET /products.php?id=12'", "500", "612", "sqlmap/1.7.2"], bad: true, note: "A single quote breaks the query and causes a server error. That's the classic first injection probe, and the user agent names an SQL injection tool." },
      { f: ["203.0.113.66", "10:15:31", "GET /products.php?id=12 AND 1=1", "200", "5,120", "sqlmap/1.7.2"], bad: true, note: "A boolean test where the true condition returns the normal page." },
      { f: ["203.0.113.66", "10:15:31", "GET /products.php?id=12 AND 1=2", "200", "1,024", "sqlmap/1.7.2"], bad: true, note: "The false condition returns a different, smaller page. The parameter is confirmed injectable." },
      { f: ["203.0.113.66", "10:15:33", "GET /products.php?id=12 UNION SELECT NULL,NULL,NULL--", "500", "612", "sqlmap/1.7.2"], bad: true, note: "Working out the column count. Three columns is wrong, so it errors." },
      { f: ["203.0.113.66", "10:15:34", "GET /products.php?id=12 UNION SELECT NULL,NULL,NULL,NULL--", "200", "5,388", "sqlmap/1.7.2"], bad: true, note: "Four columns succeeds. The UNION now works." },
      { f: ["198.51.100.23", "10:15:36", "GET /cart.php", "200", "3,402", "Mozilla/5.0 (Windows NT 10.0)"], note: "The same normal shopper continuing to the cart." },
      { f: ["203.0.113.66", "10:15:40", "GET /products.php?id=-1 UNION SELECT username,password_hash,email,NULL FROM users--", "200", "48,213", "sqlmap/1.7.2"], bad: true, note: "A 200 response nearly 10 times the normal size: the users table, with password hashes, was dumped." },
      { f: ["192.0.2.77", "10:16:02", "GET /search.php?q=o'brien+boots", "200", "4,880", "Mozilla/5.0 (Macintosh)"], note: "A legitimate search for a name with an apostrophe. One quote in normal browsing isn't an attack; context matters." },
      { f: ["192.0.2.77", "10:16:05", "GET /images/boots-0412.jpg", "200", "88,120", "Mozilla/5.0 (Macintosh)"], note: "A normal image load. Large, but expected for an image." }
    ],
    tasks: [
      { q: "What happened?", o: ["SQL injection that likely succeeded in extracting user records", "SQL injection that failed, since the probes returned errors", "Stored cross-site scripting", "Directory traversal"], a: 0,
        x: "The errors were only the discovery phase. The final UNION query returned 200 with a response almost 10 times the normal size, which means data came back. Judge success by the response, not by the errors along the way." },
      { q: "What is the best course of action?", o: ["Block 203.0.113.66, disable or virtually patch products.php, determine what data was exposed, and start breach procedures", "Block the sqlmap user agent and close the incident", "Fix the 500 errors so the page stops crashing", "Restart the web server to clear the attacker's session"], a: 0,
        x: "Contain the attacker and the vulnerable page, then scope the exposure. Leaked password hashes mean forced resets and possibly notification obligations. User agents are trivial to change, the 500s are a symptom, and a restart fixes nothing. The permanent fix is parameterized queries." }
    ],
    debrief: "The real vulnerability is building SQL from user input. Fix it with parameterized queries and least-privilege database accounts, and use a WAF only as defense in depth. Alert on SQL keywords in parameters and on unusually large responses."
  },
  {
    id: "lab-lateral-movement", d: "ir", title: "An admin who wasn't", source: "Windows Security + System logs · APP-SRV03",
    brief: "EDR raised a medium-severity alert for a service installation on application server APP-SRV03. Review the server's events.",
    cols: ["Time", "Log", "Event ID", "Account", "Source", "Detail"],
    rows: [
      { f: ["01:00:03", "Security", "4624", "svc_backup", "BACKUP01 (10.0.4.20)", "Logon type 3 (network)"], note: "The scheduled backup connecting over the network. Expected at 1 a.m." },
      { f: ["01:00:45", "Security", "4634", "svc_backup", "—", "Logoff"], note: "Backup finished." },
      { f: ["14:22:10", "Security", "4624", "it-admin2", "WS-022 (10.0.2.58)", "Logon type 3 (network)"], bad: true, note: "A network logon from a user workstation with an admin account. This is the start of the movement." },
      { f: ["14:22:10", "Security", "5145", "it-admin2", "WS-022 (10.0.2.58)", "Share ADMIN$ accessed: PSEXESVC.exe written"], bad: true, note: "The PsExec service binary is copied over the admin share (ATT&CK T1021.002 SMB/Windows Admin Shares)." },
      { f: ["14:22:11", "System", "7045", "—", "—", "Service installed: PSEXESVC (C:\\Windows\\PSEXESVC.exe)"], bad: true, note: "PsExec installs itself as a service to run commands (T1569.002 Service Execution)." },
      { f: ["14:22:12", "Security", "4688", "it-admin2", "—", "Process created: cmd.exe (parent PSEXESVC.exe)"], bad: true, note: "A remote shell spawned by the PsExec service." },
      { f: ["14:22:15", "Security", "4688", "it-admin2", "—", "Process created: whoami.exe /all"], bad: true, note: "Discovery: the attacker checks whose privileges they hold." },
      { f: ["14:22:21", "Security", "4688", "it-admin2", "—", "Process created: net.exe group \"Domain Admins\" /domain"], bad: true, note: "Discovery: listing domain admins to pick the next target (T1069.002 Domain Groups)." },
      { f: ["14:23:02", "Security", "4688", "it-admin2", "—", "Process created: reg.exe save HKLM\\SAM C:\\Windows\\Temp\\s.hiv"], bad: true, note: "Credential dumping: saving the SAM hive to crack local hashes offline (T1003.002)." },
      { f: ["14:30:00", "Security", "4624", "jsmith", "WS-031 (10.0.2.77)", "Logon type 3 (network)"], note: "A user opening the reports file share on this server. Routine." }
    ],
    tasks: [
      { q: "What activity does this log show?", o: ["Lateral movement with PsExec using valid admin credentials, then discovery and credential dumping", "A scheduled backup job running", "Kerberoasting of service accounts", "Ransomware encrypting the server"], a: 0,
        x: "ADMIN$ access, the PSEXESVC service install and a child cmd.exe are the PsExec signature. What happened next (whoami, enumerating Domain Admins, saving the SAM hive) is attacker behavior, not an admin doing normal work." },
      { q: "What should the analyst do first?", o: ["Isolate WS-022 and APP-SRV03, disable it-admin2, and hunt for PSEXESVC on other hosts", "Email it-admin2 to ask whether this was them", "Uninstall PsExec from all admin workstations", "Restore APP-SRV03 from last night's backup"], a: 0,
        x: "The attacker has working admin credentials and is moving toward domain admin, so contain both hosts and the account, then scope the spread. If you need to verify with the user, do it out of band, because the attacker may be reading their email. Uninstalling tools and restoring a backup don't remove the attacker's access." }
    ],
    debrief: "Valid-account lateral movement is hard to stop by blocking tools. Detect the chain instead: an admin network logon from a workstation, then 5145 on ADMIN$, then 7045 for a new service, then discovery commands. Reduce the risk with tiered admin accounts and LAPS."
  },
  {
    id: "lab-kerberoasting", d: "ir", title: "A burst of service tickets", source: "Domain controller Security log · DC01",
    brief: "A detection rule fired on DC01 for unusual Kerberos ticket activity. Review the Kerberos events for the day.",
    cols: ["Time", "Event ID", "Account", "Service name", "Client address", "Ticket encryption"],
    rows: [
      { f: ["08:52:10", "4768", "tlee@CORP.EXAMPLE", "krbtgt", "::ffff:10.0.2.45", "0x12 (AES256)"], note: "tlee gets a ticket-granting ticket at morning logon from their own workstation, WS-045. Normal." },
      { f: ["09:12:03", "4769", "jsmith@CORP.EXAMPLE", "FS01$", "::ffff:10.0.2.31", "0x12 (AES256)"], note: "A user opening a file share. Modern services use AES tickets. Normal." },
      { f: ["11:03:15", "4769", "tlee@CORP.EXAMPLE", "svc_sql", "::ffff:10.0.2.45", "0x17 (RC4-HMAC)"], bad: true, note: "A service ticket for a service account, using RC4 encryption. RC4 tickets are much faster to crack offline, so attack tools ask for them on purpose." },
      { f: ["11:03:15", "4769", "tlee@CORP.EXAMPLE", "svc_backup", "::ffff:10.0.2.45", "0x17 (RC4-HMAC)"], bad: true, note: "Same second, a different service account, RC4 again." },
      { f: ["11:03:16", "4769", "tlee@CORP.EXAMPLE", "svc_web", "::ffff:10.0.2.45", "0x17 (RC4-HMAC)"], bad: true, note: "tlee has no reason to use these services. The tool is requesting a ticket for every account with an SPN." },
      { f: ["11:03:16", "4769", "tlee@CORP.EXAMPLE", "svc_sharepoint", "::ffff:10.0.2.45", "0x17 (RC4-HMAC)"], bad: true, note: "Kerberoasting (ATT&CK T1558.003): any domain user can request these tickets, then crack the service account's password offline without generating more logs." },
      { f: ["11:03:17", "4769", "tlee@CORP.EXAMPLE", "svc_monitor", "::ffff:10.0.2.45", "0x17 (RC4-HMAC)"], bad: true, note: "Five service accounts in two seconds. No human works that fast." },
      { f: ["11:20:44", "4769", "akim@CORP.EXAMPLE", "SQL01$", "::ffff:10.0.2.60", "0x12 (AES256)"], note: "A user connecting to the SQL server with an AES ticket. Normal." },
      { f: ["11:21:02", "4769", "rpatel@CORP.EXAMPLE", "svc_reports", "::ffff:10.0.2.77", "0x17 (RC4-HMAC)"], note: "A decoy: a finance user opening the legacy reporting app they use every day, which only supports RC4. One RC4 ticket for a service the user really uses isn't Kerberoasting. It's still worth migrating svc_reports to AES." },
      { f: ["16:47:30", "4768", "svc_sql@CORP.EXAMPLE", "krbtgt", "::ffff:10.0.2.45", "0x12 (AES256)"], bad: true, note: "Hours later, svc_sql logs on from tlee's workstation. A service account should only authenticate from its own server. Its password was cracked and is now being used." },
      { f: ["16:47:31", "4769", "svc_sql@CORP.EXAMPLE", "FS01$", "::ffff:10.0.2.45", "0x12 (AES256)"], bad: true, note: "The stolen svc_sql identity is used to reach the file server, something the SQL service never does." }
    ],
    tasks: [
      { q: "What attack does this log show?", o: ["Kerberoasting: tlee requested RC4 service tickets to crack offline, and svc_sql's password was cracked and used", "A golden ticket attack with a forged TGT", "AS-REP roasting of accounts that don't require pre-authentication", "Pass-the-ticket with a ticket stolen from LSASS"], a: 0,
        x: "A burst of 4769 requests for many service accounts with RC4 encryption, followed by a service account logging on from that same workstation, is Kerberoasting. AS-REP roasting shows up as 4768 events for accounts without pre-authentication, not as 4769 service tickets. A golden ticket would let the attacker skip the DC for ticket requests entirely." },
      { q: "What should the analyst do first?", o: ["Reset svc_sql to a long random password (or move it to a gMSA), isolate WS-045, investigate tlee's account, and review what svc_sql accessed", "Reset the krbtgt password twice", "Block Kerberos port 88 at the internal firewall", "Remove the SPNs from every service account"], a: 0,
        x: "The cracked svc_sql password is in use right now, so contain it and the workstation it's coming from, then scope the damage. Resetting krbtgt twice is the fix for golden tickets. Blocking port 88 breaks domain authentication, and removing SPNs breaks the services without removing the attacker." }
    ],
    debrief: "Root cause: service accounts with human-chosen passwords that can be cracked, and RC4 still allowed. Fix: use group Managed Service Accounts (gMSA) or 25+ character random passwords, and enforce AES-only Kerberos. Detect it by alerting when one account requests many 4769 tickets with encryption type 0x17 in a short window, or plant a honeypot account with an SPN that nobody should ever request."
  },
  {
    id: "lab-vuln-report", d: "rc", title: "The weekly vulnerability report", source: "Vulnerability tracker export · week 42",
    ask: "Click every finding that must be escalated in this week's report",
    brief: "You're preparing this week's vulnerability report for the CISO. Remediation policy: anything in CISA's Known Exploited Vulnerabilities (KEV) catalog within 14 days, whatever its score. Otherwise Critical (9.0+) within 15 days, High (7.0-8.9) within 30 and Medium (4.0-6.9) within 90. An approved risk exception with compensating controls is on track until it expires. Escalate any SLA breach, any finding without an owner, any expired exception and any finding that keeps coming back.",
    cols: ["ID", "Asset", "Finding", "CVSS", "KEV", "Days open", "Status"],
    rows: [
      { f: ["V-1041", "vpn-gw01 (internet-facing)", "VPN appliance pre-auth remote code execution", "9.8", "Yes", "21", "Open: waiting for vendor maintenance window"], bad: true, note: "The worst finding on the list: KEV-listed, Critical, reachable from the internet and past both the 14-day KEV and 15-day Critical deadlines. Waiting for a routine window isn't acceptable here." },
      { f: ["V-1043", "web-shop01", "TLS 1.0 still enabled", "5.3", "No", "40", "Open: change scheduled for day 60"], note: "Medium, 40 days into a 90-day SLA, with a fix scheduled. On track." },
      { f: ["V-1047", "hr-db02", "Database authentication bypass", "8.8", "No", "45", "Open: no owner assigned"], bad: true, note: "High finding 15 days past its 30-day SLA, and nobody owns it. A finding without an owner never gets fixed, so this needs escalation for both reasons." },
      { f: ["V-1050", "mri-ws03", "Operating system past end of support", "9.0", "No", "120", "Exception RX-12 approved: isolated VLAN, expires in 60 days"], note: "Looks alarming, but it's a vendor-controlled medical system (the proprietary systems inhibitor) with an approved, unexpired exception and compensating controls. Report it as accepted risk, not a breach." },
      { f: ["V-1052", "print-srv01", "Print spooler privilege escalation", "7.8", "Yes", "18", "Open"], bad: true, note: "The trap: at 7.8 it's still inside the 30-day High SLA, but it's KEV-listed, so the 14-day deadline applies and it's 4 days late. Known exploitation outranks the CVSS band." },
      { f: ["V-1055", "dev-test07", "Apache HTTP Server remote code execution", "9.8", "No", "6", "Closed: false positive verified (host runs IIS, evidence attached)"], note: "A scary score, but the finding was checked and shown not to apply, with evidence. Closed false positives don't need escalation." },
      { f: ["V-1058", "erp-app01", "Weak SSH ciphers allowed", "5.9", "No", "95", "Open: ticket in backlog"], bad: true, note: "Medium, but 5 days past its 90-day SLA. Lower severity doesn't exempt it from the policy." },
      { f: ["V-1060", "pos-* (40 terminals)", "SMB signing not required", "6.5", "No", "3", "Reopened: third time this year"], bad: true, note: "Within SLA on paper, but this is the third recurrence after rebuilds. That points to the base image, which is a reporting item in its own right." },
      { f: ["V-1062", "file-srv03", "SMBv1 enabled", "8.1", "No", "12", "Open: fix scheduled this weekend"], note: "High, 12 days into a 30-day SLA, with the fix scheduled. On track." },
      { f: ["V-1065", "plant-plc02", "PLC firmware denial of service", "7.5", "No", "200", "Exception RX-07 expired 10 days ago"], bad: true, note: "An exception is only valid until it expires. Once it lapses, the finding is out of policy until the risk owner renews it or it's fixed." },
      { f: ["V-1068", "mail01", "Mail server remote code execution", "9.1", "No", "9", "Patched: awaiting verification rescan"], note: "Critical, but patched on day 9 and waiting for a rescan to confirm, well inside 15 days. On track." }
    ],
    tasks: [
      { q: "Which finding belongs at the top of the report to leadership?", o: ["V-1041, the KEV-listed RCE on the internet-facing VPN gateway, past its deadline", "V-1055, because it has the highest CVSS score on the list", "V-1050, because the operating system is out of support", "V-1065, because it has been open the longest"], a: 0,
        x: "Prioritize by real risk: known exploitation (KEV), exposure to the internet, severity and how overdue it is. V-1041 has all four. V-1055 has the same score but is a verified false positive, and V-1050 is covered by an approved exception." },
      { q: "What should the analyst do first about V-1041?", o: ["Escalate now to the system owner and CISO and push for an emergency change or an interim mitigation, not wait for the weekly report", "Mark it as accepted risk on the owner's behalf until the vendor window", "Leave it in the weekly report and let the normal cycle handle it", "Lower its priority because a maintenance window is already planned"], a: 0,
        x: "An actively exploited flaw on an internet-facing device can't wait for a routine report or window. An analyst can't accept risk for the business; only the risk owner can. Escalate now and propose interim mitigations, such as the vendor's workaround or restricting access to the portal." },
      { q: "What does the repeated reopening of V-1060 most likely mean?", o: ["The golden image used to rebuild the terminals doesn't include the fix", "The scanner is producing false positives", "The SLA for Medium findings is too short", "The terminals need an approved risk exception"], a: 0,
        x: "A finding that returns after every rebuild means the fix never reached the source. Update the base image or configuration baseline, and track the recurrence rate as a program metric." }
    ],
    debrief: "Root cause of a weak report: findings tracked by CVSS alone, without owners or exception expiry. Prioritize with threat context (KEV, EPSS), exposure and asset criticality, give every finding an owner and due date, review exceptions before they lapse, and fix recurring findings at the baseline. Report the trends leaders need: SLA compliance by severity, mean time to remediate, open exceptions and recurrence rate."
  }
];
