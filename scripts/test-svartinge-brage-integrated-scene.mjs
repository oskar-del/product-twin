import assert from "node:assert/strict";
import fs from "node:fs";
import {buildIntegratedScene} from "./build-svartinge-brage-integrated-scene.mjs";

let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks += 1; };
const scene = buildIntegratedScene();

check(scene.scene_version === "svartinge-neighbourhood-scene/v0.3", "scene version promoted to v0.3");
check(scene.project_status.selected_house_profile === "BRAGE_SE_SVARTINGE_54_28_HOUSE_V02", "BRAGE profile selected");
check(!scene.elements.some(element => element.id === "HOUSE_SLAB"), "placeholder house removed");
check(scene.elements.some(element => element.id === "HOUSE_BAR"), "BRAGE house bar added");
check(scene.elements.some(element => element.id === "HOUSE_WING_N"), "BRAGE north wing added");
check(scene.elements.some(element => element.id === "ROOM_GLANRUMMET"), "Glanrummet added");
check(scene.elements.filter(element => ["HOUSE_BAR", "HOUSE_WING_N", "ROOM_GLANRUMMET"].includes(element.id)).every(element => element.evidence_class === "CONCEPT"), "house remains concept evidence");
check(scene.elements.every(element => element.geometry.primitive !== "WALL_SEGMENT"), "unsupported wall segments normalized");
check(scene.elements.every(element => Array.isArray(element.limitations)), "all renderable claims state limitations");
check(scene.legal_claim_policy.blocked_claims.includes("LEGAL_BOUNDARY"), "legal boundary remains blocked");
check(scene.legal_claim_policy.blocked_claims.includes("FINISHED_FLOOR_LEVEL"), "finished floor remains blocked");
check(scene.integration.blocked_promotions.includes("G3_AVATAR"), "G3 remains blocked");
check(scene.integration.blocked_promotions.includes("CURRENT_COMMERCE"), "current commerce remains blocked");
check(scene.navigation.find(stage => stage.id === "ROOM")?.on_enter_open_element === "ROOM_GLANRUMMET", "room navigation targets Glanrummet");
check(scene.elements.find(element => element.id === "ROOM_GLANRUMMET")?.linked_experience?.state === "DESIGN_STUDY_NOT_PROCUREMENT_READY", "commerce handoff is visibly non-procurement");
const spatialViewer = fs.readFileSync("prototype/svartinge-neighbourhood/index.html", "utf8");
const showroomViewer = fs.readFileSync("prototype/showroom-living/index.html", "utf8");
const showroomComposition = JSON.parse(fs.readFileSync("data/showrooms/svartinge-glanrummet-living-room-v0.2.json", "utf8"));
const commerceHandoff = JSON.parse(fs.readFileSync("data/integration/svartinge-glanrummet-commerce-v0.2.json", "utf8"));
check(spatialViewer.includes("neighbourhood-scene-brage-v0.3.json"), "viewer exposes BRAGE scene variant");
check(spatialViewer.includes("s.on_enter_open_element"), "viewer opens the stage-bound room");
check(showroomViewer.includes("svartinge-glanrummet"), "showroom discloses Svärtinge study context");
check(showroomViewer.includes("svartinge-glanrummet-living-room-v0.2.json"), "showroom consumes the Svärtinge-specific composition manifest");
check(showroomViewer.includes("Sweden supply, tax, freight, delivery and checkout are not evaluated"), "Svärtinge RFQ disclosure is explicit");
check(showroomViewer.includes("Concept-only forested Lake Glan horizon"), "Svärtinge room renders a disclosed local concept context");
check(showroomViewer.includes("DESIGN STUDY BOM — Glanrummet · not a quote"), "Svärtinge copy output cannot present itself as an RFQ");
check(showroomViewer.includes("Open merchant product page →"), "Svärtinge merchant action avoids live-offer/RFQ wording");
check(showroomViewer.includes("Sweden commerce"), "Svärtinge commerce display is destination-labelled");
check(showroomViewer.includes("Comparable Sweden subtotal: not evaluated"), "Svärtinge mixed-currency subtotal is withheld");
check(showroomComposition.room.size_m.join("x") === "7x3x7", "Glanrummet composition matches the BRAGE concept-room envelope");
check(Object.keys(showroomComposition.placement_overrides).length === 7, "all seven placements are Svärtinge-specific");
check(showroomComposition.appearance_profile.exact_finish_claim === false, "appearance cues cannot claim exact finishes");
check(commerceHandoff.destination.comparable_subtotal_state === "WITHHELD", "Sweden comparable subtotal remains withheld");
check(commerceHandoff.forbidden.some(rule => rule.includes("mixed USD and EUR")), "mixed-currency Sweden total is explicitly forbidden");

for (const mutation of [
  value => { value.scene_version = "wrong"; },
  value => { value.elements = value.elements.filter(element => element.id !== "HOUSE_SLAB"); value.scene_version = "svartinge-neighbourhood-scene/v0.1"; },
  value => { value.elements.find(element => element.id === "HOUSE_BAR").geometry.height = undefined; }
]) {
  const base = structuredClone(scene);
  mutation(base);
  if (base.scene_version === "wrong") {
    assert.throws(() => buildIntegratedScene({base}), /requires v0\.2 base/);
  } else {
    assert.throws(() => buildIntegratedScene({base}), /requires v0\.2 base|removal target is missing/);
  }
  checks += 1;
}

console.log(`Svärtinge BRAGE integration PASS (${checks} checks)`);
