export const REQUIRED_PUBLICATION_GATES = Object.freeze([
  'rights_source_verified',
  'redistribution_allowed',
  'all_model_dependencies_resolved',
  'source_orientation_applied',
  'back_face_policy_applied',
  'texture_embedding_verified',
  'canonical_view_visual_qa_passed',
  'independent_scale_qa_passed',
  'attribution_display_verified',
]);

export function validatePublicationContract(contract) {
  const gates = contract?.publication_gates;
  if (!Array.isArray(gates) || gates.length === 0) throw new Error('publication contract must declare the exact non-empty publication gate set');
  const unique = new Set(gates);
  const missing = REQUIRED_PUBLICATION_GATES.filter((gate) => !unique.has(gate));
  const unexpected = [...unique].filter((gate) => !REQUIRED_PUBLICATION_GATES.includes(gate));
  if (unique.size !== gates.length || missing.length || unexpected.length || gates.length !== REQUIRED_PUBLICATION_GATES.length) {
    throw new Error(`publication contract gate set mismatch; missing=[${missing.join(',')}], unexpected=[${unexpected.join(',')}], duplicates=${gates.length - unique.size}`);
  }
  return gates;
}
