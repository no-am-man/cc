const EventEmitter = require('events');

describe('Oracle', () => {
    let Oracle;
    let mockRequest;
    let mockResponse;
    let httpsMock;

    beforeEach(() => {
        jest.resetModules();
        jest.useFakeTimers();
        
        process.env.METAL_PRICE_API_KEY = 'test-key';
        
        mockResponse = new EventEmitter();
        mockRequest = new EventEmitter();
        
        // Use doMock to ensure the module required inside Oracle.js gets this mock
        httpsMock = {
            get: jest.fn((url, cb) => {
                // Defer the callback to allow the function to return the request object first
                // (though synchronous call is fine for .on attachment, usually)
                if (cb) {
                    process.nextTick(() => cb(mockResponse));
                }
                return mockRequest;
            })
        };
        
        jest.doMock('https', () => httpsMock);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('initializes with default price', () => {
        // Remove key to test default
        delete process.env.METAL_PRICE_API_KEY;
        Oracle = require('../../src/Oracle');
        expect(Oracle.getPrice()).toBe(0.80);
    });

    test('fetches live price on init if API key is present', () => {
        Oracle = require('../../src/Oracle');
        expect(httpsMock.get).toHaveBeenCalled();
        expect(httpsMock.get.mock.calls[0][0]).toContain('api_key=test-key');
    });

    test('updates price when API returns valid data', () => {
        Oracle = require('../../src/Oracle');
        
        // Wait for next tick for the callback to fire
        jest.runAllTicks();

        // Simulate response
        const apiData = JSON.stringify({
            success: true,
            rates: { XAG: 0.032 } // ~31.25 USD/oz
        });
        
        mockResponse.emit('data', apiData);
        mockResponse.emit('end');

        const price = Oracle.getPrice();
        expect(price).toBeCloseTo(1.0047, 3);
    });

    test('handles API errors gracefully', () => {
        Oracle = require('../../src/Oracle');
        jest.runAllTicks();
        
        // Simulate invalid JSON
        mockResponse.emit('data', 'invalid json');
        mockResponse.emit('end');
        
        // Price should remain default/previous
        expect(Oracle.getPrice()).toBe(0.80);
    });

    test('handles network errors', () => {
        Oracle = require('../../src/Oracle');
        jest.runAllTicks();
        
        mockRequest.emit('error', new Error('Network fail'));
        // Should catch and log, not crash
    });

    test('allows manual price setting', () => {
        Oracle = require('../../src/Oracle');
        Oracle.setPrice(1.50);
        expect(Oracle.getPrice()).toBe(1.50);
    });
    
    test('polls for updates', () => {
        Oracle = require('../../src/Oracle');
        jest.runAllTicks();
        httpsMock.get.mockClear();
        
        jest.advanceTimersByTime(60000);
        expect(httpsMock.get).toHaveBeenCalledTimes(1);
    });
});
