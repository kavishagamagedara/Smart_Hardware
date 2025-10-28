// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

try {
	const { TextEncoder, TextDecoder } = require('util');
	if (typeof global.TextEncoder === 'undefined') {
		global.TextEncoder = TextEncoder;
	}
	if (typeof global.TextDecoder === 'undefined') {
		global.TextDecoder = TextDecoder;
	}
} catch (err) {
	// util may be unavailable in some environments; tests that rely on TextEncoder will fail gracefully.
}

jest.mock('axios', () => {
	const mockAxios = {
		get: jest.fn(() => Promise.resolve({ data: {} })),
		post: jest.fn(() => Promise.resolve({ data: {} })),
		patch: jest.fn(() => Promise.resolve({ data: {} })),
		delete: jest.fn(() => Promise.resolve({ data: {} })),
		put: jest.fn(() => Promise.resolve({ data: {} })),
	};
	mockAxios.create = jest.fn(() => mockAxios);

	return {
		__esModule: true,
		default: mockAxios,
		...mockAxios,
	};
});
