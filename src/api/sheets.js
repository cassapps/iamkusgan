// Deprecated: sheets API wrapper removed. Use Firestore adapter instead.

export function deprecated() {
  throw new Error('src/api/sheets.js has been removed. Import from src/api (central selector) instead.');
}

export default { deprecated };