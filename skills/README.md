# Skills

## `circomkit`

An agent skill for **using Circomkit** — the `circomkit.json` config, the CLI
lifecycle (compile → setup → witness → prove → verify), backends, and the
testing API. Tooling only; for writing the Circom circuits themselves, see the
`circom` skill and book in [circom101](https://github.com/erhant/circom101).

```
circomkit/
├── SKILL.md                  # hub: lifecycle, config, testing, backends
└── references/
    └── reference.md          # full config schema, CLI, backends, library APIs
```

## Using it

- **Claude Code / Cowork:** copy the `circomkit/` folder into your skills
  directory (e.g. `.claude/skills/`), or install it via a plugin/marketplace.
- **Any agent:** point the assistant at `circomkit/SKILL.md`.

Assumes `circom` and `snarkjs` are on PATH; `circomkit doctor` checks this.
