function database(): Promise<IDBDatabase> {
  return new Promise((resolve,reject) => { const request = indexedDB.open("plano-demo-files", 1); request.onupgradeneeded = () => request.result.createObjectStore("files"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
export async function saveLocalFile(key: string, file: File) {
  const db = await database();
  try { await new Promise<void>((resolve,reject) => { const tx = db.transaction("files", "readwrite"); tx.objectStore("files").put(file, key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); }); } finally { db.close(); }
}
export async function readLocalFile(key: string): Promise<Blob | undefined> {
  const db = await database();
  try { return await new Promise((resolve,reject) => { const request = db.transaction("files").objectStore("files").get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); } finally { db.close(); }
}
