# Reconstruction & display authorization — Anatomic SITT products (TEMPLATE / UNSIGNED)

> **Status: DRAFT TEMPLATE.** Not a message to anyone. Nothing here is sent. This is an internal authorization form for an authorised signatory at Anatomic SITT AB to sign so the Product Twin pipeline has a rights evidence reference. No supplier/manufacturer email is ever sent without Oskar's explicit go.

---

**Rights holder:** Anatomic SITT i Norrköping AB, org. 556411-7348, Terminalgatan 1, Norrköping, Sweden ("Anatomic SITT").

**Authorized party:** Oskar Peterson / the Product Twin project ("Authorized Party").

**Subject products:** the Anatomic SITT and Zitzi products listed in Appendix A, photographed by the Authorized Party.

## Grant

Anatomic SITT grants the Authorized Party permission to:

1. **Reconstruct** 3D geometry from photographs of the Subject Products taken by or for the Authorized Party.
2. **Render** and display the resulting 3D avatars (still and interactive) for the purposes in the Scope section.
3. **Convert, optimize and store** the resulting runtime 3D assets (e.g. GLB/glTF) for those purposes.

## Scope (tick what applies)

- [ ] Internal evaluation / demonstration only.
- [ ] Display in Product Twin client demonstrations and pitch materials.
- [ ] Placement of the avatar in visualizations of real properties.
- [ ] Public web display / redistribution of the rendered avatar.
- [ ] Other: ________________________________________________

If **public redistribution** is not ticked, generated assets remain internal/runtime-only and `redistribution_allowed` stays `review` in the pipeline.

## What this does NOT grant

- No transfer of intellectual property, design rights or trademarks in the Subject Products.
- No authority over engineering interfaces, safety, medical-device conformity or CAD source data (any G4/engineering claim requires separate manufacturer CAD/spec evidence).
- No permission to represent the avatar as an official Anatomic SITT / Zitzi asset.

## Term & revocation

Effective on signature. Anatomic SITT may revoke in writing; on revocation the Authorized Party stops new public display within a reasonable period. Revocation does not retroactively void demonstrations already made in good faith.

## Appendix A — authorized subject products

| # | model | SKU / HMI / article no. | notes |
|---|---|---|---|
| 1 | | | |
| 2 | | | |

## Signatures

Anatomic SITT AB — authorised signatory:

Name: _______________________  Role: _______________________

Signature: ___________________  Date: ______________

Authorized Party:

Name: Oskar Peterson  Signature: ___________________  Date: ______________

---

**After signing:** save the scanned PDF outside Git (or reference it by URL/hash), and put that reference in the job file's `rights.evidence_refs`. Update the Subject Product's target config `rights.state` to reflect the signed scope.
