import assert from "node:assert/strict";
import fs from "node:fs";
const metric=JSON.parse(fs.readFileSync(new URL("../data/metrics/furniture-avatar-manifest-v0.1-qa.json",import.meta.url)));
assert.equal(metric.summary.assets,4);assert.equal(metric.summary.rendered_views,28);assert.equal(metric.summary.reviewed_assets,4);assert.equal(metric.summary.publicly_publishable,0);
assert.equal(metric.review_evidence,"data/evidence/furniture-avatar-manifest-v0.1-visual-review.json");assert.equal(metric.review_evidence_sha256.length,64);
for(const a of metric.assets){assert.equal(a.views.length,7);assert.equal(a.automated_checks.all_seven_views_rendered,true);assert.ok(a.automated_checks.floor_contact_error_mm<0.01);assert.ok(a.automated_checks.max_dimension_relative_error<0.001);assert.equal(a.geometry_sha256.length,64);assert.equal(a.manual_review.overall,"PASS_G2_PLANNING_QA");assert.equal(a.publication.public_allowed,false);}
console.log("furniture avatar canonical QA metric tests passed");
