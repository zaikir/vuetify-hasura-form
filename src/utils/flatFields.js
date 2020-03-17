export function flat(node) {
  if (node.fields) {
    return (node.fields || []).map(flat);
  }
  return node;
}

export default (fields) => fields.map(flat).flat(Number.POSITIVE_INFINITY);
