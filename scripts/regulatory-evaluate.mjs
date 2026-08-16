import fs from "node:fs/promises";

const seed = JSON.parse(await fs.readFile("config/jurisdictions/es-andalucia-seed.json", "utf8"));

function jurisdictionChain(id) {
  const byId = new Map(seed.jurisdictions.map(j => [j.id, j]));
  const chain = [];
  let current = byId.get(id);
  while (current) {
    chain.push(current.id);
    current = current.parent ? byId.get(current.parent) : null;
  }
  return chain;
}

function categoryMatches(pattern, categoryId) {
  if (pattern === categoryId) return true;
  if (pattern.endsWith(".*")) return categoryId.startsWith(pattern.slice(0, -1));
  return false;
}

export function evaluateRegulation({jurisdiction_id, category_id, stage, evidence=[]}) {
  const jurisdictions = new Set(jurisdictionChain(jurisdiction_id));
  const matches = seed.seed_rules.filter(rule => {
    if (!jurisdictions.has(rule.jurisdiction_id)) return false;
    if (stage && rule.stage !== stage) return false;
    return (rule.category_ids ?? []).some(pattern => categoryMatches(pattern, category_id));
  });

  return matches.map(rule => {
    const required = rule.required_evidence ?? [];
    const missing = required.filter(req => !evidence.includes(req));
    let state = rule.default_state ?? "REVIEW";
    if (required.length && missing.length === 0 && state === "HOLD") state = "REVIEW";
    return {
      rule_id: rule.rule_id,
      source_id: rule.source_id,
      jurisdiction_id: rule.jurisdiction_id,
      stage: rule.stage,
      state,
      missing_evidence: missing,
      professional_signoff: !!rule.professional_signoff,
      decision_logic: rule.decision_logic
    };
  });
}

if (process.argv[1]?.endsWith("regulatory-evaluate.mjs")) {
  const examples = [
    {name:"Marbella solar inverter", jurisdiction_id:"ES-MA-MARBELLA", category_id:"ENERGY.SOLAR.INVERTER", stage:"installation", evidence:[]},
    {name:"Marbella solar connection", jurisdiction_id:"ES-MA-MARBELLA", category_id:"ENERGY.SOLAR.INVERTER", stage:"connection", evidence:[]},
    {name:"Marbella facade product", jurisdiction_id:"ES-MA-MARBELLA", category_id:"ENVELOPE.FACADE", stage:"product_selection", evidence:[]}
  ];
  for (const ex of examples) {
    console.log(`\n${ex.name}`);
    console.log(JSON.stringify(evaluateRegulation(ex), null, 2));
  }
}
