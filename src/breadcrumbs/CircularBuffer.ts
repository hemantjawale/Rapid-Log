export class CircularBuffer<T> {
  private buffer: T[];
  private maxSize: number;
  private index: number;
  private size: number;

  constructor(maxSize: number) {
    this.buffer = new Array(maxSize);
    this.maxSize = maxSize;
    this.index = 0;
    this.size = 0;
  }

  push(item: T): void {
    this.buffer[this.index] = item;
    this.index = (this.index + 1) % this.maxSize;
    this.size = Math.min(this.size + 1, this.maxSize);
  }

  toArray(): T[] {
    if (this.size < this.maxSize) {
      return this.buffer.slice(0, this.size);
    }
    return [
      ...this.buffer.slice(this.index),
      ...this.buffer.slice(0, this.index)
    ];
  }

  clear(): void {
    this.index = 0;
    this.size = 0;
  }
}
