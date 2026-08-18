/**
 * Evidence classes — the honesty palette.
 *
 * Every renderable claim in a twin scene carries one of these. They are not decoration:
 * the INTELLIGENCE profile colours geometry by evidence class so a viewer can see, without
 * reading anything, which parts of what they are looking at are authoritative and which are
 * concept. One definition, used by every surface.
 *
 * Pure module: no DOM, no WebGL.
 */

export const EVIDENCE_CLASSES = Object.freeze([
  "AUTHORITATIVE",
  "INDICATIVE",
  "DERIVED",
  "REPORTED_UNVERIFIED",
  "CONCEPT"
]);

/** Ordered strongest → weakest. Index doubles as a confidence rank. */
export const EVIDENCE_RANK = Object.freeze(
  Object.fromEntries(EVIDENCE_CLASSES.map((name, index) => [name, index]))
);

const PALETTE = Object.freeze({
  AUTHORITATIVE: "#176b52",
  INDICATIVE: "#c18a2d",
  DERIVED: "#497aa2",
  REPORTED_UNVERIFIED: "#a65b68",
  CONCEPT: "#735a9e"
});

const DESCRIPTION = Object.freeze({
  AUTHORITATIVE: "Issued by the governing authority or the manufacturer of record.",
  INDICATIVE: "Official-adjacent source; correct in kind, not survey-grade.",
  DERIVED: "Computed by us from a stated source with a stated method.",
  REPORTED_UNVERIFIED: "Stated by a seller, listing or third party; not checked.",
  CONCEPT: "Our proposal. Not a claim about anything that exists."
});

export function isEvidenceClass(value) {
  return typeof value === "string" && Object.hasOwn(EVIDENCE_RANK, value);
}

export function assertEvidenceClass(value, where = "evidence_class") {
  if (!isEvidenceClass(value)) {
    throw new TypeError(`${where} must be one of ${EVIDENCE_CLASSES.join(", ")} — received ${JSON.stringify(value)}`);
  }
  return value;
}

/** CSS hex, for HUD/legend/panel. */
export function evidenceCss(value) {
  return PALETTE[assertEvidenceClass(value)];
}

/** 0xRRGGBB integer, for three.js materials. */
export function evidenceHex(value) {
  return Number.parseInt(evidenceCss(value).slice(1), 16);
}

export function evidenceDescription(value) {
  return DESCRIPTION[assertEvidenceClass(value)];
}

/** Legend rows in fixed order — the UI never invents its own ordering. */
export function evidenceLegend() {
  return EVIDENCE_CLASSES.map(name => Object.freeze({
    evidence_class: name,
    css: PALETTE[name],
    hex: evidenceHex(name),
    description: DESCRIPTION[name]
  }));
}

/** The weakest evidence class present — a scene is only as strong as its softest visible claim. */
export function weakestEvidence(classes) {
  const ranks = [...classes].map(value => EVIDENCE_RANK[assertEvidenceClass(value)]);
  if (!ranks.length) throw new RangeError("weakestEvidence requires at least one class");
  return EVIDENCE_CLASSES[Math.max(...ranks)];
}
