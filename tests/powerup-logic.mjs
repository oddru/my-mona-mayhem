export function makeRng(seed){
  let s = seed >>> 0;
  return function(){ s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function shouldSpawn(rng, baseChance = 0.14){
  return rng() <= baseChance;
}

export function pickSpecIndex(rng, specs){
  if (!Array.isArray(specs) || specs.length === 0) return -1;
  const idx = Math.floor(rng() * specs.length);
  return Math.min(Math.max(0, idx), specs.length - 1);
}
