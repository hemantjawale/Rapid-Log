import { LogBuffer } from '../src/core/LogBuffer';
import { Transport } from '../src/transports/Transport';
import { LogEntry, LogLevel } from '../src/types';

describe('LogBuffer', () => {
  let mockTransport: jest.Mocked<Transport>;
  let buffer: LogBuffer;

  beforeEach(() => {
    mockTransport = {
      send: jest.fn().mockResolvedValue(undefined),
    };
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  const createEntry = (msg: string): LogEntry => ({
    timestamp: new Date().toISOString(),
    level: LogLevel.INFO,
    message: msg,
  });

  it('should buffer logs and flush when limit is reached', async () => {
    buffer = new LogBuffer(2, 1000, [mockTransport]);
    
    buffer.add(createEntry('1'));
    expect(mockTransport.send).not.toHaveBeenCalled();

    buffer.add(createEntry('2'));
    // Flush is async, but triggered synchronously by add()
    // We wait for promises to settle
    await Promise.resolve(); 
    
    expect(mockTransport.send).toHaveBeenCalledTimes(1);
    expect(mockTransport.send).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ message: '1' }),
      expect.objectContaining({ message: '2' }),
    ]));
  });

  it('should flush based on time interval', async () => {
    buffer = new LogBuffer(10, 1000, [mockTransport]);
    
    buffer.add(createEntry('1'));
    expect(mockTransport.send).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    expect(mockTransport.send).toHaveBeenCalledTimes(1);
  });

  it('should drop logs when buffer is full (Backpressure Gate 1)', () => {
    // Hack: spy on process.stderr
    const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    
    // Create buffer with mocked send that never resolves (simulating stuck transport)
    // Actually, to test Gate 1 (memory limit), we just need to fill the buffer.
    // However, LogBuffer auto-flushes when full.
    // To test "dropping", we need the flush to NOT clear the buffer immediately,
    // OR we push faster than the flush execution loop.
    
    // In our implementation, `add` calls `flush`. `flush` moves `buffer` to `batch`.
    // So `buffer` is empty immediately after `add` returns, UNLESS flush is blocked?
    // No, `flush` is async. `add` triggers it but doesn't await.
    // However, `flush` clears `this.buffer` synchronously before awaiting transport.
    
    // Wait, the "Buffer full" check happens at the START of `add`.
    // If `flush` clears the buffer, how can it be full?
    // It can happen if `add` is called recursively or if we somehow fill it up before flush clears it?
    // Actually, with the current implementation:
    // 1. push
    // 2. if length >= limit -> flush()
    // 3. flush() -> buffer = []
    
    // So Gate 1 is rarely hit unless `flush` logic changes or we have concurrency issues?
    // Ah, wait. If we have `inflightBatches >= maxInflight`, `flush` returns EARLY without clearing buffer.
    // THAT is when the buffer starts filling up up to `limit`.
    
    buffer = new LogBuffer(2, 1000, [mockTransport], 1); // maxInflight = 1
    
    // 1. Send first batch to occupy the "inflight" slot
    // Make transport hang
    mockTransport.send.mockImplementation(() => new Promise(() => {})); 
    
    buffer.add(createEntry('batch1-1'));
    buffer.add(createEntry('batch1-2')); // Triggers flush. Inflight=1. Buffer cleared.
    
    // 2. Now Inflight=1. Next flush calls will return early.
    // Fill the buffer
    buffer.add(createEntry('fill-1'));
    buffer.add(createEntry('fill-2')); 
    // At this point, buffer is full (size 2). 
    // add() triggered flush(), but flush() saw maxInflight and returned early.
    // So buffer remains size 2.
    
    // 3. Next add should drop
    buffer.add(createEntry('overflow'));
    
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('Buffer full'));
    
    stderrSpy.mockRestore();
  });
});
