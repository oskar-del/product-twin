# Product Twin Work Protocol

This repository treats provenance, geometry, supply, planning, and procurement claims as evidence-bearing product data. Apply the smallest workflow level that matches the risk; do not add ceremony that cannot change the result.

## 1. Classify the work before editing

| Level | Use for | Required separation |
| --- | --- | --- |
| L0 | Copy, comments, formatting, non-semantic refactors | Executor plus deterministic check |
| L1 | Features, schemas, adapters, UI state, geometry transforms | Planner, isolated executor, reviewer, scripted gate |
| L2 | Rights, G-level promotion, dimensions, price/stock, landed cost, planning, terrain, access, compliance | Planner, isolated executor, independent reviewer, scripted gate, recurring evidence check |

At the start of every L1/L2 workstream, run and report:

```sh
git status --short
git branch --show-current
git rev-parse --short HEAD
```

An executor must own one declared write surface. Parallel executors must use separate branches/worktrees or separate repositories. Never let two sessions edit the same checkout concurrently.

## 2. Make every rule checkable

Every acceptance rule must contain at least one of:

- a number or tolerance;
- an explicit allowed/forbidden state;
- a command that returns non-zero when the rule fails.

Before handoff, always run:

```sh
git diff --check
```

Then run the narrowest deterministic tests and validators covering the changed claims. A passing build alone is not evidence that scale, rights, supply, planning, or provenance are true.

Examples of mandatory claim gates:

- a generic `DESIGN_ASSET` must never contain SKU, GTIN, price, stock, supplier, offer, checkout, or landed-cost fields;
- G2 requires a verified envelope, orientation, floor contact, and disclosed proxy status;
- G3 requires exact-form and appearance evidence plus cleared display/derivative rights;
- current price/stock/delivery claims require source, destination, observation time, and freshness state;
- planning or access claims remain blocked until the governing authority evidence is attached.

## 3. Separate the powers

For L1/L2 work, keep four roles distinct:

1. **Planner** defines scope, evidence and acceptance rules.
2. **Executor** edits only the assigned worktree/write surface.
3. **Reviewer** inspects the diff and attempts to falsify the claims.
4. **Gate** is a deterministic script or CI job whose exit status decides promotion.

The executor may repair failures but may not waive the gate. A reviewer may recommend promotion but may not replace the gate with a prose judgement.

## 4. Treat done as a monitored state

Monitor a result for as long as consumers rely on it. Use evidence volatility rather than one universal schedule:

| Evidence | Default re-check |
| --- | --- |
| Price, stock, delivery, checkout | Daily while shown as current; again immediately before purchase |
| API/source availability and schema | Weekly and on adapter failure |
| Rights/licence | On source or licence change; before each new publication channel |
| Planning, access, regulatory | Monthly while active and on authority/document change |
| Verified geometry and static source hashes | On source-file or pipeline-version change |
| Site deployment and critical user path | After each deployment; daily only while actively operated |

A monitor must have an owner, a failure destination, a stop/renewal condition, and a machine-readable last-checked value. Do not create permanent daily checks for abandoned experiments.

## 5. Handoff contract

Every completed workstream reports:

- branch/worktree and exact commit or dirty state;
- files changed;
- commands run and their exit status;
- claims promoted, claims still blocked, and why;
- monitoring required and its expiry/renewal condition;
- merge/deployment status (never imply either happened when it did not).

