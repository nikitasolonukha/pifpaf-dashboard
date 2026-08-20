# Project review rules

## Security
- Validate all user input at API boundaries.
- Flag auth and permission bypass.
- Flag insecure session handling, missing authorization, and risky client-side auth assumptions.
- Flag raw SQL, command execution, template injection, SSRF, path traversal, unsafe deserialization, and unsafe file handling.
- Flag secret exposure in code, config, tests, docs, examples, and logs.
- Flag weak crypto usage and insecure defaults.

## Dependencies and config
- Flag risky dependencies, vulnerable packages, insecure Dockerfiles, insecure CI config, and missing security headers where relevant.
- Prefer concrete remediation steps.

## Architecture
- Prefer minimal diffs over rewrites.
- Reuse existing service boundaries.
- Flag duplicate logic and dangerous shortcuts.

## Output
- Be concrete.
- If you flag an issue, propose an exact remediation and a verification step.
