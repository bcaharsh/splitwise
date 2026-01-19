export function randomgenerator(num) {
  let result;
  const characters = "abcdefghijklmnopqrstuvwxyz1234567890";
  for (let i = 0; i < num; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}
