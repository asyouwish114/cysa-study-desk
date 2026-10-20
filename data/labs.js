// Log analysis labs (performance-based practice). Fields:
//   id, d (domain key), title, source (log type), brief (scenario), cols (column headers),
//   rows: [{ f: [one value per column], bad: true if part of the attack, note: shown after grading }],
//   tasks: [{ q, o: 4 options, a: 0-based correct index, x: explanation }], debrief (root cause / takeaway).
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
  }
];
