import { Logger } from '../src/Logger.js';
import { LogLevel } from '../src/types.js';
import { Transport } from '../src/transports/Transport.js';
import { jest } from '@jest/globals';

describe('Logger', () => {
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

  it('should log messages with correct level', async () => {
    logger.info('test info');
    await Promise.resolve();
    expect(mockTransport.send).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ level: 'info', message: 'test info' })
    ]));
  });

  it('should ignore logs below configured level', async () => {
    logger.debug('test debug');
    await Promise.resolve();
    expect(mockTransport.send).not.toHaveBeenCalled();
  });

  it('should include context', async () => {
    logger.info('test context', { userId: 1 });
    await Promise.resolve();
    expect(mockTransport.send).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ 
        context: expect.objectContaining({ userId: 1 }) 
      })
    ]));
  });
});
