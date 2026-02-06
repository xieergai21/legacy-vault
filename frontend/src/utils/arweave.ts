import Arweave from 'arweave';

const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
});

// Генерация ключа шифрования
export async function generateEncryptionKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// Экспорт ключа в base64
export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

// Импорт ключа из base64
export async function importKey(base64Key: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// Шифрование данных
export async function encryptData(data: ArrayBuffer, key: CryptoKey): Promise<{ encrypted: ArrayBuffer; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    data
  );
  return { encrypted, iv };
}

// Дешифрование данных
export async function decryptData(encrypted: ArrayBuffer, key: CryptoKey, iv: Uint8Array): Promise<ArrayBuffer> {
  return await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    encrypted
  );
}

// Скачивание с Arweave
export async function downloadFromArweave(txId: string): Promise<ArrayBuffer> {
  const response = await fetch(`https://arweave.net/${txId}`);
  if (!response.ok) {
    throw new Error('Failed to download from Arweave');
  }
  return await response.arrayBuffer();
}

// Подготовка файлов к загрузке (шифрование + упаковка)
export async function prepareFilesForUpload(files: File[]): Promise<{
  encryptedBundle: Uint8Array;
  encryptionKey: string;
  iv: string;
  metadata: { name: string; type: string; size: number }[];
}> {
  const key = await generateEncryptionKey();
  const metadata: { name: string; type: string; size: number }[] = [];
  
  const filesData: ArrayBuffer[] = [];
  for (const file of files) {
    const data = await file.arrayBuffer();
    filesData.push(data);
    metadata.push({
      name: file.name,
      type: file.type,
      size: file.size,
    });
  }
  
  const metadataJson = JSON.stringify(metadata);
  const metadataBytes = new TextEncoder().encode(metadataJson);
  
  const totalSize = 4 + metadataBytes.length + filesData.reduce((sum, d) => sum + d.byteLength, 0);
  const bundle = new Uint8Array(totalSize);
  
  const view = new DataView(bundle.buffer);
  view.setUint32(0, metadataBytes.length, true);
  bundle.set(metadataBytes, 4);
  
  let offset = 4 + metadataBytes.length;
  for (const fileData of filesData) {
    bundle.set(new Uint8Array(fileData), offset);
    offset += fileData.byteLength;
  }
  
  const { encrypted, iv } = await encryptData(bundle.buffer, key);
  const exportedKey = await exportKey(key);
  
  return {
    encryptedBundle: new Uint8Array(encrypted),
    encryptionKey: exportedKey,
    iv: btoa(String.fromCharCode(...iv)),
    metadata,
  };
}

export { arweave };

// Загрузка на Arweave через наш backend
const BACKEND_URL = 'https://api.legacy-vault.xyz';

export async function uploadEncryptedFile(encryptedData: Uint8Array, massaAddress: string): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(encryptedData)], { type: 'application/octet-stream' });  
  formData.append('file', blob, 'encrypted-vault.bin');
  
  const response = await fetch(`${BACKEND_URL}/api/upload`, {
    method: 'POST',
    headers: {
      'X-Massa-Address': massaAddress,
    },
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Upload failed');
  }
  
  const result = await response.json();
  console.log('File uploaded to Arweave:', result.txId);
  return result.txId;
}

// Получение файла с Arweave
export async function getEncryptedFile(txId: string): Promise<Uint8Array | null> {
  const data = await downloadFromArweave(txId);
  return new Uint8Array(data);
}
