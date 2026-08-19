interface FileSystemEntryLike {
  isFile: boolean;
  isDirectory: boolean;
  file(cb: (f: File) => void, err: (e: unknown) => void): void;
  createReader(): { readEntries(cb: (e: FileSystemEntryLike[]) => void, err: (x: unknown) => void): void };
}

const MAX_ENTRIES = 400;

function readEntry(entry: FileSystemEntryLike, out: File[]): Promise<void> {
  if (out.length >= MAX_ENTRIES) return Promise.resolve();
  if (entry.isFile) {
    return new Promise((resolve) => {
      entry.file((f) => {
        out.push(f);
        resolve();
      }, () => resolve());
    });
  }
  if (!entry.isDirectory) return Promise.resolve();
  const reader = entry.createReader();
  return new Promise((resolve) => {
    const step = () => {
      reader.readEntries(async (batch) => {
        if (batch.length === 0) {
          resolve();
          return;
        }
        for (const child of batch) await readEntry(child, out);
        step();
      }, () => resolve());
    };
    step();
  });
}

export async function filesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const items = dt.items;
  const entries: FileSystemEntryLike[] = [];
  if (items) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i] as unknown as {
        webkitGetAsEntry?: () => FileSystemEntryLike | null;
      };
      const entry = item.webkitGetAsEntry?.();
      if (entry) entries.push(entry);
    }
  }
  if (entries.length === 0) return [...dt.files];

  const out: File[] = [];
  for (const entry of entries) await readEntry(entry, out);
  return out.length > 0 ? out : [...dt.files];
}
