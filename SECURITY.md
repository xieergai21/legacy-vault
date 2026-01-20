# Security Policy

Legacy Vault takes security seriously. This document outlines our security practices and how to report vulnerabilities.

---

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.**

### How to Report

Email: **security@legacyvault.io** (coming soon)

Include in your report:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### What to Expect

| Timeline | Action |
|----------|--------|
| 24 hours | Acknowledgment of your report |
| 72 hours | Initial assessment and severity classification |
| 7 days | Detailed response with remediation plan |
| 90 days | Public disclosure (coordinated with reporter) |

We ask that you:
- Give us reasonable time to fix issues before public disclosure
- Make a good faith effort to avoid privacy violations and data destruction
- Do not exploit vulnerabilities beyond what's necessary to demonstrate them

---

## Bug Bounty Program

We reward responsible disclosure of security vulnerabilities.

### Scope

**In Scope:**
- Smart contracts (AssemblyScript)
- Frontend application security
- Encryption implementation
- Wallet integration vulnerabilities

**Out of Scope:**
- Third-party services (Arweave, CoinGecko API)
- Social engineering attacks
- Physical attacks
- Denial of service attacks
- Issues already known or reported

### Reward Tiers

| Severity | Impact | Reward |
|----------|--------|--------|
| **Critical** | Direct loss of funds, bypass of inheritance logic | Up to $5,000 |
| **High** | Unauthorized access to encrypted files, privilege escalation | Up to $2,000 |
| **Medium** | Information disclosure, minor logic flaws | Up to $500 |
| **Low** | Best practice violations, minor issues | Public recognition |

### Severity Guidelines

**Critical:**
- Drain vault funds without authorization
- Claim inheritance without being a registered heir
- Bypass check-in mechanism to prevent triggering
- Decrypt files without proper keys

**High:**
- Modify vault configuration without owner authorization
- Access encrypted file metadata inappropriately
- Prevent heirs from claiming triggered inheritance
- DoS attacks on specific vaults

**Medium:**
- Information leakage about vault contents or heirs
- Minor access control issues
- Incorrect event emissions

**Low:**
- Gas optimization opportunities
- Code quality issues
- Documentation errors

---

## Security Measures

### Smart Contract Security

- [ ] Internal code review
- [ ] External audit (planned)
- [ ] Formal verification (planned)
- [ ] Immutable deployment (no admin keys)

### Frontend Security

- Client-side encryption (keys never leave browser)
- No sensitive data in localStorage
- Content Security Policy headers
- Subresource Integrity for dependencies

### Operational Security

- No backend servers holding user data
- Decentralized file storage (Arweave)
- Open source code for verification

---

## Known Limitations

We believe in transparency. These are known limitations, not vulnerabilities:

1. **Key management is user's responsibility** — If heirs lose their private keys, inheritance cannot be recovered
2. **Encryption key sharing** — Owners must securely share file decryption keys with heirs off-chain
3. **Massa network dependency** — Protocol relies on Massa blockchain availability
4. **Check-in responsibility** — Owners must remember to check in; there are no automated reminders

---

## Security Contacts

- Security issues: security@legacyvault.io
- General inquiries: hello@legacyvault.io

---

## PGP Key

For sensitive communications, use our PGP key:

```
(PGP key will be published here)
```

---

## Acknowledgments

We thank the following security researchers for their responsible disclosures:

*No reports yet — you could be first!*

---

## Audit Reports

| Auditor | Date | Scope | Status | Report |
|---------|------|-------|--------|--------|
| TBD | Q1 2025 | Smart Contracts | Planned | — |

---

*This security policy is effective as of January 2025 and may be updated periodically.*
