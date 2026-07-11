interface Window {
  NDEFReader: typeof NDEFReader;
}

type NDEFMessageSource = string | BufferSource | NDEFMessageInit;

interface NDEFReader extends EventTarget {
  scan: (options?: NDEFScanOptions) => Promise<void>;
  write: (message: NDEFMessageSource, options?: NDEFWriteOptions) => Promise<void>;
  onreading: (this: this, event: NDEFReadingEvent) => any;
  onreadingerror: (this: this, event: Event) => any;
}

declare var NDEFReader: {
  prototype: NDEFReader;
  new (): NDEFReader;
};

interface NDEFReadingEvent extends Event {
  serialNumber: string;
  message: NDEFMessage;
}

interface NDEFMessage {
  records: ReadonlyArray<NDEFRecord>;
}

interface NDEFRecord {
  readonly recordType: string;
  readonly mediaType?: string;
  readonly id?: string;
  readonly data?: DataView;
  readonly encoding?: string;
  readonly lang?: string;
  toRecords?: () => NDEFRecord[];
}

interface NDEFScanOptions {
  signal: AbortSignal;
}

interface NDEFWriteOptions {
  overwrite?: boolean;
  signal?: AbortSignal;
}

interface NDEFMessageInit {
  records: NDEFRecordInit[];
}

interface NDEFRecordInit {
  recordType: string;
  data?: string | BufferSource | NDEFMessageInit;
  mediaType?: string;
  id?: string;
  encoding?: string;
  lang?: string;
}