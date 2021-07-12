function values(obj, keys) {
    let v = Object.values(get(obj, keys));
    return v;
  }

  export default values;