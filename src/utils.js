/** The values `obj` holds at `keys`, in that order. */
function values(obj, keys) {
  return keys.map((key) => obj[key]);
}

export default values;
