import { useEffect, useRef, useState } from 'react';
import { digits, validGtin } from '../../domain/barcode';
import { Modal } from './common';

type Stop = () => void;

interface NativeDetector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
type NativeDetectorCtor = {
  new (opts: { formats: string[] }): NativeDetector;
  getSupportedFormats?: () => Promise<string[]>;
};

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

/** The browser's built-in barcode reader (Android Chrome and some others), if it reads retail codes. */
async function nativeDetector(): Promise<NativeDetector | null> {
  const Ctor = (window as unknown as { BarcodeDetector?: NativeDetectorCtor }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    const supported = (await Ctor.getSupportedFormats?.()) ?? [];
    const formats = FORMATS.filter((f) => supported.includes(f));
    return formats.length ? new Ctor({ formats }) : null;
  } catch {
    return null;
  }
}

/** Decode with ZXing (loaded only when needed). Returns a stop function. */
async function startZxing(video: HTMLVideoElement, stream: MediaStream, onCode: (c: string) => void): Promise<Stop> {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
  const controls = await reader.decodeFromStream(stream, video, (result) => {
    if (result) onCode(result.getText());
  });
  return () => controls.stop();
}

/**
 * Scan a product barcode with the back camera. Works in the home-screen app
 * on iPhone (camera access is asked the first time). A read is accepted only
 * when its check digit is valid, and the camera stops straight away.
 */
export function BarcodeScanner(props: { onResult: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'starting' | 'scanning' | 'error'>('starting');
  const [error, setError] = useState('');
  const done = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopDecoder: Stop | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const stopAll = () => {
      cancelled = true;
      clearTimeout(timer);
      stopDecoder?.();
      stream?.getTracks().forEach((t) => t.stop());
    };
    const found = (raw: string) => {
      const code = digits(raw);
      if (done.current || !validGtin(code)) return;
      done.current = true;
      try {
        navigator.vibrate?.(80);
      } catch {
        /* not supported */
      }
      stopAll();
      props.onResult(code);
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled || !video.current) return stopAll();
        const v = video.current;
        v.srcObject = stream;
        v.setAttribute('playsinline', 'true'); // iOS: play inline, not full screen
        v.muted = true;
        await v.play().catch(() => undefined);
        setStatus('scanning');
        const native = await nativeDetector();
        if (native) {
          const tick = async () => {
            if (cancelled) return;
            try {
              const hits = await native.detect(v);
              if (hits[0]) found(hits[0].rawValue);
            } catch {
              /* frame not ready */
            }
            if (!cancelled && !done.current) timer = setTimeout(tick, 150);
          };
          tick();
        } else {
          stopDecoder = await startZxing(v, stream, found);
        }
      } catch (e) {
        if (cancelled) return;
        const name = (e as { name?: string }).name;
        setStatus('error');
        setError(
          name === 'NotAllowedError'
            ? 'Camera access is blocked. On iPhone: Settings > Privacy & Security > Camera, or remove and re-add the app to the home screen to be asked again. You can also type the number.'
            : name === 'NotFoundError'
              ? 'No camera found on this device. Type the number under the barcode instead.'
              : 'The camera could not start. Type the number under the barcode instead.',
        );
      }
    })();
    return stopAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal title="Scan barcode" onClose={props.onClose}>
      <div className="scanner">
        <video ref={video} playsInline muted aria-label="Camera preview" />
        {status !== 'error' && <div className="scan-frame" aria-hidden="true" />}
      </div>
      {status === 'starting' && <p className="hint">Starting the camera…</p>}
      {status === 'scanning' && <p className="hint">Hold the barcode inside the frame, about a hand's width away. It scans by itself.</p>}
      {status === 'error' && <p className="warn">{error}</p>}
    </Modal>
  );
}
