import { Readable } from 'stream';

export class FileOutput extends Readable {
  private url_: string;
  private blob_: Promise<Blob> | null = null;

  constructor(url: string) {
    super();
    this.url_ = url;
  }

  url(): string {
    return this.url_;
  }

  async blob(): Promise<Blob> {
    if (!this.blob_) {
      this.blob_ = fetch(this.url_).then(res => res.blob());
    }
    return this.blob_;
  }

  // Implement Readable _read method
  _read(size: number): void {
    // Implementation not needed for our use case
    this.push(null);
  }
}
