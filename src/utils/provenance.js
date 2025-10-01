// Provenance tracking (lightweight DAG)
export const _prov = {
  enabled: true,
  pipParents: new Map(),     // pipId -> Set<pipId>
  pipToMots: new Map(),      // pipId -> Set<motId>
};

export function _provAddEdge(childPip, parentPip) {
  if (!_prov.enabled) return;
  if (!childPip || !parentPip) return;
  const cid = childPip.pipId;
  const pid = parentPip.pipId;
  if (cid == null || pid == null) return;
  let s = _prov.pipParents.get(cid);
  if (!s) { s = new Set(); _prov.pipParents.set(cid, s); }
  s.add(pid);
}

export function _provAddPipToMot(pip, motId) {
  if (!_prov.enabled) return;
  if (!pip || pip.pipId == null || motId == null) return;
  let s = _prov.pipToMots.get(pip.pipId);
  if (!s) { s = new Set(); _prov.pipToMots.set(pip.pipId, s); }
  s.add(motId);
}

export function FindAncestorPips(aPip) {
  if (!aPip || aPip.pipId == null) return [];
  const visited = new Set();
  const out = new Set();
  const stack = [aPip.pipId];
  while (stack.length > 0) {
    const cid = stack.pop();
    if (visited.has(cid)) continue;
    visited.add(cid);
    const parents = _prov.pipParents.get(cid);
    if (!parents) continue;
    for (const pid of parents) {
      if (!out.has(pid)) out.add(pid);
      if (!visited.has(pid)) stack.push(pid);
    }
  }
  return Array.from(out);
}

// UUID counter for provenance tracking
let _crux_uuid_cnt = 1;

export function getCruxUUID() {
  return '' + _crux_uuid_cnt++;
}

export function resetUUID() {
  _crux_uuid_cnt = 1;
}
