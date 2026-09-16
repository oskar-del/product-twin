# Svärtinge demo runbook — developer meeting 2026-09-17

**Run it from localhost, never from the artifact link.** The REALISTIC orthophoto is a live Norrköping WMS
fetch; the published artifact (claude.ai) blocks external fetches, so the artifact always shows the flat
version. Localhost shows the real thing.

## Start (one command, keep the terminal open)
    cd "/Users/oskarpeterson/Documents/AI/product twin" && python3 -m http.server 8765
Open: http://localhost:8765/repo-spatial-studio/prototype/svartinge-neighbourhood/index.html

## Script (8 minutes)
1. Front door — read the four numbers aloud: 1 936,8 m² AUTHORITATIVE (Lantmäteriet), 153 official
   footprints, 13.5 m fall, ~43 m above Glan. Point at the evidence chips: this page never types a number.
2. "Enter the 3D twin" → lands in REALISTIC: real ortho, real cadastral lines, official buildings extruded.
   Orbit once. Press 1 for INTELLIGENCE (evidence colours), 3 for COMPARE (split), back to 2.
3. Stage 3 "Plot outlook" → Glan sightlines (the reported view, shown on the land).
4. Stage 4 "Concept house on plot" → BRAGE's Vinkelhuset mot Glan is mounted (L-plan bar + north wing).
   Say CONCEPT out loud; the panel says so too. Switch to Björkalund/Rimsjö in the dock to show alternates.
5. Drag the solar slider (bottom) — derived shadow moves; 21 June.
6. Skip stage 7 (Room) unless asked about commerce — it opens the shoppable Newport room (real BUY links,
   but grey proxy geometry; mechanics demo only).

## Do not claim
No entitlement, setback or FFL. Vinkelhuset is a concept massing, not developed drawings. 2/18 legal gates.

## State (2026-09-16, Brain)
Spatial commit c91a8f4b8a: land in REALISTIC, VH mounted by default, Room → shoppable room.
Known rough edges (pinned to Spatial): building-orbit camera framed for a 13 m house (20 m bar too close);
wing roof is a pyramid placeholder; no terrace/vindficka; INTELLIGENCE terrain is flat green.
