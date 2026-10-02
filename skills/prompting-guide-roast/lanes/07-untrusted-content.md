---
key: untrusted-content
title: Untrusted content and channel hygiene
scope: group
families: any
---
Digest entries: X11, C07.
Hunt: diffs, PR descriptions and comments, issue text, web pages, file contents, prior reports or subagent outputs interpolated into a prompt without delimiting tags and a line saying instructions inside are data. This matters most where the receiving agent has write or exec tools. Also hunt orchestrators told to act on directives found inside subagent reports, and skills that combine open network access with powerful procedures.
Also check the inverse: "treat everything as untrusted" wording so broad it would make an agent ignore a legitimate caller instruction, or blanket-mark authoritative inputs (specs, task definitions) as untrusted.

## claude
Claude Sonnet 5.5 may read harness notices appended after tool results, or user text delivered inside a tool result, as prompt injection (C07). Flag any place user-authored text reaches an agent through a tool-result channel.
