export function perspectiveFovs(verticalFovDeg, aspect) {
  if (!(verticalFovDeg > 0 && verticalFovDeg < 180)) throw new Error("verticalFovDeg must be between 0 and 180");
  if (!(aspect > 0)) throw new Error("aspect must be positive");
  const vertical = verticalFovDeg * Math.PI / 180;
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * aspect);
  return {vertical, horizontal, limiting: Math.min(vertical, horizontal)};
}

export function fitSphereDistance({radius, verticalFovDeg, aspect, margin}) {
  if (!(radius > 0)) throw new Error("radius must be positive");
  if (!(margin >= 1)) throw new Error("margin must be at least 1");
  const {limiting} = perspectiveFovs(verticalFovDeg, aspect);
  return radius / Math.sin(limiting / 2) * margin;
}
