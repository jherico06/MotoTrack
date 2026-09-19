import { Platform } from 'react-native';
import * as ExpoCrypto from 'expo-crypto';

function ensureSubtleCrypto() {
  if (typeof globalThis === 'undefined') return;
  const cryptoObj = globalThis.crypto || {};
  if (!globalThis.crypto) {
    globalThis.crypto = cryptoObj;
  }

  if (typeof cryptoObj.getRandomValues !== 'function') {
    cryptoObj.getRandomValues = (typedArray) => {
      const random = ExpoCrypto.getRandomBytes(typedArray.length);
      typedArray.set(random);
      return typedArray;
    };
  }

  if (cryptoObj.subtle && typeof cryptoObj.subtle.digest === 'function') {
    return;
  }

  cryptoObj.subtle = {
    digest: async (algorithm, data) => {
      const name = typeof algorithm === 'string' ? algorithm : algorithm?.name;
      const algo =
        name === 'SHA-256' || name === 'SHA256'
          ? ExpoCrypto.CryptoDigestAlgorithm.SHA256
          : name === 'SHA-1'
            ? ExpoCrypto.CryptoDigestAlgorithm.SHA1
            : name === 'SHA-512'
              ? ExpoCrypto.CryptoDigestAlgorithm.SHA512
              : ExpoCrypto.CryptoDigestAlgorithm.SHA256;
      const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
      return ExpoCrypto.digest(algo, bytes);
    },
  };
}

if (Platform.OS !== 'web') {
  try {
    ensureSubtleCrypto();
  } catch (e) {
    console.warn('Failed to polyfill WebCrypto for Google PKCE:', e);
  }
}
