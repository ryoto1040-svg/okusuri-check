import { useEffect, useState } from 'react';
export type PwaState = 'preparing' | 'ready' | 'failed' | 'development' | 'insecure';
export function usePwa(): PwaState {
  const [state, setState] = useState<PwaState>(import.meta.env.DEV ? 'development' : 'preparing');
  useEffect(() => {
    if (import.meta.env.DEV) return;
    if (!window.isSecureContext) {
      setState('insecure');
      return;
    }
    if (!('serviceWorker' in navigator)) {
      setState('failed');
      return;
    }
    let active = true;
    const failed = setTimeout(() => {
      if (active) setState((current) => (current === 'ready' ? current : 'failed'));
    }, 20000);
    // 以前のService Workerが有効でも、現在表示中のJS/CSSがキャッシュ済みか確認する。
    const paths = [
      ...Array.from(document.querySelectorAll<HTMLScriptElement>('script[src]')).map(
        (node) => new URL(node.src).pathname,
      ),
      ...Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).map(
        (node) => new URL(node.href).pathname,
      ),
    ];
    const channels = new Set<MessagePort>();
    const check = () => {
      const worker = navigator.serviceWorker.controller;
      if (!worker) return;
      const channel = new MessageChannel();
      channels.add(channel.port1);
      channel.port1.onmessage = (event) => {
        channel.port1.close();
        channels.delete(channel.port1);
        if (active && event.data?.ready === true) {
          clearTimeout(failed);
          setState('ready');
        }
      };
      worker.postMessage({ type: 'okusuri:offline-status', paths }, [channel.port2]);
    };
    navigator.serviceWorker.ready.then(check).catch(() => {
      if (active) setState('failed');
    });
    navigator.serviceWorker.addEventListener('controllerchange', check);
    return () => {
      active = false;
      clearTimeout(failed);
      navigator.serviceWorker.removeEventListener('controllerchange', check);
      channels.forEach((port) => port.close());
    };
  }, []);
  return state;
}
