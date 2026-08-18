# Spatial Twin — existing-building capture strategy

## Thesis

Product Twin answers:
> What real product can we put into this design?

Spatial Twin answers:
> What physically exists here right now?

Together:
> Scan the existing building → understand its rooms/surfaces/openings → redesign it → insert Product Twins → compare existing vs proposed → price the renovation → quote/order.

## Why this materially expands the company

New build:
plot → design → Product Twins → quote/build

Existing building:
scan → Spatial Twin → renovation design → Product/Material Twins → quote/order

This adds:
- resale homes
- renovation
- commercial fit-outs
- offices
- restaurants
- hotels
- retail stores
- furnished rentals
- asset inventory / facilities workflows

## Recommended three-stage capture architecture

### Stage A — Polycam Bridge (do first)
User scans with Polycam.
Polycam workspace API/webhooks feed captures into our dashboard.
We map each capture to our project using `externalId`.
We request:
- GLB/glTF for realtime visualization
- floorplan JSON/DXF/CSV where available
- thumbnail/video for review
- optional point clouds for heavier downstream workflows

Pros:
- no scanner R&D
- immediate professional capture quality
- broad export formats
- webhooks / API already exist

Constraint:
- Polycam Content Management API currently requires Enterprise + API add-on.
- Capture UX remains in Polycam rather than fully inside our branded app.

### Stage B — Product Twin Capture iOS app
Build a focused branded iPhone/iPad app using Apple RoomPlan + ARKit LiDAR.

The scanner needs only our use case:
1. sign in / select project
2. scan room(s)
3. auto-name room / level
4. capture optional photos
5. upload CapturedRoom / USDZ / metadata
6. open project immediately in dashboard

This is much easier than cloning every Polycam feature because Apple RoomPlan already manages the room-scanning session and lets apps provide a fully custom scanning UI through RoomCaptureSession.

### Stage C — advanced capture
Only later:
- large spaces
- higher fidelity raw LiDAR mesh
- point clouds
- photogrammetry / object capture
- Gaussian splats
- Android
- scan-to-BIM reconstruction
- automatic MEP / condition / defect recognition

## Spatial Twin object model

Project
  ↓
Spatial Twin (capture/version)
  ↓
Level
  ↓
Space / Room
  ↓
Surface / Opening / Existing object
  ↓
Renovation state
     retained
     removed
     replaced
     new

Product Twin placements attach to the proposed renovation state.

## Crucial UI concept

Every project has a view switch:

EXISTING  ←→  PROPOSED

User can ask:
- "Remove this wall."
- "Keep the kitchen but replace flooring."
- "Turn this shop into a restaurant."
- "Furnish the office for 40 people."
- "Show renovation under €120k."
- "Keep everything except bathrooms."
- "Give me the rental-ready version."

The AI edits the Spatial Twin and adds/removes Product/Material Twins.

## Strong commercial loop

Existing villa scanned:
187 m² floor
42 m² bathroom walls
8 internal doors
14 light fittings
1 kitchen
...

AI proposal:
new stone / tile / lights / furniture / sanitaryware

Then:
EXISTING TAKE-OFF
→ DEMOLITION TAKE-OFF
→ NEW MATERIAL TAKE-OFF
→ PRODUCT PACKAGE
→ QUOTE / ORDER

This is a much more serious renovation platform than a visual room decorator.
