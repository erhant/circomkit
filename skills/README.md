# Circomkit skills

Agent skill(s) that teach an AI assistant to write, test, and prove Circom
circuits with Circomkit.

## `circomkit`

A combined skill covering Circom authoring (signals, constraints, soundness) and
the Circomkit lifecycle (compile → setup → prove → verify, testing, debugging).

```
circomkit/
├── SKILL.md                         # hub: authoring rules + lifecycle
└── references/
    ├── circom-language.md           # full language reference
    ├── circomkit-reference.md       # config, CLI, backends, testing API
    └── circuit-patterns.md          # reusable patterns (comparators, bits, Merkle, …)
```

## Using it

- **Claude Code / Cowork:** copy the `circomkit/` folder into your skills
  directory (e.g. `.claude/skills/`), or install it via a plugin/marketplace.
- **Any agent:** point the assistant at `circomkit/SKILL.md` — it references the
  files under `references/` as needed (progressive disclosure).

The skill assumes `circom` and `snarkjs` are on PATH; `circomkit doctor` checks
this.
