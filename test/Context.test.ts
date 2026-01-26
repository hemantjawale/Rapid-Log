import { Logger, LogLevel } from '../src/index.js';
import { Transport } from '../src/transports/Transport.js';
import { jest } from '@jest/globals';

describe('Logger Context Propagation', () => {
  let mockTransport: jest.Mocked<Transport>;
  let logger: Logger;

  beforeEach(() => {
    mockTransport = {
      send: jest.fn().mockResolvedValue(undefined),
    };
    logger = new Logger({
      level: LogLevel.INFO,
      transports: [mockTransport],
      bufferSize: 1, // Flush immediately
    });
  });

  it('should propagate context via runWithContext', async () => {
    const reqId = 'req-123';
    
    await logger.runWithContext({ reqId }, async () => {
        logger.info('Inside context');
        
        // Simulate async work
        await new Promise(r => setTimeout(r, 10));
        
        logger.info('After async work');
    });

    // Outside context
    logger.info('Outside context');

    await Promise.resolve(); // Wait for flushes

    expect(mockTransport.send).toHaveBeenCalledTimes(3);
    
    // Check first call (Inside context)
    const call1 = mockTransport.send.mock.calls[0][0][0];
    expect(call1.message).toBe('Inside context');
    expect(call1.context).toMatchObject({ reqId });

    // Check second call (After async)
    const call2 = mockTransport.send.mock.calls[1][0][0];
    expect(call2.message).toBe('After async work');
    expect(call2.context).toMatchObject({ reqId });

    // Check third call (Outside)
    const call3 = mockTransport.send.mock.calls[2][0][0];
    expect(call3.message).toBe('Outside context');
    expect(call3.context?.reqId).toBeUndefined();
  });
});
