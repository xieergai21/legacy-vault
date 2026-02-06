const bytes = new Uint8Array([
  65, 85, 49, 90, 86, 116, 50, 57, 65, 106,
  105, 71, 53, 116, 72, 105, 85, 84, 119, 99,
  68, 111, 82, 81, 111, 104, 97, 115, 109, 70,
  100, 113, 75, 69, 111, 118, 110, 109, 98, 85,
  89, 69, 86, 109, 66, 78, 74, 112, 75, 65,
  112, 74
]);

const adminAddress = new TextDecoder().decode(bytes);
console.log('Admin address:', adminAddress);
